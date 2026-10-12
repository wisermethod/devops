/**
 * Mail relay. It listens for authenticated SMTP and mirrors each accepted
 * transaction to one upstream over TLS. Paths and timeouts come from the
 * environment so a test can run the same program on another machine.
 *
 * RELAY_CONF       directory of logins.json, upstreams.json, state and state-request (default /conf)
 * RELAY_SECRETS    directory of <upstream>.token files (default /secrets)
 * RELAY_JOURNAL    journal file, or a directory that holds the file journal (default /journal)
 * RELAY_PORT       default 2525
 * RELAY_HOST       default 0.0.0.0
 * RELAY_CONNECT_TIMEOUT_MS, RELAY_GREETING_TIMEOUT_MS, RELAY_COMMAND_TIMEOUT_MS,
 * RELAY_DATA_REPLY_TIMEOUT_MS, RELAY_TRANSACTION_TIMEOUT_MS,
 * RELAY_IDLE_TIMEOUT_MS, RELAY_DATA_DEADLINE_MS, RELAY_STATUS_INTERVAL_MS
 * RELAY_EXTRA_CA   PEM appended to the default trust store. Unset in production,
 *                  so verification stays Node's default. Tests set it because
 *                  NODE_EXTRA_CA_CERTS is read only at process start.
 * RELAY_AUTH_SLOT_DELAY_MS  test-only pause inside an AUTH check. Default 0.
 * RELAY_DONE_APPEND_DELAY_MS  test-only pause before a done line is appended.
 *                  Default 0. Unset on the machine.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { open, mkdir, readFile, rename, stat, unlink } from 'node:fs/promises';
import { readFileSync, statSync } from 'node:fs';
import { connect as tlsConnect, rootCertificates } from 'node:tls';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import smtpServerMod from 'smtp-server';
import smtpConnectionMod from 'smtp-server/lib/smtp-connection.js';

import { inspectHeaders, parseMailbox } from './headers.js';

const { SMTPServer } = smtpServerMod;
const { SMTPConnection } = smtpConnectionMod;

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_RECIPIENTS = 50;
const MAX_INFLIGHT = 2;
const MAX_CONNECTIONS = 8;
const JOURNAL_LIMIT = 1024 * 1024;
const LOG_LIMIT = 2000;
const MAX_REPLY_LINE = 2048;
const MAX_REPLY_LINES = 100;
const MAX_REPLY_BUFFER = 64 * 1024;
const TEARDOWN_MS = 1000;
const AUTH_SLOTS = 4;
const AUTH_WINDOW_MS = 60 * 1000;
const AUTH_DELAY_MS = 1000;
const WRAP = Symbol('twentyRelayWrap');

const txBySession = new WeakMap();
const connBySession = new WeakMap();

export function hashPassword(saltHex, password) {
  return createHash('sha256').update(String(saltHex)).update(String(password), 'utf8').digest('hex');
}

function hashesEqual(leftHex, rightHex) {
  const left = Buffer.from(String(leftHex));
  const right = Buffer.from(String(rightHex));
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/**
 * smtp-server 3.19.17 refuses some RCPT commands inside
 * SMTPConnection#handler_RCPT (lib/smtp-connection.js) before onRcptTo.
 * An empty or unparsable recipient is answered 501 at the top of that
 * method. A valueless NOTIFY or ORCPT is answered 501 by _rejectValueless,
 * still inside handler_RCPT, still before onRcptTo. Wrapping the method is
 * what counts those commands. onRcptTo records an acceptance only after the
 * upstream accepts, and DATA treats the transaction as incomplete when
 * rcptCommands is greater than rcptAccepted.
 */
function installCommandWraps() {
  if (SMTPConnection.prototype.handler_RCPT[WRAP]) return;

  const originalInit = SMTPConnection.prototype.init;
  function wrappedInit(...args) {
    connBySession.set(this.session, this);
    return originalInit.apply(this, args);
  }
  wrappedInit[WRAP] = true;
  SMTPConnection.prototype.init = wrappedInit;

  const originalRcpt = SMTPConnection.prototype.handler_RCPT;
  function wrappedRcpt(command, callback) {
    const tx = txBySession.get(this.session);
    if (tx && !tx.finished) tx.rcptCommands += 1;
    return originalRcpt.call(this, command, callback);
  }
  wrappedRcpt[WRAP] = true;
  SMTPConnection.prototype.handler_RCPT = wrappedRcpt;

  for (const name of ['handler_RSET', 'handler_EHLO', 'handler_HELO', 'handler_QUIT']) {
    const original = SMTPConnection.prototype[name];
    function bound(command, callback) {
      const tx = txBySession.get(this.session);
      if (tx && !tx.finished && !tx.dotSent && typeof tx.onClientReset === 'function') tx.onClientReset();
      return original.call(this, command, callback);
    }
    bound[WRAP] = true;
    SMTPConnection.prototype[name] = bound;
  }
}

function envInt(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return fallback;
  return value;
}

function journalPath(configured) {
  try {
    if (statSync(configured).isDirectory()) return path.join(configured, 'journal');
  } catch {
    // A missing path is the file itself. Tests pass a file that does not exist yet.
  }
  return configured;
}

function hostnameOk(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 253) return false;
  return value.split('.').every((label) => {
    if (label.length < 1 || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    return /^[a-z0-9-]+$/i.test(label);
  });
}

function ipv4Ok(value) {
  if (typeof value !== 'string' || !/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) return false;
  return value.split('.').every((part) => {
    const n = Number(part);
    return n <= 255 && String(n) === String(Number(part));
  });
}

function hostOk(value) {
  return hostnameOk(value) || ipv4Ok(value);
}

function tokenName(secretsDir, name) {
  return path.join(secretsDir, `${name}.token`);
}

