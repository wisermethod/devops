#!/usr/bin/env node

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import {
  NO_DESKTOP_SESSION, RFB_DROPPED, RfbClient, SUPERVISOR_HELP, checkPoint, classifyTartError, desktopInput, framebufferRequest, isDesktopCommand, keyEvent, makeRunRecord, pointerEvent,
  parseSupervisorCommand, parseVncLine, pngFromBgrx, redact, redactJson, tartArgv
} from './tart-vm-core.js';
import {
  checkSocketLength, checkState, invokedDirectly, openPrivateFile, requireRecord, runPaths, statePaths, writeJson
} from './tart-vm.js';

const ENTRY = fileURLToPath(import.meta.url);
const MAX_REQUEST = 1024 * 1024;
const FRAME_TIMEOUT = 15_000;
const KEEPALIVE_MS = 10_000;
const SEND_TIMEOUT = 10_000;
const RFB_STALLED = 'The RFB server stopped taking input for 10 seconds, so the desktop session closed; part of the command may have reached the guest. Stop the VM and start it again with start --desktop.';
const CALLER_GONE = 'The caller stopped waiting, so the command stopped partway; part of it may have reached the guest. Take a screenshot.';

class DesktopSession {
  constructor({ port, passphrase }, onReady, onStartupFailure) {
    this.rfb = new RfbClient(passphrase);
    this.connected = false;
    this.socket = createConnection({ host: '127.0.0.1', port });
    this.socket.setNoDelay(true);
    this.socket.on('data', (bytes) => {
      try {
        const { send, events } = this.rfb.feed(bytes);
        for (const message of send) this.socket.write(message);
        for (const event of events) {
          if (event.type === 'server-init') {
            this.connected = true;
            onReady();
          }
          if (event.type === 'framebuffer-update') this.update?.receive(event);
        }
      } catch (error) {
        this.close(error.message);
      }
    });
    this.socket.on('error', () => this.close(RFB_DROPPED));
    this.socket.on('close', () => this.close(RFB_DROPPED));
    this.onStartupFailure = onStartupFailure;
  }

  close(reason) {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy();
    if (reason && !this.connected) this.onStartupFailure(reason);
    this.connected = false;
    this.update?.reject(new Error(RFB_DROPPED));
  }

  status() {
    const { width, height } = this.rfb.framebuffer ?? {};
    return { connected: this.connected, framebuffer: width === undefined ? null : { width, height } };
  }

  send(bytes) {
    if (!this.connected) throw new Error(RFB_DROPPED);
    return new Promise((done, reject) => {
      // A write the RFB server has not taken in 10 seconds means it stopped reading. The session closes, so the
      // command fails and the queue behind it moves on, rather than waiting while keepalives hold its caller.
      const timer = setTimeout(() => {
        reject(new Error(RFB_STALLED));
        this.close();
      }, SEND_TIMEOUT);
      this.socket.write(bytes, (error) => {
        clearTimeout(timer);
        if (error) reject(new Error(RFB_DROPPED));
        else done();
      });
    });
  }

  async screenshot() {
    if (!this.connected) throw new Error(RFB_DROPPED);
    const request = () => {
      const { width, height } = this.rfb.framebuffer;
      return this.send(framebufferRequest(width, height));
    };
    let timer;
    let frame;
    try {
      frame = await new Promise((done, reject) => {
        timer = setTimeout(() => {
          reject(new Error('RFB did not deliver a full framebuffer update within 15 seconds. Restart with start --desktop.'));
          this.close();
        }, FRAME_TIMEOUT);
        // A shot is taken only once Raw rectangles since the request cover every pixel of one frame, and from a copy
        // of that frame, since a DesktopSize later in the same bytes replaces the framebuffer.
        let target;
        let covered;
        let remaining;
        const reset = () => {
          target = this.rfb.framebuffer;
          covered = new Uint8Array(target.width * target.height);
          remaining = covered.length;
        };
        reset();
        this.update = {
          reject,
          receive: (event) => {
            if (event.resized || event.framebuffer !== target) {
              reset();
              request().catch(reject);
              return;
            }
            for (const { x, y, width, height } of event.raw) {
              for (let row = y; row < y + height; row += 1) {
                for (let column = x, at = row * target.width + x; column < x + width; column += 1, at += 1) {
                  if (!covered[at]) { covered[at] = 1; remaining -= 1; }
                }
              }
            }
            if (remaining === 0) done({ width: target.width, height: target.height, pixels: Buffer.from(target.pixels) });
            else request().catch(reject);
          }
        };
        request().catch(reject);
      });
    } finally {
      clearTimeout(timer);
      this.update = null;
    }
    const { width, height } = frame;
    const png = pngFromBgrx(frame, deflateSync);
    return { result: { width, height, bytes: png.length }, png };
  }

