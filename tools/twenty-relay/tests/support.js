import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

import { hashPassword } from '../payload/relay.js';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function makeCerts(dir = mkdtempSync(path.join(tmpdir(), 'twenty-relay-ca-'))) {
  mkdirSync(dir, { recursive: true });
  const ca = issueCa(dir, 'ca', 'TestCA');
  const other = issueCa(dir, 'ca2', 'OtherCA');
  return {
    dir,
    caPem: readFileSync(ca.pem, 'utf8'),
    otherCaPem: readFileSync(other.pem, 'utf8'),
    good: issueLeaf(dir, 'good', 'IP:127.0.0.1', ca),
    wrongHost: issueLeaf(dir, 'wrong', 'DNS:wrong.example', ca),
    untrusted: issueLeaf(dir, 'untrusted', 'IP:127.0.0.1', other)
  };
}

function issueCa(dir, name, cn) {
  const cnf = path.join(dir, `${name}.cnf`);
  const key = path.join(dir, `${name}.key`);
  const pem = path.join(dir, `${name}.pem`);
  writeFileSync(cnf, `[req]
distinguished_name=dn
x509_extensions=v3_ca
prompt=no
[dn]
CN=${cn}
[v3_ca]
basicConstraints=critical,CA:TRUE
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
`);
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-keyout', key, '-out', pem,
    '-days', '2', '-nodes', '-config', cnf, '-extensions', 'v3_ca'
  ], { stdio: 'pipe' });
  return { key, pem, cnf };
}

function issueLeaf(dir, name, san, ca) {
  const cnf = path.join(dir, `${name}.cnf`);
  const key = path.join(dir, `${name}.key`);
  const csr = path.join(dir, `${name}.csr`);
  const crt = path.join(dir, `${name}.crt`);
  writeFileSync(cnf, `[req]
distinguished_name=dn
prompt=no
req_extensions=v3
[dn]
CN=${name}
[v3]
basicConstraints=CA:FALSE
extendedKeyUsage=serverAuth
keyUsage=digitalSignature,keyEncipherment
subjectAltName=${san}
`);
  execFileSync('openssl', [
    'req', '-newkey', 'rsa:2048', '-keyout', key, '-out', csr, '-nodes', '-config', cnf
  ], { stdio: 'pipe' });
  execFileSync('openssl', [
    'x509', '-req', '-in', csr, '-CA', ca.pem, '-CAkey', ca.key, '-CAcreateserial',
    '-out', crt, '-days', '2', '-extfile', cnf, '-extensions', 'v3'
  ], { stdio: 'pipe' });
  return { key: readFileSync(key), cert: readFileSync(crt) };
}

export function rfc822(headers, body = 'hello', sep = '\r\n') {
  const text = `${headers.join(sep)}${sep}${sep}${body}`;
  return text.endsWith(sep) ? text : `${text}${sep}`;
}

export function plain(user, pass) {
  return Buffer.from(`\0${user}\0${pass}`, 'utf8').toString('base64');
}

export function unstuff(payload) {
  const text = Buffer.isBuffer(payload) ? payload.toString('latin1') : String(payload);
  return text.split('\r\n').map((line) => (line.startsWith('.') ? line.slice(1) : line)).join('\r\n');
}

export function waitFor(predicate, timeout = 2000, label = 'condition') {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      Promise.resolve()
        .then(predicate)
        .then((value) => {
          if (value) {
            resolve(value);
            return;
          }
          if (Date.now() - start >= timeout) {
            reject(new Error(`timed out waiting for ${label}`));
            return;
          }
          setTimeout(tick, 15);
        })
        .catch((error) => reject(error));
    };
    tick();
  });
}

export function lanHost() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return '';
}

export function stuff(payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
  const chunks = [];
  if (body.length > 0 && body[0] === 0x2e) chunks.push(Buffer.from('.'));
  let start = 0;
  for (let i = 0; i < body.length - 1; i += 1) {
    if (body[i] === 0x0a && body[i + 1] === 0x2e) {
      chunks.push(body.subarray(start, i + 1));
      chunks.push(Buffer.from('.'));
      start = i + 1;
    }
  }
  chunks.push(body.subarray(start));
  let stuffed = Buffer.concat(chunks);
  if (stuffed.length < 2 || stuffed[stuffed.length - 2] !== 0x0d || stuffed[stuffed.length - 1] !== 0x0a) {
    stuffed = Buffer.concat([stuffed, Buffer.from('\r\n')]);
  }
  return Buffer.concat([stuffed, Buffer.from('.\r\n')]);
}