function loadSnapshot(confDir, secretsDir) {
  const loginsFile = path.join(confDir, 'logins.json');
  const upstreamsFile = path.join(confDir, 'upstreams.json');
  let rawLogins;
  let rawUpstreams;
  try {
    rawLogins = readFileSync(loginsFile, 'utf8');
    rawUpstreams = readFileSync(upstreamsFile, 'utf8');
  } catch (error) {
    return { ok: false, hash: '-', error: error.message };
  }
  let logins;
  let upstreams;
  try {
    logins = JSON.parse(rawLogins);
    upstreams = JSON.parse(rawUpstreams);
  } catch (error) {
    const hash = createHash('sha256').update(rawLogins).update(rawUpstreams).digest('hex');
    return { ok: false, hash, error: error.message };
  }
  if (!Array.isArray(logins) || !Array.isArray(upstreams)) {
    return { ok: false, hash: '-', error: 'configuration must be two arrays' };
  }
  const seenUp = new Set();
  const cleanUp = [];
  for (const row of upstreams) {
    if (!row || typeof row !== 'object') return { ok: false, hash: '-', error: 'upstream row' };
    const name = String(row.name || '');
    if (!/^[a-z0-9-]{1,32}$/.test(name) || seenUp.has(name)) {
      return { ok: false, hash: '-', error: 'upstream name' };
    }
    if (!hostOk(row.host)) return { ok: false, hash: '-', error: 'upstream host' };
    if (!Number.isInteger(row.port) || row.port < 1 || row.port > 65535) {
      return { ok: false, hash: '-', error: 'upstream port' };
    }
    if (typeof row.user !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(row.user)) {
      return { ok: false, hash: '-', error: 'upstream user' };
    }
    const expectedToken = tokenName(secretsDir, name);
    if (row.token_file !== expectedToken) return { ok: false, hash: '-', error: 'token file' };
    seenUp.add(name);
    cleanUp.push({
      name,
      host: row.host,
      port: row.port,
      user: row.user,
      token_file: expectedToken
    });
  }
  const seenLogin = new Set();
  const seenDomain = new Set();
  const cleanLogins = [];
  for (const row of logins) {
    if (!row || typeof row !== 'object') return { ok: false, hash: '-', error: 'login row' };
    const login = String(row.login || '');
    const domain = String(row.domain || '').toLowerCase();
    if (!/^[a-z0-9-]{1,32}$/.test(login) || seenLogin.has(login)) {
      return { ok: false, hash: '-', error: 'login' };
    }
    if (!hostnameOk(domain)) return { ok: false, hash: '-', error: 'domain' };
    if (seenDomain.has(domain)) return { ok: false, hash: '-', error: 'domain bound twice' };
    if (!seenUp.has(row.upstream)) return { ok: false, hash: '-', error: 'login upstream' };
    if (typeof row.salt !== 'string' || !/^[0-9a-f]{32,128}$/.test(row.salt)) {
      return { ok: false, hash: '-', error: 'salt' };
    }
    if (typeof row.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(row.sha256)) {
      return { ok: false, hash: '-', error: 'sha256' };
    }
    if (typeof row.created !== 'string' || row.created.length < 1 || row.created.length > 64) {
      return { ok: false, hash: '-', error: 'created' };
    }
    seenLogin.add(login);
    seenDomain.add(domain);
    cleanLogins.push({
      login,
      domain,
      upstream: row.upstream,
      salt: row.salt,
      sha256: row.sha256,
      created: row.created
    });
  }
  const tokenDigests = {};
  const tokenValues = {};
  const names = cleanUp.map((row) => row.name).sort();
  for (const name of names) {
    const row = cleanUp.find((item) => item.name === name);
    try {
      const bytes = readFileSync(row.token_file);
      tokenDigests[name] = createHash('sha256').update(bytes).digest('hex');
      const text = bytes.toString('utf8').replace(/\s+$/, '');
      tokenValues[name] = text.length === 0 ? null : text;
    } catch {
      tokenDigests[name] = 'missing';
      tokenValues[name] = null;
    }
  }
  const body = JSON.stringify({
    logins: [...cleanLogins].sort((a, b) => a.login.localeCompare(b.login)),
    upstreams: [...cleanUp].sort((a, b) => a.name.localeCompare(b.name)),
    tokens: tokenDigests
  });
  return {
    ok: true,
    hash: createHash('sha256').update(body).digest('hex'),
    logins: cleanLogins,
    upstreams: cleanUp.map((row) => ({ ...row, token: tokenValues[row.name] }))
  };
}

function readStateWord(file) {
  try {
    const bytes = readFileSync(file);
    return bytes.equals(Buffer.from('send')) ? 'send' : 'hold';
  } catch {
    return 'hold';
  }
}

// A missing file is "-", so a state write from before any request still loads.
const REQUEST_ID = /^[0-9a-f]{32}$/;

function readRequestId(file) {
  try {
    const text = readFileSync(file, 'utf8').trim();
    return REQUEST_ID.test(text) ? text : '-';
  } catch {
    return '-';
  }
}

function logToken(value) {
  const clean = String(value ?? '').replace(/[^A-Za-z0-9_.:@=+/-]/g, '').slice(0, 120);
  return clean || '-';
}

// Printable ASCII, no space and no angle bracket inside the id.
const MESSAGE_ID = /^<[!-;=?-~]{1,248}@[!-;=?-~]{1,248}>$/;

function messageIdToken(value) {
  const text = String(value ?? '');
  if (text.length > 250 || !MESSAGE_ID.test(text)) return 'invalid';
  return text;
}

export function dotStuff(body) {
  const src = Buffer.isBuffer(body) ? body : Buffer.from(body);
  let escapes = 0;
  if (src.length > 0 && src[0] === 0x2e) escapes += 1;
  for (let i = 0; i < src.length - 1; i += 1) {
    if (src[i] === 0x0a && src[i + 1] === 0x2e) escapes += 1;
  }
  const needsCrlf = src.length < 2 || src[src.length - 2] !== 0x0d || src[src.length - 1] !== 0x0a;
  const out = Buffer.allocUnsafe(src.length + escapes + (needsCrlf ? 2 : 0) + 3);
  let w = 0;
  if (src.length > 0 && src[0] === 0x2e) out[w++] = 0x2e;
  for (let i = 0; i < src.length; i += 1) {
    if (i > 0 && src[i - 1] === 0x0a && src[i] === 0x2e) out[w++] = 0x2e;
    out[w++] = src[i];
  }
  if (needsCrlf) {
    out[w++] = 0x0d;
    out[w++] = 0x0a;
  }
  out[w++] = 0x2e;
  out[w++] = 0x0d;
  out[w++] = 0x0a;
  if (w !== out.length) throw new Error('dot-stuff size');
  return out;
}

function smtpError(code, message) {
  const error = new Error(message);
  error.responseCode = code;
  return error;
}

function once(fn) {
  let used = false;
  return (...args) => {
    if (used) return undefined;
    used = true;
    return fn(...args);
  };
}

class Upstream {
  constructor(socket, timeouts) {
    this.socket = socket;
    this.timeouts = timeouts;
    this.buf = '';
    this.queue = [];
    this.verified = true;
    this.closed = false;
    this.mailAccepted = false;
    this.inData = false;
    this.dotSent = false;
    this.didClose = false;
    this.sessionId = randomBytes(8).toString('hex');
    this.closedPromise = new Promise((resolve) => {
      this._resolveClosed = resolve;
    });
    socket.setEncoding('latin1');
    socket.on('data', (chunk) => {
      if (this.closed) return;
      this.buf += chunk;
      this._drain();
      if (!this.closed && this.buf.length > MAX_REPLY_BUFFER) {
        this._overflow(new Error('upstream reply too large'));
      }
    });
    socket.on('error', (error) => this._failAll(error));
    socket.on('close', () => {
      this.didClose = true;
      this._failAll(new Error('upstream closed'));
      this._resolveClosed();
    });
  }