  async input(message, callerGone = () => false) {
    if (!this.connected) throw new Error(RFB_DROPPED);
    const { events, result } = desktopInput(message, this.rfb.framebuffer);
    const held = new Set();
    let pressed = null;
    try {
      for (const { bytes, delay } of events) {
        if (callerGone()) throw new Error(CALLER_GONE);
        // Each pointer write is checked against the framebuffer as it is now, since a DesktopSize can arrive mid-command.
        if (bytes[0] === 5) checkPoint({ x: bytes.readUInt16BE(2), y: bytes.readUInt16BE(4) }, this.rfb.framebuffer);
        await this.send(bytes);
        if (bytes[0] === 5) pressed = bytes[1] ? bytes : null;
        if (bytes[0] === 4) {
          if (bytes[1]) held.add(bytes.readUInt32BE(4));
          else held.delete(bytes.readUInt32BE(4));
        }
        if (delay) await sleep(delay);
      }
    } catch (error) {
      // Leave no key or button down in the guest: release what this command pressed, where the connection allows.
      if (this.connected) {
        for (const keysym of held) await this.send(keyEvent(false, keysym)).catch(() => {});
        if (pressed) {
          const { width, height } = this.rfb.framebuffer;
          const x = Math.min(pressed.readUInt16BE(2), width - 1);
          const y = Math.min(pressed.readUInt16BE(4), height - 1);
          await this.send(pointerEvent(0, x, y)).catch(() => {});
        }
      }
      throw error;
    }
    return { result };
  }
}

function listen(server, socketPath) {
  return new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => {
      server.off('error', reject);
      done();
    });
  });
}

