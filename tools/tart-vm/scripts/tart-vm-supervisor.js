#!/usr/bin/env node

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  classifyTartError, makeRunRecord, parseSupervisorCommand, parseVncLine, redact, redactJson, SUPERVISOR_HELP, tartArgv
} from './tart-vm-core.js';
import {
  checkSocketLength, checkState, invokedDirectly, openPrivateFile, requireRecord, runPaths, statePaths, writeJson
} from './tart-vm.js';

const ENTRY = fileURLToPath(import.meta.url);

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
    let request = '';
    socket.on('data', (chunk) => {
      request += chunk;
      if (request.length > 4096) {
        socket.destroy();
        return;
      }
      const newline = request.indexOf('\n');
      if (newline < 0) return;
      socket.pause();
      let message;
      try { message = JSON.parse(request.slice(0, newline)); }
      catch { /* Return a fixed error without echoing the request. */ }
      const reply = message?.cmd === 'status'
        ? { ok: true, launch_id: launchId, run }
        : { ok: false, error: 'Send a JSON object with cmd set to status.' };
      socket.end(redactJson(reply, vnc?.passphrase) + '\n');
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
      if (!desktop || vnc) return;
      vnc = parseVncLine(line);
      if (!vnc) return;
      try {
        publish();
        event('desktop-url-read', { port: vnc.port });
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
      ...(writeFailure ? { state_write_failed: true } : {})
    });
    if (writeFailure || exit.code !== 0) process.exitCode = 1;
  } finally {
    clearTimeout(stopTimer);
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