  whenClosed() {
    return this.closedPromise;
  }

  canReset() {
    return !this.closed && !this.dotSent && !this.inData && this.mailAccepted;
  }

  _overflow(error) {
    this._failAll(error);
    this.destroy();
  }

  _failAll(error) {
    this.closed = true;
    while (this.queue.length) {
      const waiter = this.queue.shift();
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  _drain() {
    while (this.queue.length && !this.closed) {
      const waiter = this.queue[0];
      let splitAt = this.buf.indexOf('\n');
      if (splitAt < 0) return;
      while (splitAt >= 0 && !this.closed) {
        let line = this.buf.slice(0, splitAt);
        this.buf = this.buf.slice(splitAt + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.length > MAX_REPLY_LINE) {
          this._overflow(new Error('upstream reply line too long'));
          return;
        }
        if (waiter.lines.length >= MAX_REPLY_LINES) {
          this._overflow(new Error('upstream reply has too many lines'));
          return;
        }
        waiter.lines.push(line);
        const matched = /^(\d{3})([ -])(.*)$/.exec(line);
        if (!matched) {
          this.queue.shift();
          clearTimeout(waiter.timer);
          waiter.reject(new Error('bad upstream reply'));
          break;
        }
        if (matched[2] === ' ') {
          this.queue.shift();
          clearTimeout(waiter.timer);
          waiter.resolve({
            code: Number(matched[1]),
            text: matched[3],
            lines: waiter.lines
          });
          break;
        }
        splitAt = this.buf.indexOf('\n');
        if (splitAt < 0) return;
      }
    }
  }

  readReply(timeoutMs) {
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, lines: [], timer: null };
      waiter.timer = setTimeout(() => {
        this.queue = this.queue.filter((item) => item !== waiter);
        reject(Object.assign(new Error('upstream timeout'), { timeout: true }));
      }, timeoutMs);
      this.queue.push(waiter);
      this._drain();
    });
  }

  writeLine(line) {
    if (!this.verified) throw new Error('refusing to write before the handshake is verified');
    if (this.closed) throw new Error('upstream closed');
    this.socket.write(`${line}\r\n`);
  }

  async command(line, timeoutMs) {
    this.writeLine(line);
    return this.readReply(timeoutMs);
  }

  destroy() {
    this.closed = true;
    this.socket.destroy();
  }

  // Eligible teardown writes RSET and QUIT and half-closes. It does not wait
  // for the RSET reply. The socket is destroyed if it has not closed in time.
  shutdown() {
    if (this._shut) return;
    this._shut = true;
    if (!this.canReset()) {
      this.destroy();
      return;
    }
    try {
      this.writeLine('RSET');
      this.writeLine('QUIT');
      this.socket.end();
    } catch {
      this.destroy();
      return;
    }
    const timer = setTimeout(() => {
      if (!this.didClose) this.destroy();
    }, TEARDOWN_MS);
    if (typeof timer.unref === 'function') timer.unref();
    this.closedPromise.then(() => clearTimeout(timer));
  }
}

async function syncDirectory(dir) {
  try {
    const handle = await open(dir, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // A directory sync is not available on every filesystem.
  }
}

function connectUpstream(upstream, timeouts, extraCa, opening, onOpen) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const options = {
      host: upstream.host,
      port: upstream.port
    };
    // Node rejects an IP address as a TLS server name. The host is still
    // checked against the certificate. A hostname keeps SNI and that check.
    if (!ipv4Ok(upstream.host)) options.servername = upstream.host;
    if (extraCa) options.ca = [...rootCertificates, extraCa];
    const socket = tlsConnect(options);
    if (onOpen) onOpen(socket);
    const closed = new Promise((resolveClosed) => {
      socket.once('close', () => resolveClosed());
    });
    if (opening) {
      opening.socket = socket;
      opening.closed = closed;
      if (opening.aborted) {
        fail(new Error('transaction timeout'));
        return;
      }
    }
    const timer = setTimeout(() => fail(new Error('connect timeout')), timeouts.connect);
    function fail(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      reject(error);
    }
    socket.once('error', fail);
    socket.once('secureConnect', () => {
      if (settled) return;
      if (!socket.authorized) {
        fail(new Error('certificate was not verified'));
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.removeListener('error', fail);
      resolve(new Upstream(socket, timeouts));
    });
  });
}

function unresolvedIntents(text) {
  const done = new Set();
  const intents = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('done ')) {
      const id = /(?:^|\s)id=([0-9a-f]+)/.exec(line);
      if (id) done.add(id[1]);
    }
  }
  for (const line of text.split('\n')) {
    if (!line.startsWith('intent ')) continue;
    const id = /(?:^|\s)id=([0-9a-f]+)/.exec(line);
    if (id && !done.has(id[1])) intents.push(line);
  }
  return intents;
}