export function connectSmtp(port, options = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({
      host: options.host || '127.0.0.1',
      port,
      localAddress: options.localAddress
    });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('smtp connect timeout'));
    }, options.connectTimeout ?? 5000);
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.removeAllListeners('error');
      resolve(wrapSmtp(socket));
    });
  });
}

function wrapSmtp(socket) {
  let buf = '';
  const waiters = [];
  let closed = false;
  socket.setEncoding('latin1');
  socket.on('error', () => {});
  socket.on('data', (chunk) => {
    buf += chunk;
    pump();
  });
  socket.on('close', () => {
    closed = true;
    while (waiters.length) {
      const waiter = waiters.shift();
      clearTimeout(waiter.timer);
      waiter.reject(Object.assign(new Error('smtp connection closed'), { code: 'CLOSED' }));
    }
  });

  function take() {
    const lines = [];
    while (true) {
      const nl = buf.indexOf('\n');
      if (nl < 0) return null;
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      lines.push(line);
      const matched = /^(\d{3})([ -])(.*)$/.exec(line);
      if (!matched) return { code: 0, text: line, lines, raw: lines.join('\n') };
      if (matched[2] === ' ') {
        return { code: Number(matched[1]), text: matched[3], lines, raw: lines.join('\n') };
      }
    }
  }

  function pump() {
    while (waiters.length) {
      const reply = take();
      if (!reply) return;
      const waiter = waiters.shift();
      clearTimeout(waiter.timer);
      waiter.resolve(reply);
    }
  }

  function read(timeout = 5000) {
    const ready = take();
    if (ready) return Promise.resolve(ready);
    if (closed) return Promise.reject(Object.assign(new Error('smtp connection closed'), { code: 'CLOSED' }));
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error('smtp read timeout'));
      }, timeout);
      waiters.push(waiter);
      pump();
    });
  }

  return {
    socket,
    read,
    write(line) {
      socket.write(`${line}\r\n`);
    },
    cmd(line, timeout) {
      this.write(line);
      return this.read(timeout);
    },
    writeBytes(bytes) {
      return new Promise((resolve, reject) => {
        socket.write(bytes, (error) => (error ? reject(error) : resolve()));
      });
    },
    destroy() {
      socket.destroy();
    },
    closed() {
      return new Promise((resolve) => {
        if (closed || socket.destroyed) {
          resolve();
          return;
        }
        socket.once('close', () => resolve());
      });
    }
  };
}

export async function sendData(client, payload, timeout = 5000) {
  const opened = await client.cmd('DATA', timeout);
  if (opened.code !== 354) return opened;
  await client.writeBytes(stuff(payload));
  return client.read(timeout);
}

