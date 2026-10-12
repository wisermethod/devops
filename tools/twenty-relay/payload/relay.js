/**
 * Mail relay. It listens for authenticated SMTP and mirrors each accepted
 * transaction to one upstream over TLS. Paths and timeouts come from the
 * environment so a test can run the same program on another machine.
 *
 * RELAY_CONF       directory of logins.json, upstreams.json and state (default /conf)
 * RELAY_SECRETS    directory of <upstream>.token files (default /secrets)
 * RELAY_JOURNAL    journal file, or a directory that holds the file journal (default /journal)
 * RELAY_PORT       default 2525
 * RELAY_HOST       default 0.0.0.0
 * RELAY_CONNECT_TIMEOUT_MS, RELAY_GREETING_TIMEOUT_MS, RELAY_COMMAND_TIMEOUT_MS,
 * RELAY_DATA_REPLY_TIMEOUT_MS, RELAY_TRANSACTION_TIMEOUT_MS,
 * RELAY_IDLE_TIMEOUT_MS, RELAY_DATA_DEADLINE_MS
 * RELAY_EXTRA_CA   PEM appended to the default trust store. Unset in production,
 *                  so verification stays Node's default. Tests set it because
 *                  NODE_EXTRA_CA_CERTS is read only at process start.
 * RELAY_AUTH_SLOT_DELAY_MS  test-only pause inside an AUTH check. Default 0.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { open, mkdir, readFile, rename, stat } from 'node:fs/promises';
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
  const names = cleanUp.map((row) => row.name).sort();
  for (const name of names) {
    try {
      const bytes = readFileSync(tokenName(secretsDir, name));
      tokenDigests[name] = createHash('sha256').update(bytes).digest('hex');
    } catch {
      tokenDigests[name] = 'missing';
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
    upstreams: cleanUp
  };
}

function readToken(file) {
  try {
    const text = readFileSync(file, 'utf8').replace(/\s+$/, '');
    if (text.length === 0) return null;
    return text;
  } catch {
    return null;
  }
}

function readStateWord(file) {
  try {
    const bytes = readFileSync(file);
    return bytes.equals(Buffer.from('send')) ? 'send' : 'hold';
  } catch {
    return 'hold';
  }
}

function logToken(value) {
  const clean = String(value ?? '').replace(/[^A-Za-z0-9_.:@=+/-]/g, '').slice(0, 120);
  return clean || '-';
}

function messageIdToken(value) {
  const clean = String(value ?? '').replace(/[\r\n\t ]+/g, '').slice(0, 200);
  return clean || '-';
}

function dotStuff(body) {
  const pieces = [];
  let start = 0;
  if (body.length > 0 && body[0] === 0x2e) pieces.push(Buffer.from('.'));
  for (let i = 0; i < body.length - 1; i += 1) {
    if (body[i] === 0x0a && body[i + 1] === 0x2e) {
      pieces.push(body.subarray(start, i + 1));
      pieces.push(Buffer.from('.'));
      start = i + 1;
    }
  }
  pieces.push(body.subarray(start));
  let stuffed = Buffer.concat(pieces);
  if (stuffed.length < 2 || stuffed[stuffed.length - 2] !== 0x0d || stuffed[stuffed.length - 1] !== 0x0a) {
    stuffed = Buffer.concat([stuffed, Buffer.from('\r\n')]);
  }
  return Buffer.concat([stuffed, Buffer.from('.\r\n')]);
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
    this.sessionId = randomBytes(8).toString('hex');
    socket.setEncoding('latin1');
    socket.on('data', (chunk) => {
      this.buf += chunk;
      this._drain();
    });
    socket.on('error', (error) => this._failAll(error));
    socket.on('close', () => this._failAll(new Error('upstream closed')));
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
    while (this.queue.length) {
      const waiter = this.queue[0];
      let splitAt = this.buf.indexOf('\n');
      if (splitAt < 0) return;
      while (splitAt >= 0) {
        let line = this.buf.slice(0, splitAt);
        this.buf = this.buf.slice(splitAt + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
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

  async rset() {
    if (this.closed || this.dotSent || this.inData || !this.mailAccepted) {
      this.destroy();
      return;
    }
    try {
      this.writeLine('RSET');
      await this.readReply(this.timeouts.command);
    } catch {
      // The upstream is going away either way.
    }
    this.destroy();
  }
}

function connectUpstream(upstream, timeouts, extraCa) {
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

function createJournal(file) {
  let chain = Promise.resolve();
  async function writeLine(line) {
    if (/[\r\n]/.test(line)) throw new Error('journal line');
    await mkdir(path.dirname(file), { recursive: true });
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
    await rename(file, `${file}.1`);
    if (kept.length === 0) return;
    const handle = await open(file, 'w');
    try {
      await handle.write(`${kept.join('\n')}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  function append(line) {
    const run = chain.then(() => writeLine(line));
    chain = run.then(() => undefined, () => undefined);
    return run;
  }
  async function reconcile() {
    await mkdir(path.dirname(file), { recursive: true });
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

export async function startRelay(env = process.env) {
  installCommandWraps();
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
  const extraCa = env.RELAY_EXTRA_CA || '';
  const authSlotDelay = env.RELAY_AUTH_SLOT_DELAY_MS ? Number(env.RELAY_AUTH_SLOT_DELAY_MS) : 0;
  const stateFile = path.join(confDir, 'state');
  const logs = [];
  const journal = createJournal(journalFile);
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

  function writeLog(line) {
    logs.push(line);
    process.stdout.write(`${line}\n`);
  }

  function logInflight() {
    writeLog(`inflight count=${inflight}`);
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

  function findUpstream(name) {
    if (!snapshot.ok) return null;
    return snapshot.upstreams.find((row) => row.name === name) || null;
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

  function finish(tx) {
    if (!tx || tx.finished) return false;
    tx.finished = true;
    clearTimeout(tx.deadline);
    live.delete(tx);
    txBySession.delete(tx.session);
    if (tx.holdsSlot) {
      tx.holdsSlot = false;
      releaseSlot();
    }
    return true;
  }

  function closeIntent(tx, outcome) {
    if (!tx.intentId || tx.intentClosed) return;
    tx.intentClosed = true;
    journal.append(`done id=${tx.intentId} outcome=${outcome}`).catch(() => {
      // The intent stays open, and a restart counts it ambiguous.
    });
  }

  async function markAmbiguous(tx) {
    if (tx.ambiguousMarked) return;
    tx.ambiguousMarked = true;
    logTx(tx, 'ambiguous', tx.sessionId);
    if (tx.intentId) {
      try {
        await journal.append(`done id=${tx.intentId} outcome=ambiguous`);
      } catch {
        // The intent line is already durable. The restart marks it again.
      }
    }
  }

  function dropUpstream(tx, sendRset) {
    const upstream = tx.upstream;
    if (!upstream) return;
    tx.upstream = null;
    if (sendRset && !upstream.dotSent) upstream.rset().catch(() => upstream.destroy());
    else upstream.destroy();
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
          return { ok: record !== null && hashesEqual(actual, expected), known: record !== null };
        });
        if (verdict.ok) {
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
      const login = loginOf(session);
      const record = findLogin(login);
      const domain = record ? record.domain : '-';
      const address = parsed && typeof parsed.address === 'string' ? parsed.address : '';
      const args = parsed && parsed.args && typeof parsed.args === 'object' ? parsed.args : {};
      if (!record) {
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
      if (readStateWord(stateFile) !== 'send') {
        logAttempt(login, domain, 'held');
        done(smtpError(451, 'sending held'));
        return;
      }
      const upstreamRow = findUpstream(record.upstream);
      if (!upstreamRow || !readToken(upstreamRow.token_file)) {
        logAttempt(login, domain, 'refused:451');
        done(smtpError(451, 'upstream not configured'));
        return;
      }
      let holding = false;
      let upstream = null;
      try {
        const acquired = await acquireSlot(session);
        if (!acquired) return;
        holding = true;
        if (session.relayClosed) {
          releaseSlot();
          holding = false;
          return;
        }
        if (readStateWord(stateFile) !== 'send') {
          releaseSlot();
          holding = false;
          logAttempt(login, domain, 'held');
          done(smtpError(451, 'sending held'));
          return;
        }
        const token = readToken(upstreamRow.token_file);
        if (!token) {
          releaseSlot();
          holding = false;
          logAttempt(login, domain, 'refused:451');
          done(smtpError(451, 'upstream not configured'));
          return;
        }
        const started = Date.now();
        const remain = () => Math.max(1, timeouts.transaction - (Date.now() - started));
        const cap = (limit) => Math.min(limit, remain());
        upstream = await connectUpstream(upstreamRow, { ...timeouts, connect: cap(timeouts.connect) }, extraCa);
        const greeting = await upstream.readReply(cap(timeouts.greeting));
        if (greeting.code < 200 || greeting.code >= 300) throw new Error('greeting');
        const ehlo = await upstream.command('EHLO smtp-relay', cap(timeouts.command));
        if (ehlo.code < 200 || ehlo.code >= 300) throw new Error('ehlo');
        const fresh = readToken(upstreamRow.token_file);
        if (!fresh) throw Object.assign(new Error('token'), { code: 451, clientMessage: 'upstream not configured' });
        const payload = Buffer.from(`\0${upstreamRow.user}\0${fresh}`, 'utf8').toString('base64');
        const authReply = await upstream.command(`AUTH PLAIN ${payload}`, cap(timeouts.command));
        if (authReply.code !== 235) throw new Error('upstream auth');
        const mail = await upstream.command(`MAIL FROM:<${address}>`, cap(timeouts.command));
        if (mail.code < 200 || mail.code >= 300) {
          throw Object.assign(new Error('upstream mail'), { smtpCode: mail.code });
        }
        upstream.mailAccepted = true;
        if (session.relayClosed) {
          // The client left while the upstream session opened. onClose has
          // already run and found no transaction, so this path frees both.
          logAttempt(login, domain, 'incomplete');
          upstream.rset().catch(() => upstream.destroy());
          upstream = null;
          releaseSlot();
          holding = false;
          return;
        }
        const tx = {
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
          finished: false,
          logged: false,
          holdsSlot: true,
          started,
          deadline: null,
          sender: address
        };
        tx.onClientReset = () => {
          logTx(tx, 'incomplete', tx.sessionId);
          dropUpstream(tx, true);
          finish(tx);
        };
        txBySession.set(session, tx);
        live.add(tx);
        holding = false;
        done();
      } catch (error) {
        if (upstream) upstream.destroy();
        if (holding) releaseSlot();
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
        if (tx.dotSent && !tx.replyRelayed) {
          markAmbiguous(tx).finally(() => {
            dropUpstream(tx, false);
            try {
              if (tx.conn && tx.conn._socket) tx.conn._socket.destroy();
            } catch {
              // already gone
            }
            finish(tx);
          });
          return;
        }
        logTx(tx, 'incomplete', tx.sessionId);
        closeIntent(tx, 'incomplete');
        dropUpstream(tx, true);
        try {
          if (tx.conn && tx.conn._socket) tx.conn._socket.destroy();
        } catch {
          // already gone
        }
        finish(tx);
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
        if (tx.finished || tx.dotSent) return;
        logTx(tx, 'incomplete', tx.sessionId);
        dropUpstream(tx, true);
        finish(tx);
      });
      stream.on('end', () => {
        if (tx.finished || tx.deadlineFired) return;
        finishData().catch(() => {
          if (!tx.finished) {
            logTx(tx, 'refused:451', tx.sessionId);
            dropUpstream(tx, !tx.dotSent);
            finish(tx);
            done(smtpError(451, 'upstream unavailable'));
          }
        });
      });

      async function endUpstream(rset) {
        const upstream = tx.upstream;
        tx.upstream = null;
        if (!upstream) return;
        if (rset && !upstream.dotSent) await upstream.rset().catch(() => upstream.destroy());
        else upstream.destroy();
      }

      async function finishData() {
        if (tx.finished) return;
        if (tx.rcptCommands > tx.rcptAccepted) {
          logTx(tx, 'incomplete', tx.sessionId);
          await endUpstream(true);
          finish(tx);
          done(smtpError(554, 'transaction incomplete'));
          return;
        }
        if (over || total > MAX_BYTES) {
          logTx(tx, 'refused:552', tx.sessionId);
          await endUpstream(true);
          finish(tx);
          done(smtpError(552, 'message exceeds limit'));
          return;
        }
        const body = Buffer.concat(chunks);
        const headers = inspectHeaders(body, tx.domain);
        if (!headers.ok) {
          logTx(tx, 'refused:550', tx.sessionId);
          await endUpstream(true);
          finish(tx);
          done(smtpError(550, 'message refused'));
          return;
        }
        tx.messageId = headers.messageId;
        if (tx.finished) return;
        const remain = Math.max(1, timeouts.transaction - (Date.now() - tx.started));
        const opened = await tx.upstream.command('DATA', Math.min(timeouts.command, remain));
        if (tx.finished) return;
        if (opened.code === 354) tx.upstream.inData = true;
        if (opened.code !== 354) {
          logTx(tx, `refused:${opened.code}`, tx.sessionId);
          await endUpstream(true);
          finish(tx);
          done(smtpError(opened.code >= 400 ? opened.code : 451, 'upstream unavailable'));
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
        if (tx.finished) return;
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
          await markAmbiguous(tx);
          await endUpstream(false);
          finish(tx);
          done(smtpError(451, 'upstream outcome unknown'));
          return;
        }
        let finalReply;
        try {
          const left = Math.max(1, timeouts.transaction - (Date.now() - tx.started));
          finalReply = await tx.upstream.readReply(Math.min(timeouts.dataReply, left));
        } catch {
          if (tx.finished) return;
          await markAmbiguous(tx);
          await endUpstream(false);
          finish(tx);
          done(smtpError(451, 'upstream outcome unknown'));
          return;
        }
        if (tx.finished) return;
        tx.replyRelayed = true;
        const outcome = finalReply.code >= 200 && finalReply.code < 300
          ? 'sent'
          : `refused:${finalReply.code}`;
        logTx(tx, outcome, tx.sessionId);
        try {
          await journal.append(`done id=${intentId} outcome=${outcome}`);
        } catch {
          // The intent line is durable, so a restart counts this one ambiguous,
          // which overstates and never hides an outcome.
        }
        const upstreamText = String(finalReply.text || 'OK').replace(/[^\x20-\x7e]/g, ' ').trim().slice(0, 200);
        await endUpstream(false);
        finish(tx);
        if (finalReply.code >= 200 && finalReply.code < 300) done(null, upstreamText || 'OK');
        else done(smtpError(finalReply.code, 'message refused'));
      }
    },
    onClose(session) {
      session.relayClosed = true;
      if (cancelWaiter(session)) return;
      const tx = txBySession.get(session);
      if (!tx || tx.finished) return;
      if (tx.dotSent && !tx.replyRelayed) {
        markAmbiguous(tx).finally(() => {
          dropUpstream(tx, false);
          finish(tx);
        });
        return;
      }
      if (!tx.logged) logTx(tx, 'incomplete', tx.sessionId);
      closeIntent(tx, 'incomplete');
      dropUpstream(tx, !tx.dotSent);
      finish(tx);
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

  async function close() {
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