async function serve({ name, launchId, desktop }) {
  const paths = statePaths();
  const files = runPaths(paths.run, name);
  checkSocketLength(files.socket);
  checkState(paths);
  requireRecord(paths, name);
  process.umask(0o077);

  const startedAt = new Date().toISOString();
  const clients = new Set();
  let run = null;
  let vnc = null;
  let session;
  let startupError;
  let desktopQueue = Promise.resolve();
  let log;
  let child;
  let ownsSocket = false;
  let stopRequested = false;
  let stopTimer;
  let writeFailure = false;

  function stopChild() {
    if (stopRequested) return;
    stopRequested = true;
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    child.kill('SIGINT');
    stopTimer = setTimeout(() => child.kill('SIGKILL'), 1500);
  }

  function event(name, details = {}) {
    const entry = { at: new Date().toISOString(), launch_id: launchId, event: name, ...details };
    fs.writeSync(log, redactJson(entry, vnc?.passphrase) + '\n');
  }

  function publish() {
    const record = makeRunRecord({
      supervisorPid: process.pid, tartPid: child.pid, desktop, startedAt, vnc
    });
    writeJson(files.record, record);
    run = record;
  }

  const server = createServer((socket) => {
    clients.add(socket);
    socket.setEncoding('utf8');
    socket.setTimeout(2000, () => socket.destroy());
    socket.on('error', () => socket.destroy());
    socket.on('close', () => clients.delete(socket));
    function reply(value, png) {
      if (socket.destroyed) return;
      const header = redactJson(value, vnc?.passphrase) + '\n';
      if (png) {
        socket.write(header);
        socket.end(png);
      } else socket.end(header);
    }

    let request = '';
    socket.on('data', (chunk) => {
      request += chunk;
      if (request.length > MAX_REQUEST) {
        socket.removeAllListeners('data');
        reply({ ok: false, error: 'The desktop request is too long. Send less text at once.' });
        return;
      }
      const newline = request.indexOf('\n');
      if (newline < 0) return;
      socket.removeAllListeners('data');
      socket.setTimeout(0);
      let message;
      try { message = JSON.parse(request.slice(0, newline)); }
      catch { /* Return a fixed error without echoing the request. */ }
      if (message?.cmd === 'status') {
        reply({ ok: true, launch_id: launchId, run, ...(desktop ? {
          rfb: session?.status() ?? { connected: false, framebuffer: null }
        } : {}) });
        return;
      }
      if (!isDesktopCommand(message?.cmd)) {
        reply({ ok: false, error: 'Send a JSON object with cmd set to status or a tart-vm desktop command.' });
        return;
      }
      // A newline every few seconds keeps the caller's idle timer alive while this request waits its turn and runs;
      // the caller skips newlines before the reply's header.
      const keepalive = setInterval(() => { if (!socket.destroyed) socket.write('\n'); }, KEEPALIVE_MS);
      desktopQueue = desktopQueue.then(async () => {
        let outcome;
        try {
          if (socket.destroyed) return;
          if (!session) throw new Error(NO_DESKTOP_SESSION);
          const { result, png } = message.cmd === 'screenshot'
            ? await session.screenshot() : await session.input(message, () => socket.destroyed);
          outcome = [{ ok: true, result }, png];
        } catch (error) {
          outcome = [{ ok: false, error: error.message }];
        } finally {
          clearInterval(keepalive);
        }
        reply(...outcome);
      }).catch(() => { /* A reply to a client that has gone must not stop the commands queued after it. */ });
    });
  });

  process.on('SIGTERM', stopChild);
  process.on('SIGINT', stopChild);
  try {
    // Bind first. A second supervisor cannot start Tart or touch another run's files.
    await listen(server, files.socket);
    ownsSocket = true;
    server.on('error', stopChild);
    fs.chmodSync(files.socket, 0o600);
    log = openPrivateFile(files.log, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND);
    event('start', { supervisor_pid: process.pid, desktop });
    if (stopRequested) return;

    child = spawn('tart', tartArgv.start(name, desktop), { stdio: ['ignore', 'pipe', 'pipe'] });
    let lastStderr = '';
    // A spawn that fails emits error and may never emit close, so either one ends the wait.
    const closed = new Promise((done) => {
      child.once('close', (code, signal) => done({ code, signal }));
      child.once('error', () => {
        lastStderr = 'Could not launch tart run. Check tart --version.';
        done({ code: null, signal: null, spawn_failed: true });
      });
    });
    createInterface({ input: child.stderr }).on('line', (line) => {
      if (line.trim()) lastStderr = line;
    });
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (!desktop || vnc || stopRequested) return;
      vnc = parseVncLine(line);
      if (!vnc) return;
      try {
        event('desktop-url-read', { port: vnc.port });
        session = new DesktopSession(vnc, () => {
          if (stopRequested) return;
          try {
            publish();
            event('desktop-ready', session.status());
          } catch {
            writeFailure = true;
            stopChild();
          }
        }, (reason) => {
          startupError = reason;
          stopChild();
        });
      } catch {
        writeFailure = true;
        stopChild();
      }
    });
    if (child.pid) {
      try { publish(); }
      catch {
        writeFailure = true;
        stopChild();
      }
    }
    const exit = await closed;
    // Before a desktop run's URL is read its passphrase is unknown and could not be redacted, so only the class
    // of Tart's error is kept then.
    const safe = !desktop || vnc !== null;
    event('exit', {
      ...exit, tart_error: classifyTartError(lastStderr), ...(safe ? { stderr: lastStderr } : { stderr_withheld: true }),
      ...(writeFailure ? { state_write_failed: true } : {}),
      ...(startupError ? { rfb_startup_error: startupError } : {})
    });
    if (writeFailure || startupError || exit.code !== 0) process.exitCode = 1;
  } finally {
    clearTimeout(stopTimer);
    session?.close();
    try {
      if (ownsSocket) {
        try { fs.rmSync(files.record, { force: true }); }
        finally {
          for (const socket of clients) socket.destroy();
          await new Promise((done) => server.close(done));
          if (log !== undefined) fs.closeSync(log);
        }
      }
    } finally {
      process.off('SIGTERM', stopChild);
      process.off('SIGINT', stopChild);
    }
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseSupervisorCommand(argv);
  if (options.command === 'help') return SUPERVISOR_HELP;
  await serve(options);
}

if (invokedDirectly(ENTRY)) {
  try {
    const result = await main();
    if (result) process.stdout.write(result);
  } catch (error) {
    process.stderr.write(redact('Error: ' + error.message) + '\n');
    process.exitCode = 1;
  }
}