export function startMock({ cert, key, behavior = 'accept', closeDelay = 500 }) {
  const sessions = [];
  const sockets = [];
  const state = { behavior, closeDelay };
  let handshakes = 0;
  let live = 0;
  let peak = 0;
  if (behavior === 'stall-handshake') {
    const server = net.createServer((socket) => {
      sockets.push(socket);
      socket.on('error', () => {});
      // Without a reader the handshake bytes sit unread and this socket never
      // reports close after the client is destroyed.
      socket.resume();
      const session = {
        commands: [],
        auth: '',
        raw: Buffer.alloc(0),
        data: null,
        dotSeen: false,
        rcptCount: 0,
        closed: false,
        openedAt: Number(process.hrtime.bigint()),
        closedAt: 0
      };
      sessions.push(session);
      live += 1;
      if (live > peak) peak = live;
      socket.on('close', () => {
        session.closed = true;
        session.closedAt = Number(process.hrtime.bigint());
        live -= 1;
      });
    });
    server.on('error', () => {});
    return new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve({
          port: server.address().port,
          sessions,
          handshakes: () => handshakes,
          peakSessions: () => peak,
          liveSessions: () => live,
          setBehavior(next) {
            state.behavior = next;
          },
          close() {
            for (const socket of sockets) socket.destroy();
            return new Promise((done) => {
              const timer = setTimeout(done, 300);
              server.close(() => {
                clearTimeout(timer);
                done();
              });
            });
          }
        });
      });
    });
  }
  const server = tls.createServer({ cert, key }, (socket) => {
    sockets.push(socket);
    socket.on('error', () => {});
    const session = {
      commands: [],
      auth: '',
      raw: Buffer.alloc(0),
      data: null,
      dotSeen: false,
      rcptCount: 0,
      closed: false,
      openedAt: Number(process.hrtime.bigint()),
      closedAt: 0
    };
    sessions.push(session);
    live += 1;
    if (live > peak) peak = live;
    socket.on('close', () => {
      session.closed = true;
      session.closedAt = Number(process.hrtime.bigint());
      live -= 1;
    });
    // A silent RSET never replies. Half-close would otherwise end the socket
    // at once and hide a slot released before the session is gone. The peer
    // closes itself a little after EOF, inside the relay's teardown deadline,
    // so the slot has to follow that close.
    if (state.behavior === 'hang-rset') {
      socket.allowHalfOpen = true;
      socket.on('end', () => {
        setTimeout(() => {
          if (!socket.destroyed) socket.destroy();
        }, state.closeDelay);
      });
    }
    if (state.behavior === 'long-line') {
      socket.write(`250 ${'A'.repeat(2045)}\r\n`);
      return;
    }
    if (state.behavior === 'many-lines') {
      socket.write('250-ok\r\n'.repeat(101));
      return;
    }
    if (state.behavior === 'huge-buf') {
      socket.write('A'.repeat((64 * 1024) + 1));
      return;
    }
    if (state.behavior === 'silent') {
      socket.on('data', (chunk) => {
        session.raw = Buffer.concat([session.raw, chunk]);
      });
      return;
    }
    // slow-greeting holds the greeting long enough for a client to leave
    // while the relay is still opening this session.
    if (state.behavior === 'slow-greeting') {
      setTimeout(() => {
        if (!socket.destroyed) socket.write('220 mock ready\r\n');
      }, 500);
    } else {
      socket.write('220 mock ready\r\n');
    }
    let mode = 'command';
    let pending = Buffer.alloc(0);
    let dataBuf = Buffer.alloc(0);

    const onChunk = (chunk) => {
      session.raw = Buffer.concat([session.raw, chunk]);
      if (mode === 'data') {
        dataBuf = Buffer.concat([dataBuf, chunk]);
        const marker = Buffer.from('\r\n.\r\n');
        const at = dataBuf.indexOf(marker);
        if (at < 0) return;
        session.data = dataBuf.subarray(0, at);
        session.dotSeen = true;
        const rest = dataBuf.subarray(at + marker.length);
        dataBuf = Buffer.alloc(0);
        mode = 'command';
        if (state.behavior === 'hold-final') {
          pending = Buffer.concat([pending, rest]);
          return;
        }
        if (state.behavior === 'delay-final') {
          pending = Buffer.concat([pending, rest]);
          setTimeout(() => {
            if (!socket.destroyed) socket.write('250 accepted\r\n');
          }, 300);
          return;
        }
        socket.write('250 accepted\r\n');
        if (rest.length) onChunk(rest);
        return;
      }
      pending = Buffer.concat([pending, chunk]);
      parse();
    };

    function parse() {
      while (mode === 'command') {
        const text = pending.toString('latin1');
        const nl = text.indexOf('\n');
        if (nl < 0) return;
        let line = text.slice(0, nl);
        pending = Buffer.from(text.slice(nl + 1), 'latin1');
        if (line.endsWith('\r')) line = line.slice(0, -1);
        const verb = (line.split(' ')[0] || '').toUpperCase();
        session.commands.push(verb);
        if (verb === 'AUTH') session.auth = line;
        if (verb === 'RCPT') session.rcptCount += 1;
        if (verb === 'DATA' && state.behavior === 'hang-data') continue;
        if (verb === 'DATA') {
          socket.write('354 go\r\n');
          mode = 'data';
          if (pending.length) {
            const rest = pending;
            pending = Buffer.alloc(0);
            onChunk(rest);
          }
          return;
        }
        if ((verb === 'RSET' || verb === 'QUIT') && state.behavior === 'hang-rset') continue;
        if (verb === 'QUIT') {
          socket.write('221 bye\r\n');
          socket.end();
          return;
        }
        if (verb === 'RSET') {
          socket.write('250 ok\r\n');
          continue;
        }
        if (verb === 'RCPT' && state.behavior === 'mixed') {
          const codes = [250, 450, 550];
          socket.write(`${codes[session.rcptCount - 1] || 550} rcpt\r\n`);
          continue;
        }
        if (state.behavior === 'hang-ehlo' && verb === 'EHLO') continue;
        if (verb === 'EHLO') {
          socket.write('250-mock\r\n250 PIPELINING\r\n');
          continue;
        }
        if (verb === 'AUTH') {
          socket.write('235 ok\r\n');
          continue;
        }
        socket.write('250 ok\r\n');
      }
    }

    socket.on('data', onChunk);
  });
  server.on('secureConnection', () => {
    handshakes += 1;
  });
  server.on('tlsClientError', () => {
    handshakes += 1;
  });
  server.on('error', () => {});
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        sessions,
        handshakes: () => handshakes,
        peakSessions: () => peak,
        liveSessions: () => live,
        setBehavior(next) {
          state.behavior = next;
        },
        close() {
          for (const socket of sockets) socket.destroy();
          return new Promise((done) => {
            const timer = setTimeout(done, 300);
            server.close(() => {
              clearTimeout(timer);
              done();
            });
          });
        }
      });
    });
  });
}