function createJournal(file, renameFile = rename) {
  let chain = Promise.resolve();
  const freshPath = `${file}.new`;
  async function exists(target) {
    try {
      await stat(target);
      return true;
    } catch {
      return false;
    }
  }
  async function writeLine(line) {
    if (/[\r\n]/.test(line)) throw new Error('journal line');
    await mkdir(path.dirname(file), { recursive: true });
    // A rotation whose second rename failed leaves journal.new and no current
    // file. Recover that before creating a current file, or the next append
    // would orphan the unresolved intents in journal.new.
    if (await exists(freshPath)) await recoverRotation();
    await rotateIfNeeded();
    const handle = await open(file, 'a');
    try {
      await handle.write(`${line}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  async function rotateIfNeeded() {
    let info;
    try {
      info = await stat(file);
    } catch {
      return;
    }
    if (info.size < JOURNAL_LIMIT) return;
    const text = await readFile(file, 'utf8');
    const kept = unresolvedIntents(text);
    const handle = await open(freshPath, 'w');
    try {
      if (kept.length > 0) await handle.write(`${kept.join('\n')}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await renameFile(file, `${file}.1`);
    await renameFile(freshPath, file);
    await syncDirectory(path.dirname(file));
  }
  async function recoverRotation() {
    const hasNew = await exists(freshPath);
    const hasCurrent = await exists(file);
    if (hasNew && !hasCurrent) await renameFile(freshPath, file);
    else if (hasNew && hasCurrent) {
      try {
        await unlink(freshPath);
      } catch {
        // Already gone.
      }
    }
  }
  function append(line) {
    const run = chain.then(() => writeLine(line));
    chain = run.then(() => undefined, () => undefined);
    return run;
  }
  async function reconcile() {
    await mkdir(path.dirname(file), { recursive: true });
    await recoverRotation();
    let text = '';
    try {
      text = await readFile(file, 'utf8');
    } catch {
      text = '';
    }
    if (Buffer.byteLength(text) >= JOURNAL_LIMIT) await rotateIfNeeded();
    try {
      text = await readFile(file, 'utf8');
    } catch {
      text = '';
    }
    const openIntents = unresolvedIntents(text);
    for (const line of openIntents) {
      const id = /(?:^|\s)id=([0-9a-f]+)/.exec(line);
      if (!id) continue;
      await append(`done id=${id[1]} outcome=ambiguous`);
    }
    return openIntents.length;
  }
  return { append, reconcile, file };
}

export async function startRelay(env = process.env, options = {}) {
  installCommandWraps();
  // Production does not retain lines. A test passes retainLogs and then
  // keeps at most the last LOG_LIMIT lines. Standard output is unchanged.
  const retainLogs = options.retainLogs === true;
  const confDir = env.RELAY_CONF || '/conf';
  const secretsDir = env.RELAY_SECRETS || '/secrets';
  const journalFile = journalPath(env.RELAY_JOURNAL || '/journal');
  const port = env.RELAY_PORT === undefined || env.RELAY_PORT === '' ? 2525 : Number(env.RELAY_PORT);
  const host = env.RELAY_HOST || '0.0.0.0';
  const timeouts = {
    connect: envInt(env, 'RELAY_CONNECT_TIMEOUT_MS', 10_000),
    greeting: envInt(env, 'RELAY_GREETING_TIMEOUT_MS', 10_000),
    command: envInt(env, 'RELAY_COMMAND_TIMEOUT_MS', 30_000),
    dataReply: envInt(env, 'RELAY_DATA_REPLY_TIMEOUT_MS', 60_000),
    transaction: envInt(env, 'RELAY_TRANSACTION_TIMEOUT_MS', 100_000),
    idle: envInt(env, 'RELAY_IDLE_TIMEOUT_MS', 120_000),
    dataDeadline: envInt(env, 'RELAY_DATA_DEADLINE_MS', 120_000)
  };
  const statusInterval = envInt(env, 'RELAY_STATUS_INTERVAL_MS', 5000);
  const extraCa = env.RELAY_EXTRA_CA || '';
  const authSlotDelay = env.RELAY_AUTH_SLOT_DELAY_MS ? Number(env.RELAY_AUTH_SLOT_DELAY_MS) : 0;
  const doneDelay = envInt(env, 'RELAY_DONE_APPEND_DELAY_MS', 0);
  const stateFile = path.join(confDir, 'state');
  const requestFile = path.join(confDir, 'state-request');
  const logs = [];
  const journal = createJournal(journalFile, typeof options.rename === 'function' ? options.rename : rename);
  let snapshot = loadSnapshot(confDir, secretsDir);
  let inflight = 0;
  const waiters = [];
  let authActive = 0;
  let authPeak = 0;
  const authQueue = [];
  const loginFailures = new Map();
  const sourceFailures = new Map();
  const connFailures = new WeakMap();
  const live = new Set();
  const upstreamAt = [];
  const upstreamClosedAt = [];
  let statusWord = readStateWord(stateFile);
  let statusRequest = readRequestId(requestFile);
  let statusSeq = 0;
  let statusNoted = null;
  let statusWriting = false;
  let statusPending = null;
  let statusTimer = null;

  function writeLog(line) {
    if (retainLogs) {
      logs.push(line);
      if (logs.length > LOG_LIMIT) logs.splice(0, logs.length - LOG_LIMIT);
    }
    process.stdout.write(`${line}\n`);
  }

  function logInflight() {
    writeLog(`inflight count=${inflight}`);
    publishStatus(false);
  }

  function statusFilePath() {
    return path.join(path.dirname(journalFile), 'status');
  }

  async function writeStatusLine(line) {
    const dest = statusFilePath();
    const tmp = path.join(path.dirname(journalFile), `.status-${process.pid}-${randomBytes(4).toString('hex')}.tmp`);
    try {
      await mkdir(path.dirname(journalFile), { recursive: true });
      const handle = await open(tmp, 'w');
      try {
        await handle.write(line);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(tmp, dest);
    } catch {
      try {
        await unlink(tmp);
      } catch {
        // The temporary file was already moved or never created.
      }
    }
  }

  // One write in progress and one replaceable pending line. A newer publish
  // replaces the pending line instead of queueing another snapshot.
  function publishStatus(force) {
    const same = statusNoted
      && statusNoted.word === statusWord
      && statusNoted.inflight === inflight
      && statusNoted.request === statusRequest;
    if (!force && same) return;
    statusNoted = { word: statusWord, inflight, request: statusRequest };
    statusSeq += 1;
    const line = `state=${statusWord} inflight=${inflight} seq=${statusSeq} time=${new Date().toISOString()} request=${statusRequest}`;
    if (statusWriting) {
      statusPending = line;
      return;
    }
    statusWriting = true;
    drainStatus(line);
  }

  function drainStatus(line) {
    const run = (async () => {
      if (typeof options.beforeStatusWrite === 'function') {
        await options.beforeStatusWrite(line);
      }
      await writeStatusLine(line);
    })();
    run.finally(() => {
      if (statusPending !== null) {
        const next = statusPending;
        statusPending = null;
        drainStatus(next);
        return;
      }
      statusWriting = false;
    }).catch(() => {
      // A status write after the directory is gone must not surface.
    });
  }

  function observeControl() {
    statusWord = readStateWord(stateFile);
    statusRequest = readRequestId(requestFile);
  }

  function observeState() {
    observeControl();
    publishStatus(false);
    return statusWord;
  }

  async function appendJournal(line, tx) {
    if (line.startsWith('done ')) {
      if (typeof options.beforeDoneAppend === 'function') {
        await options.beforeDoneAppend(tx, line);
      }
      if (doneDelay > 0) await new Promise((resolve) => setTimeout(resolve, doneDelay));
    }
    return journal.append(line);
  }

  function logConfig(status, hash) {
    const logins = snapshot.ok ? snapshot.logins.length : 0;
    const upstreams = snapshot.ok ? snapshot.upstreams.length : 0;
    writeLog(`config hash=${hash || '-'} status=${status} logins=${logins} upstreams=${upstreams}`);
  }

  function reload() {
    const next = loadSnapshot(confDir, secretsDir);
    if (!next.ok) {
      writeLog(`config hash=${next.hash} status=refused logins=${snapshot.ok ? snapshot.logins.length : 0} upstreams=${snapshot.ok ? snapshot.upstreams.length : 0}`);
      return { ok: false, hash: next.hash };
    }
    snapshot = next;
    logConfig('loaded', next.hash);
    return { ok: true, hash: next.hash };
  }

  if (!snapshot.ok) {
    logConfig('refused', snapshot.hash);
    throw new Error(`relay configuration is invalid: ${snapshot.error}`);
  }

  // Failures are kept per known login and per source address only, and a key
  // whose window has emptied is dropped, so an unknown name cannot grow a map.
  function prune(map, key, now) {
    const list = (map.get(key) || []).filter((stamp) => now - stamp < AUTH_WINDOW_MS);
    if (list.length === 0) map.delete(key);
    else map.set(key, list);
    return list;
  }

  function sweepFailures(now) {
    for (const map of [loginFailures, sourceFailures]) {
      for (const key of [...map.keys()]) prune(map, key, now);
    }
  }

  function withAuthSlot(work) {
    return new Promise((resolve, reject) => {
      const run = () => {
        authActive += 1;
        if (authActive > authPeak) authPeak = authActive;
        Promise.resolve()
          .then(work)
          .then(resolve, reject)
          .finally(() => {
            authActive -= 1;
            const next = authQueue.shift();
            if (next) next();
          });
      };
      if (authActive < AUTH_SLOTS) run();
      else authQueue.push(run);
    });
  }

  function acquireSlot(session) {
    if (inflight < MAX_INFLIGHT) {
      inflight += 1;
      logInflight();
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const waiter = {
        session,
        resolve: () => resolve(true),
        cancel: () => resolve(false)
      };
      session.relayWaiter = waiter;
      waiters.push(waiter);
    });
  }

  function releaseSlot() {
    const next = waiters.shift();
    if (next) {
      next.session.relayWaiter = null;
      next.resolve();
      return;
    }
    inflight = Math.max(0, inflight - 1);
    logInflight();
  }

  function cancelWaiter(session) {
    const waiter = session.relayWaiter;
    if (!waiter) return false;
    const index = waiters.indexOf(waiter);
    if (index >= 0) waiters.splice(index, 1);
    session.relayWaiter = null;
    waiter.cancel();
    return true;
  }

  function loginOf(session) {
    const user = session.user;
    if (typeof user === 'string') return user;
    if (user && typeof user.username === 'string') return user.username;
    return '';
  }

  function findLogin(name) {
    if (!snapshot.ok) return null;
    return snapshot.logins.find((row) => row.login === name) || null;
  }

  function logTx(tx, outcome, upstreamId) {
    if (tx.logged) return;
    tx.logged = true;
    const fields = [
      'tx',
      `login=${logToken(tx.login)}`,
      `domain=${logToken(tx.domain)}`,
      `recipients=${tx.rcptCommands}`,
      `bytes=${tx.bytes}`,
      `outcome=${outcome}`,
      `upstream=${logToken(upstreamId || tx.sessionId)}`
    ];
    if (outcome === 'ambiguous') fields.push(`message_id=${messageIdToken(tx.messageId)}`);
    writeLog(fields.join(' '));
  }

  function logAttempt(login, domain, outcome) {
    writeLog(`tx login=${logToken(login)} domain=${logToken(domain)} recipients=0 bytes=0 outcome=${outcome} upstream=-`);
  }

  function releaseHeld(tx) {
    if (!tx.holdsSlot || tx.slotReleased) return;
    const release = () => {
      if (tx.slotReleased) return;
      tx.slotReleased = true;
      tx.holdsSlot = false;
      releaseSlot();
    };
    const upstream = tx.upstreamRef;
    if (!tx.upstreamClosed || (upstream && upstream.didClose)) {
      release();
      return;
    }
    tx.upstreamClosed.then(release, release);
  }

  function detachTx(tx) {
    if (tx && tx.session && txBySession.get(tx.session) === tx) txBySession.delete(tx.session);
  }

  function finish(tx) {
    if (!tx || tx.finished) return false;
    tx.finished = true;
    clearTimeout(tx.deadline);
    clearTimeout(tx.transactionTimer);
    live.delete(tx);
    detachTx(tx);
    if (tx.upstream) dropUpstream(tx, !tx.dotSent);
    releaseHeld(tx);
    return true;
  }

  function destroyClient(tx) {
    try {
      if (tx.conn && tx.conn._socket) tx.conn._socket.destroy();
    } catch {
      // already gone
    }
  }

  function halted(tx) {
    return !tx || tx.finished || tx.expiring || tx.terminal;
  }

  // The first caller records the log line, the journal done line and tx.terminal.
  // A later caller returns. The journal write is not awaited here: a stuck
  // append leaves the intent open, which a restart counts ambiguous.
  function recordTerminal(tx, outcome) {
    if (!tx || tx.terminal) return false;
    tx.terminal = outcome;
    logTx(tx, outcome, tx.sessionId);
    if (!tx.intentId || tx.intentClosed) return true;
    tx.intentClosed = true;
    tx.terminalWrite = appendJournal(`done id=${tx.intentId} outcome=${outcome}`, tx);
    tx.terminalWrite.catch(() => {
      // The intent line is already durable. A restart counts it ambiguous.
    });
    return true;
  }

  function finishAfterUpstream(tx) {
    const closed = dropUpstream(tx, false);
    Promise.resolve(closed).finally(() => finish(tx));
  }

  // Confirm the reply bytes were accepted by the kernel before recording sent.
  // Node runs write callbacks in order, so an empty write after the reply
  // completes only once that reply's write has completed or failed. Bytes the
  // kernel has accepted can still be lost; no SMTP exchange can prove otherwise.
  function observeReplyWrite(tx, clientSocket, outcome) {
    let settled = false;
    const lose = () => {
      if (settled) return;
      settled = true;
      if (!tx.terminal) recordTerminal(tx, 'ambiguous');
      if (!tx.finished) finishAfterUpstream(tx);
    };
    const onClose = () => lose();
    clientSocket.once('close', onClose);
    try {
      clientSocket.write(Buffer.alloc(0), onProbe);
    } catch {
      lose();
    }
    function onProbe(error) {
      clientSocket.removeListener('close', onClose);
      if (error || tx.terminal) {
        lose();
        return;
      }
      if (settled) return;
      settled = true;
      recordTerminal(tx, outcome);
      const pending = tx.terminalWrite || Promise.resolve();
      Promise.resolve(pending).finally(() => {
        if (!tx.finished) finishAfterUpstream(tx);
      }).catch(() => {
        // The journal promise is already handled. Finish still ran above.
      });
    }
  }

  // Mark, destroy both sockets and drop the upstream without waiting on the
  // journal. Once the dot may have been sent the upstream is destroyed, never
  // reset. The slot is released when the upstream socket closes.
  function expireOpen(tx) {
    if (!tx || tx.finished || tx.expiring || tx.terminal) return;
    tx.expiring = true;
    clearTimeout(tx.deadline);
    clearTimeout(tx.transactionTimer);
    const ambiguous = tx.dotSent && !tx.replyRelayed && !tx.clientAnswered;
    recordTerminal(tx, ambiguous ? 'ambiguous' : 'incomplete');
    destroyClient(tx);
    const closed = dropUpstream(tx, !ambiguous);
    Promise.resolve(closed).finally(() => finish(tx));
  }

  function dropUpstream(tx, sendRset) {
    const upstream = tx.upstream;
    if (!upstream) return tx.upstreamClosed || Promise.resolve();
    tx.upstream = null;
    tx.upstreamRef = upstream;
    const closed = upstream.whenClosed();
    tx.upstreamClosed = closed;
    if (sendRset && upstream.canReset()) upstream.shutdown();
    else upstream.destroy();
    return closed;
  }

  const ambiguousCount = await journal.reconcile();
  writeLog(`journal ambiguous=${ambiguousCount}`);
  logInflight();
  logConfig('loaded', snapshot.hash);

  const server = new SMTPServer({
    authOptional: false,
    allowInsecureAuth: true,
    authMethods: ['PLAIN', 'LOGIN'],
    disabledCommands: ['STARTTLS'],
    hideSTARTTLS: true,
    hide8BITMIME: true,
    hideSMTPUTF8: true,
    hideCHUNKING: true,
    size: MAX_BYTES,
    maxClients: MAX_CONNECTIONS,
    socketTimeout: timeouts.idle,
    closeTimeout: 500,
    disableReverseLookup: true,
    logger: false,
    name: 'smtp-relay',
    async onAuth(auth, session, callback) {
      const done = once(callback);
      const username = String(auth.username || '');
      const password = String(auth.password || '');
      const source = String(session.remoteAddress || '');
      try {
        const verdict = await withAuthSlot(async () => {
          if (authSlotDelay > 0) await new Promise((resolve) => setTimeout(resolve, authSlotDelay));
          const record = findLogin(username);
          const actual = record
            ? hashPassword(record.salt, password)
            : hashPassword('00'.repeat(16), password);
          const expected = record ? record.sha256 : hashPassword('00'.repeat(16), 'no-such-password');
          return {
            ok: record !== null && hashesEqual(actual, expected),
            known: record !== null,
            login: record ? record.login : '',
            domain: record ? record.domain : '',
            sha256: record ? record.sha256 : ''
          };
        });
        if (verdict.ok) {
          session.relayBinding = {
            login: verdict.login,
            domain: verdict.domain,
            sha256: verdict.sha256
          };
          done(null, { user: username });
          return;
        }
        const now = Date.now();
        sweepFailures(now);
        const loginList = verdict.known ? prune(loginFailures, username, now) : [];
        if (verdict.known) {
          loginList.push(now);
          loginFailures.set(username, loginList);
        }
        const sourceList = prune(sourceFailures, source, now);
        sourceList.push(now);
        sourceFailures.set(source, sourceList);
        const failures = (connFailures.get(session) || 0) + 1;
        connFailures.set(session, failures);
        const throttled = loginList.length > 10 || sourceList.length > 10;
        if (throttled) await new Promise((resolve) => setTimeout(resolve, AUTH_DELAY_MS));
        done(smtpError(throttled ? 454 : 535, throttled ? 'temporary authentication failure' : 'authentication failed'));
        if (failures >= 3) {
          const conn = connBySession.get(session);
          if (conn) conn.close();
        }
      } catch {
        done(smtpError(451, 'authentication failed'));
      }
    },
    async onMailFrom(parsed, session, callback) {
      const done = once(callback);
      // One snapshot for the whole transaction, including a wait for a slot.
      const shot = snapshot;
      const login = loginOf(session);
      const record = shot.ok ? (shot.logins.find((row) => row.login === login) || null) : null;
      const domain = record ? record.domain : '-';
      const address = parsed && typeof parsed.address === 'string' ? parsed.address : '';
      const args = parsed && parsed.args && typeof parsed.args === 'object' ? parsed.args : {};
      const binding = session.relayBinding;
      if (!record || !binding || binding.domain !== record.domain || binding.sha256 !== record.sha256) {
        logAttempt(login, domain, 'refused:550');
        done(smtpError(550, 'message refused'));
        return;
      }
      if (Object.keys(args).some((key) => key !== 'SIZE')) {
        logAttempt(login, domain, 'refused:555');
        done(smtpError(555, 'parameter not supported'));
        return;
      }
      const mailbox = address ? parseMailbox(address, record.domain) : { ok: false };
      if (!mailbox.ok) {
        logAttempt(login, domain, 'refused:553');
        done(smtpError(553, 'sender rejected'));
        return;
      }
      if (observeState() !== 'send') {
        logAttempt(login, domain, 'held');
        done(smtpError(451, 'sending held'));
        return;
      }
      const upstreamRow = shot.upstreams.find((row) => row.name === record.upstream) || null;
      if (!upstreamRow || !upstreamRow.token) {
        logAttempt(login, domain, 'refused:451');
        done(smtpError(451, 'upstream not configured'));
        return;
      }
      let holding = false;
      let upstream = null;
      let tx = null;
      let abandoned = false;
      let transactionTimer = null;
      const opening = { aborted: false, socket: null };
      try {
        const acquired = await acquireSlot(session);
        if (!acquired) return;
        holding = true;
        const started = Date.now();
        transactionTimer = setTimeout(() => {
          abandoned = true;
          if (tx) {
            expireOpen(tx);
            return;
          }
          opening.aborted = true;
          if (opening.socket && !opening.socket.destroyed) opening.socket.destroy();
          if (upstream && !upstream.didClose) upstream.destroy();
          upstream = null;
          const closed = opening.closed || Promise.resolve();
          Promise.resolve(closed).finally(() => {
            if (holding) {
              releaseSlot();
              holding = false;
            }
            const conn = connBySession.get(session);
            try {
              if (conn && conn._socket) conn._socket.destroy();
            } catch {
              // already gone
            }
          });
        }, timeouts.transaction);
        if (session.relayClosed) {
          clearTimeout(transactionTimer);
          releaseSlot();
          holding = false;
          return;
        }
        if (observeState() !== 'send') {
          clearTimeout(transactionTimer);
          releaseSlot();
          holding = false;
          logAttempt(login, domain, 'held');
          done(smtpError(451, 'sending held'));
          return;
        }
        const remain = () => Math.max(1, timeouts.transaction - (Date.now() - started));
        const cap = (limit) => Math.min(limit, remain());
        upstream = await connectUpstream(
          upstreamRow,
          timeouts,
          extraCa,
          opening,
          // Open and close times are kept only when a test asks, so a long-lived
          // relay keeps no per-connection record.
          options.recordUpstreams !== true ? null : (socket) => {
            const index = upstreamAt.length;
            upstreamAt.push(Number(process.hrtime.bigint()));
            upstreamClosedAt.push(0);
            socket.once('close', () => {
              upstreamClosedAt[index] = Number(process.hrtime.bigint());
            });
          }
        );
        if (abandoned) return;
        const greeting = await upstream.readReply(cap(timeouts.greeting));
        if (abandoned) return;
        if (greeting.code < 200 || greeting.code >= 300) throw new Error('greeting');
        const ehlo = await upstream.command('EHLO smtp-relay', cap(timeouts.command));
        if (abandoned) return;
        if (ehlo.code < 200 || ehlo.code >= 300) throw new Error('ehlo');
        const payload = Buffer.from(`\0${upstreamRow.user}\0${upstreamRow.token}`, 'utf8').toString('base64');
        const authReply = await upstream.command(`AUTH PLAIN ${payload}`, cap(timeouts.command));
        if (abandoned) return;
        if (authReply.code !== 235) throw new Error('upstream auth');
        const mail = await upstream.command(`MAIL FROM:<${address}>`, cap(timeouts.command));
        if (abandoned) return;
        if (mail.code < 200 || mail.code >= 300) {
          throw Object.assign(new Error('upstream mail'), { smtpCode: mail.code });
        }
        upstream.mailAccepted = true;
        if (session.relayClosed) {
          // The client left while the upstream session opened. onClose has
          // already run and found no transaction, so this path frees both
          // once the upstream socket has closed.
          logAttempt(login, domain, 'incomplete');
          clearTimeout(transactionTimer);
          const closed = upstream.whenClosed();
          if (upstream.canReset()) upstream.shutdown();
          else upstream.destroy();
          upstream = null;
          await closed;
          if (holding) releaseSlot();
          holding = false;
          return;
        }
        tx = {
          session,
          conn: connBySession.get(session),
          login,
          domain,
          upstream,
          sessionId: upstream.sessionId,
          rcptCommands: 0,
          rcptAccepted: 0,
          bytes: 0,
          messageId: '',
          intentId: '',
          dotSent: false,
          replyRelayed: false,
          clientAnswered: false,
          finished: false,
          logged: false,
          holdsSlot: true,
          started,
          deadline: null,
          transactionTimer,
          sender: address
        };
        tx.onClientReset = () => {
          if (halted(tx)) return;
          recordTerminal(tx, 'incomplete');
          dropUpstream(tx, true);
          finish(tx);
        };
        txBySession.set(session, tx);
        live.add(tx);
        holding = false;
        if (abandoned || tx.finished) return;
        done();
      } catch (error) {
        clearTimeout(transactionTimer);
        if (tx && !tx.finished) {
          dropUpstream(tx, true);
          finish(tx);
        } else if (upstream) {
          const closed = upstream.whenClosed();
          if (!upstream.didClose) upstream.destroy();
          if (!abandoned) await closed;
          upstream = null;
        } else if (opening.closed && !abandoned) {
          if (opening.socket && !opening.socket.destroyed) opening.socket.destroy();
          await opening.closed;
        }
        if (holding && !abandoned) releaseSlot();
        if (abandoned) return;
        const code = error && error.smtpCode && error.smtpCode >= 400 ? error.smtpCode : 451;
        logAttempt(login, domain, `refused:${code}`);
        done(smtpError(code, error && error.clientMessage ? error.clientMessage : 'upstream unavailable'));
      }
    },
    async onRcptTo(parsed, session, callback) {
      const done = once(callback);
      const tx = txBySession.get(session);
      if (!tx || tx.finished) {
        done(smtpError(503, 'no transaction'));
        return;
      }
      if (tx.rcptCommands > MAX_RECIPIENTS) {
        done(smtpError(452, 'too many recipients'));
        return;
      }
      const address = parsed && typeof parsed.address === 'string' ? parsed.address : '';
      if (!address || /[\r\n]/.test(address)) {
        done(smtpError(501, 'bad recipient'));
        return;
      }
      try {
        const remain = Math.max(1, timeouts.transaction - (Date.now() - tx.started));
        const reply = await tx.upstream.command(`RCPT TO:<${address}>`, Math.min(timeouts.command, remain));
        if (reply.code >= 200 && reply.code < 300) {
          tx.rcptAccepted += 1;
          done();
          return;
        }
        const code = reply.code >= 400 && reply.code <= 599 ? reply.code : 450;
        done(smtpError(code, 'recipient refused'));
      } catch {
        if (!tx.finished) done(smtpError(451, 'upstream unavailable'));
      }
    },
    onData(stream, session, callback) {
      const done = once(callback);
      const tx = txBySession.get(session);
      if (!tx || tx.finished) {
        done(smtpError(503, 'no transaction'));
        return;
      }
      const chunks = [];
      let total = 0;
      let over = false;
      tx.deadline = setTimeout(() => {
        if (tx.finished) return;
        tx.deadlineFired = true;
        expireOpen(tx);
      }, timeouts.dataDeadline);

      stream.on('data', (chunk) => {
        total += chunk.length;
        tx.bytes = total;
        if (over) return;
        if (total > MAX_BYTES) {
          over = true;
          chunks.length = 0;
          return;
        }
        chunks.push(chunk);
      });
      stream.on('error', () => {
        if (halted(tx) || tx.dotSent) return;
        recordTerminal(tx, 'incomplete');
        dropUpstream(tx, true);
        finish(tx);
      });
      stream.on('end', () => {
        if (tx.finished || tx.deadlineFired) return;
        finishData().catch(async () => {
          if (halted(tx)) return;
          recordTerminal(tx, 'refused:451');
          const closed = dropUpstream(tx, !tx.dotSent);
          if (closed) await closed;
          finish(tx);
          if (!tx.expiring) done(smtpError(451, 'upstream unavailable'));
        });
      });

      async function endUpstream(rset) {
        const closed = dropUpstream(tx, rset);
        if (closed) await closed;
      }

      function refuse(outcome, code, message, rset) {
        if (halted(tx)) return;
        recordTerminal(tx, outcome);
        return endUpstream(rset).then(() => {
          finish(tx);
          if (!tx.expiring) done(smtpError(code, message));
        });
      }

      async function finishData() {
        if (halted(tx)) return;
        if (tx.rcptCommands > tx.rcptAccepted) {
          await refuse('incomplete', 554, 'transaction incomplete', true);
          return;
        }
        if (over || total > MAX_BYTES) {
          await refuse('refused:552', 552, 'message exceeds limit', true);
          return;
        }
        const body = Buffer.concat(chunks);
        const headers = inspectHeaders(body, tx.domain);
        if (!headers.ok) {
          await refuse('refused:550', 550, 'message refused', true);
          return;
        }
        tx.messageId = headers.messageId;
        if (halted(tx)) return;
        const remain = Math.max(1, timeouts.transaction - (Date.now() - tx.started));
        const opened = await tx.upstream.command('DATA', Math.min(timeouts.command, remain));
        if (halted(tx)) return;
        if (opened.code === 354) tx.upstream.inData = true;
        if (opened.code !== 354) {
          const code = opened.code >= 400 ? opened.code : 451;
          await refuse(`refused:${opened.code}`, code, 'upstream unavailable', true);
          return;
        }
        const intentId = randomBytes(8).toString('hex');
        tx.intentId = intentId;
        await journal.append([
          'intent',
          `id=${intentId}`,
          `login=${logToken(tx.login)}`,
          `domain=${logToken(tx.domain)}`,
          `recipients=${tx.rcptAccepted}`,
          `bytes=${tx.bytes}`,
          `message_id=${messageIdToken(tx.messageId)}`,
          `time=${new Date().toISOString()}`,
          `session=${tx.sessionId}`
        ].join(' '));
        if (halted(tx)) return;
        const wire = dotStuff(body);
        // From here the final dot may reach the upstream, so a deadline or a
        // close is ambiguous, not incomplete, even before the write returns.
        tx.dotSent = true;
        tx.upstream.dotSent = true;
        try {
          await new Promise((resolve, reject) => {
            tx.upstream.socket.write(wire, (error) => (error ? reject(error) : resolve()));
          });
        } catch {
          if (halted(tx)) return;
          recordTerminal(tx, 'ambiguous');
          await endUpstream(false);
          finish(tx);
          if (!tx.expiring) done(smtpError(451, 'upstream outcome unknown'));
          return;
        }
        if (halted(tx)) return;
        let finalReply;
        try {
          const left = Math.max(1, timeouts.transaction - (Date.now() - tx.started));
          finalReply = await tx.upstream.readReply(Math.min(timeouts.dataReply, left));
        } catch {
          if (halted(tx)) return;
          recordTerminal(tx, 'ambiguous');
          await endUpstream(false);
          finish(tx);
          if (!tx.expiring) done(smtpError(451, 'upstream outcome unknown'));
          return;
        }
        if (halted(tx)) return;
        clearTimeout(tx.deadline);
        clearTimeout(tx.transactionTimer);
        if (halted(tx)) return;
        if (typeof options.beforeClientReply === 'function') {
          try {
            options.beforeClientReply(tx);
          } catch {
            // The hook only arranges the socket state the check below reads.
          }
        }
        if (halted(tx)) return;
        const clientSocket = tx.conn && tx.conn._socket;
        const canAnswer = Boolean(clientSocket && !clientSocket.destroyed && clientSocket.writable);
        const upstreamText = String(finalReply.text || 'OK').replace(/[^\x20-\x7e]/g, ' ').trim().slice(0, 200);
        if (!canAnswer) {
          recordTerminal(tx, 'ambiguous');
          finishAfterUpstream(tx);
          return;
        }
        // Detach before the callback. smtp-server accepts the next command on
        // this connection as soon as the callback returns, and a later finish
        // must not delete that next transaction.
        detachTx(tx);
        tx.clientAnswered = true;
        tx.answerAttempted = true;
        const accepted = finalReply.code >= 200 && finalReply.code < 300;
        if (accepted) done(null, upstreamText || 'OK');
        else done(smtpError(finalReply.code, 'message refused'));
        tx.replyRelayed = true;
        const outcome = accepted ? 'sent' : `refused:${finalReply.code}`;
        observeReplyWrite(tx, clientSocket, outcome);
      }
    },
    onClose(session) {
      session.relayClosed = true;
      if (cancelWaiter(session)) return;
      const tx = txBySession.get(session);
      if (!tx || tx.finished || tx.terminal || tx.expiring) return;
      if (tx.clientAnswered || tx.replyRelayed) {
        recordTerminal(tx, 'ambiguous');
        finishAfterUpstream(tx);
        return;
      }
      const ambiguous = tx.dotSent && !tx.replyRelayed;
      recordTerminal(tx, ambiguous ? 'ambiguous' : 'incomplete');
      destroyClient(tx);
      const closed = dropUpstream(tx, !tx.dotSent);
      Promise.resolve(closed).finally(() => finish(tx));
    }
  });

  server.on('error', () => {
    // A client that disconnects is a transaction event, not a process failure.
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const address = server.server.address();
  writeLog(`listening port=${address.port}`);

  statusTimer = setInterval(() => {
    observeControl();
    publishStatus(true);
  }, statusInterval);
  if (typeof statusTimer.unref === 'function') statusTimer.unref();

  async function close() {
    if (statusTimer) clearInterval(statusTimer);
    for (const waiter of [...waiters]) {
      const session = waiter.session;
      cancelWaiter(session);
      const conn = connBySession.get(session);
      try {
        if (conn && conn._socket) conn._socket.destroy();
      } catch {
        // already gone
      }
    }
    for (const tx of [...live]) {
      dropUpstream(tx, !tx.dotSent);
      try {
        if (tx.conn && tx.conn._socket) tx.conn._socket.destroy();
      } catch {
        // already gone
      }
      finish(tx);
    }
    for (const connection of server.connections) {
      try {
        if (connection._socket) connection._socket.destroy();
      } catch {
        // already gone
      }
    }
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 500);
      server.close(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  return {
    port: address.port,
    host,
    logs,
    journalPath: journalFile,
    close,
    reload,
    authPeak: () => authPeak,
    resetAuthPeak: () => {
      authPeak = 0;
    },
    failureKeys() {
      return { logins: loginFailures.size, sources: sourceFailures.size };
    },
    upstreamAt,
    upstreamClosedAt,
    forceStatus() {
      publishStatus(true);
      return statusSeq;
    },
    statusQueue() {
      return { writing: statusWriting ? 1 : 0, pending: statusPending === null ? 0 : 1 };
    }
  };
}

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (invokedDirectly()) {
  let relay = null;
  process.on('SIGHUP', () => {
    if (!relay) return;
    try {
      relay.reload();
    } catch {
      process.stdout.write('config hash=- status=refused logins=0 upstreams=0\n');
    }
  });
  const stop = () => {
    if (!relay) {
      process.exit(0);
      return;
    }
    relay.close().then(() => process.exit(0), () => process.exit(0));
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  startRelay(process.env)
    .then((value) => {
      relay = value;
      process.stdout.write('ready signals=hup\n');
    })
    .catch((error) => {
      process.stderr.write(`relay: ${error.message}\n`);
      process.exit(1);
    });
}