export function startBlackhole() {
  const chunks = [];
  const sockets = [];
  const server = net.createServer((socket) => {
    sockets.push(socket);
    socket.on('error', () => {});
    socket.on('data', (chunk) => chunks.push(chunk));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        bytes() {
          return Buffer.concat(chunks);
        },
        close() {
          for (const socket of sockets) socket.destroy();
          return new Promise((done) => server.close(() => done()));
        }
      });
    });
  });
}

export function writeWorld(root, options) {
  const conf = path.join(root, 'conf');
  const secrets = path.join(root, 'secrets');
  const journal = path.join(root, 'journal-file');
  mkdirSync(conf, { recursive: true });
  mkdirSync(secrets, { recursive: true });
  const login = options.login ?? 'user';
  const domain = options.domain ?? 'example.com';
  const password = options.password ?? 'secret-password';
  const upstreamName = options.upstreamName ?? 'main';
  const salt = options.salt ?? 'ab'.repeat(16);
  const token = options.token ?? 'zztokenvaluezz\n';
  const rows = [{
    login,
    domain,
    upstream: upstreamName,
    salt,
    sha256: hashPassword(salt, password),
    created: '2026-10-12T00:00:00Z'
  }, ...(options.extraLogins ?? [])];
  writeFileSync(path.join(conf, 'logins.json'), `${JSON.stringify(rows, null, 2)}\n`);
  writeFileSync(path.join(conf, 'upstreams.json'), `${JSON.stringify([{
    name: upstreamName,
    host: options.host ?? '127.0.0.1',
    port: options.mockPort,
    user: 'api_token',
    token_file: path.join(secrets, `${upstreamName}.token`)
  }], null, 2)}\n`);
  writeFileSync(path.join(secrets, `${upstreamName}.token`), token);
  if (options.state !== null && options.state !== undefined) {
    writeFileSync(path.join(conf, 'state'), options.state);
  }
  return { conf, secrets, journal, login, domain, password, salt, upstreamName };
}

function asConnect(options) {
  if (typeof options === 'string') return { localAddress: options };
  return options || {};
}

export async function session(port, login, password, options) {
  const client = await connectSmtp(port, asConnect(options));
  const greeting = await client.read();
  const ehlo = await client.cmd('EHLO client');
  return { client, greeting, ehlo, login, password };
}

export async function authed(port, login, password, localAddress) {
  const opened = await session(port, login, password, localAddress);
  const auth = await opened.client.cmd(`AUTH PLAIN ${plain(login, password)}`);
  return { ...opened, auth };
}

export function relayEnv(world, certs, extra = {}) {
  return {
    RELAY_CONF: world.conf,
    RELAY_SECRETS: world.secrets,
    RELAY_JOURNAL: world.journal,
    RELAY_PORT: '0',
    RELAY_HOST: '127.0.0.1',
    RELAY_EXTRA_CA: certs.caPem,
    RELAY_CONNECT_TIMEOUT_MS: '1000',
    RELAY_GREETING_TIMEOUT_MS: '1000',
    RELAY_COMMAND_TIMEOUT_MS: '1000',
    RELAY_DATA_REPLY_TIMEOUT_MS: '1000',
    RELAY_TRANSACTION_TIMEOUT_MS: '8000',
    RELAY_IDLE_TIMEOUT_MS: '30000',
    RELAY_DATA_DEADLINE_MS: '30000',
    ...extra
  };
}

export async function stopped(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
}

const relayProgram = fileURLToPath(new URL('../payload/relay.js', import.meta.url));

export function startRelayChild(env) {
  const child = spawn(process.execPath, [relayProgram], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  let err = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    out += chunk;
  });
  child.stderr.on('data', (chunk) => {
    err += chunk;
  });
  return {
    child,
    output: () => out,
    stderr: () => err,
    async ready(timeout = 5000) {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (child.exitCode !== null || child.signalCode !== null) {
          throw new Error(`relay exited: ${err || out}`);
        }
        const match = /listening port=(\d+)/.exec(out);
        if (match && out.includes('ready signals=hup')) return Number(match[1]);
        await sleep(20);
      }
      throw new Error(`relay did not become ready: ${err || out}`);
    }
  };
}
