#!/usr/bin/env node

import { execFile, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { wiserUserConfigDir } from '../../lib/user-config.js';
import {
  DEFAULT_IMAGE, GRACEFUL_TIMEOUT, HELP, POWER_OFF_TIMEOUT, SOCKET_LIMIT, START_TIMEOUT,
  answer, classifyTartError, diskDecision, diskRefusal, isToolName, launchReady, limitRefusal,
  macLimitReached, makeVmRecord, parseCommand, parseGet, parseList, parseListener, redact, redactJson,
  runAnswer, tartArgv, validRunRecord, validVmRecord, vmListItem
} from './tart-vm-core.js';

const ENTRY = fileURLToPath(import.meta.url);
const TOOL_DIR = resolve(dirname(ENTRY), '..');
const SUPERVISOR = fileURLToPath(new URL('./tart-vm-supervisor.js', import.meta.url));
const INSPECTION_MS = 10_000;
const POLL_MS = 200;
const LOCK_SLACK = 60;

export function invokedDirectly(entry) {
  try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(entry); }
  catch { return false; }
}

function nearestExisting(path) {
  let ancestor = path;
  for (;;) {
    try {
      fs.lstatSync(ancestor);
      return { ancestor: fs.realpathSync(ancestor), tail: relative(ancestor, path) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(ancestor);
      if (ancestor === parent) throw error;
      // A dangling link does not name a usable volume or a safe destination.
      if (fs.lstatSync(ancestor, { throwIfNoEntry: false })) throw error;
      ancestor = parent;
    }
  }
}

function outsideTool(path) {
  const { ancestor, tail } = nearestExisting(path);
  const fromTool = relative(fs.realpathSync(TOOL_DIR), resolve(ancestor, tail));
  if (fromTool === '' || (!fromTool.startsWith('..' + sep) && fromTool !== '..' && !isAbsolute(fromTool))) {
    throw new Error('Refusing to write inside tart-vm at ' + JSON.stringify(path) +
      '. Use a home outside the tool directory.');
  }
}

function privateDirectory(path) {
  const stat = fs.lstatSync(path, { throwIfNoEntry: false });
  if (!stat) return 'absent';
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o022) !== 0) {
    throw new Error('Unsafe state directory ' + JSON.stringify(path) +
      '. Use a real directory owned by this user with group and other write access removed.');
  }
  return 'ready';
}

export function statePaths() {
  const config = resolve(wiserUserConfigDir());
  const root = join(config, 'tart-vm');
  return { config, root, records: join(root, 'vms'), run: join(root, 'run') };
}

export function checkState(paths, create = []) {
  for (const key of ['config', 'root', 'records', 'run']) {
    const path = paths[key];
    if (privateDirectory(path) === 'absent' && create.includes(key)) {
      outsideTool(path);
      if (key === 'config') fs.mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      try { fs.mkdirSync(path, { mode: 0o700 }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      privateDirectory(path);
    }
  }
  // This also screens existing state reached through a link above the Wiser directory.
  outsideTool(paths.root);
}

function stateFacts(paths) {
  const status = {};
  for (const [key, path] of Object.entries(paths)) {
    try {
      const parent = key === 'config' ? null : key === 'root' ? 'config' : 'root';
      status[key] = { path, state: parent && status[parent].state !== 'ready'
        ? (status[parent].state === 'absent' ? 'absent' : 'unchecked')
        : privateDirectory(path) };
    } catch (error) {
      status[key] = { path, state: 'unsafe', error: error.message };
    }
  }
  return status;
}

export function runPaths(runDirectory, name) {
  const key = createHash('sha256').update(name).digest('hex').slice(0, 12);
  return {
    socket: join(runDirectory, key + '.sock'),
    record: join(runDirectory, key + '.json'),
    log: join(runDirectory, key + '.log'),
    lock: join(runDirectory, key + '.lock')
  };
}

export function checkSocketLength(path) {
  const length = Buffer.byteLength(path);
  if (length > SOCKET_LIMIT) {
    throw new Error('Supervisor socket path is ' + length + ' bytes and the limit is ' + SOCKET_LIMIT +
      ' bytes. Run with a shorter user home path.');
  }
}

export function openPrivateFile(path, flags) {
  let fd;
  try { fd = fs.openSync(path, flags | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK, 0o600); }
  catch (error) {
    if (error.code !== 'ELOOP') throw error;
    throw new Error('Unsafe state file ' + JSON.stringify(path) + ' is a symbolic link. Use a private regular file owned by this user.');
  }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid() || stat.nlink !== 1 || (stat.mode & 0o077) !== 0) {
      throw new Error('Unsafe state file ' + JSON.stringify(path) + '. Use a private regular file owned by this user.');
    }
    return fd;
  } catch (error) {
    fs.closeSync(fd);
    throw error;
  }
}

function readPrivateFile(path) {
  let fd;
  try { fd = openPrivateFile(path, fs.constants.O_RDONLY); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  try { return fs.readFileSync(fd, 'utf8'); }
  finally { fs.closeSync(fd); }
}

export function writeJson(path, value) {
  const temporary = path + '.' + randomBytes(8).toString('hex') + '.tmp';
  const fd = openPrivateFile(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL);
  try {
    try {
      fs.fchmodSync(fd, 0o600);
      fs.writeFileSync(fd, JSON.stringify(value) + '\n');
    } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, path);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function recordPath(paths, name) {
  return join(paths.records, name + '.json');
}

function clearRecord(paths, name) {
  fs.rmSync(recordPath(paths, name), { force: true });
  fs.rmSync(runPaths(paths.run, name).log, { force: true });
}

export function readVmRecord(paths, name) {
  if (!isToolName(name)) return null;
  const contents = readPrivateFile(recordPath(paths, name));
  if (contents === null) return null;
  let record;
  try { record = JSON.parse(contents); } catch { /* Refuse incomplete records below. */ }
  if (!validVmRecord(record, name)) {
    throw new Error('Incomplete VM record for ' + JSON.stringify(name) + '. Inspect ' +
      JSON.stringify(recordPath(paths, name)) + ' before retrying.');
  }
  return record;
}

export function requireRecord(paths, name) {
  if (!readVmRecord(paths, name)) {
    throw new Error('VM ' + JSON.stringify(name) +
      ' has no tart-vm record. Use a VM made with tart-vm create or clone.');
  }
}

function tartHome() {
  return resolve(process.env.TART_HOME || join(homedir(), '.tart'));
}

function diskSpace(home) {
  const { ancestor } = nearestExisting(home);
  const stats = fs.statfsSync(ancestor, { bigint: true });
  return { free_bytes: Number(stats.bavail * stats.bsize), measured_at: ancestor };
}

function call(program, args, timeout = INSPECTION_MS) {
  return new Promise((done) => {
    const child = execFile(program, args, { timeout, killSignal: 'SIGKILL', maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      done({ error, stdout, stderr });
    });
    child.stdin.end();
  });
}

async function readVersion() {
  const result = await call('tart', tartArgv.version());
  const version = result.stdout.trim();
  if (result.error || !version || /[\r\n]/.test(version)) {
    throw new Error('Tart is unavailable or its version could not be read. Check tart --version.');
  }
  return version;
}

async function tart(args, { timeout, missing = false } = {}) {
  const result = await call('tart', args, timeout);
  if (!result.error) return result.stdout;
  if (result.error.code === 'ENOENT') throw new Error('Tart is unavailable. Check tart --version.');
  const outcome = classifyTartError(result.stderr.trim());
  if (missing && outcome.kind === 'missing') return null;
  const name = JSON.stringify(args[1]);
  if (outcome.kind === 'missing') throw new Error('VM or source ' + name + ' does not exist. Check tart-vm list or the image reference.');
  if (outcome.kind === 'not-running') throw new Error('VM ' + name + ' is not running. Check tart-vm status.');
  if (outcome.kind === 'running') throw new Error('VM ' + name + ' is running. Stop it first.');
  const subject = ['get', 'clone', 'stop', 'exec', 'delete'].includes(args[0]) ? ' for ' + name : '';
  throw new Error('tart ' + args[0] + subject + (result.error.killed ? ' timed out.' : ' failed.') +
    ' Check the VM or its image with Tart on this Mac and retry.');
}

async function listTart(source) {
  return parseList(await tart(tartArgv.list(source)), source);
}

async function getVm(name, options) {
  const output = await tart(tartArgv.get(name), options);
  return output === null ? null : parseGet(output);
}

async function runningMacs() {
  const list = await listTart('local');
  const running = list.filter((vm) => vm.Running);
  const details = await Promise.all(running.map((vm) => getVm(vm.Name, { missing: true })));
  return running.filter((_, index) => details[index]?.Running && details[index]?.OS === 'darwin').map((vm) => vm.Name);
}

function imageCached(list, image) {
  return list.some((entry) => entry.Name === image);
}

async function preflight(paths, home) {
  const errors = {};
  async function probe(key, action) {
    try { return await action(); }
    catch (error) { errors[key] = error.message; return null; }
  }
  const version = await probe('tart_version', readVersion);
  const [macos, disk, cached, running] = await Promise.all([
    probe('macos_version', async () => {
      const result = await call('sw_vers', ['-productVersion']);
      const productVersion = result.stdout.trim();
      if (result.error || !/^\d+(\.\d+)*$/.test(productVersion)) {
        throw new Error('Could not read the macOS version. Check sw_vers -productVersion.');
      }
      return productVersion;
    }),
    probe('disk', () => diskSpace(home)),
    version === null ? null : probe('default_image_cached', async () => imageCached(await listTart('oci'), DEFAULT_IMAGE)),
    version === null ? null : probe('running_macos_vms', runningMacs)
  ]);
  return answer('preflight', version, {
    platform: process.platform, architecture: process.arch,
    apple_silicon: process.platform === 'darwin' && process.arch === 'arm64',
    macos_version: macos, macos_13_or_later: macos === null ? null : Number(macos.split('.')[0]) >= 13,
    tart_home: home, disk, default_image: DEFAULT_IMAGE, default_image_cached: cached,
    running_macos_vms: running, state_directories: stateFacts(paths), errors
  });
}

function supervisorState(path, timeout = 1000) {
  const stat = fs.lstatSync(path, { throwIfNoEntry: false });
  if (!stat) return Promise.resolve({ kind: 'absent' });
  checkSocketLength(path);
  if (!stat.isSocket() || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) {
    throw new Error('Unsafe supervisor socket ' + JSON.stringify(path) + '. Inspect the tart-vm run directory.');
  }
  return new Promise((done, reject) => {
    const socket = createConnection(path);
    let reply = '';
    socket.setEncoding('utf8');
    socket.setTimeout(Math.min(timeout, 1000));
    socket.on('connect', () => socket.write('{"cmd":"status"}\n'));
    socket.on('data', (chunk) => {
      reply += chunk;
      if (reply.length > 4096 || reply.includes('\n')) {
        socket.destroy();
        let state;
        try { state = JSON.parse(reply); } catch { /* Refuse below without echoing the reply. */ }
        if (state?.ok === true && /^[a-f0-9]{32}$/.test(state.launch_id) &&
            (state.run === null || validRunRecord(state.run))) {
          done({ kind: state.run === null ? 'starting' : 'active', ...state });
        } else {
          reject(new Error('Unexpected supervisor status. Check the tart-vm run log and VM status.'));
        }
      }
    });
    socket.on('close', () => reject(new Error('The supervisor closed its status connection. Retry tart-vm status.')));
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('The supervisor did not answer. Check the tart-vm run log and VM status.'));
    });
    socket.on('error', (error) => {
      if (error.code === 'ENOENT') done({ kind: 'absent' });
      else if (error.code === 'ECONNREFUSED') done({ kind: 'stale' });
      else reject(new Error('Could not reach the supervisor. Check the tart-vm run log and VM status.'));
    });
  });
}

async function readSupervision(paths, name) {
  if (!isToolName(name)) return null;
  const state = await supervisorState(runPaths(paths.run, name).socket);
  return state.kind === 'active' ? state.run : null;
}

async function checkLsof() {
  if ((await call('lsof', ['-v'])).error) {
    throw new Error('lsof is unavailable or failed its check. Check lsof -v.');
  }
}

async function listenerFor(run, timeout) {
  const result = await call('lsof', ['-nP', '-a', '-p', String(run.tart_pid), '-iTCP', '-sTCP:LISTEN'], timeout);
  if (result.error && (result.error.code !== 1 || result.stderr.trim())) {
    throw new Error('lsof could not inspect Tart\'s listener. Check lsof -v and tart-vm status.');
  }
  return parseListener(result.stdout, run.port);
}

function requireDisk(home, options) {
  const space = diskSpace(home);
  const decision = diskDecision({ ...options, freeBytes: space.free_bytes });
  if (decision.kind !== 'enough') throw new Error(diskRefusal(space.free_bytes, decision, options.image));
}

async function cloneVm(options, paths, home) {
  const { command, name, source, imageGb } = options;
  if (readVmRecord(paths, name)) {
    if (await getVm(name, { missing: true })) {
      throw new Error('VM ' + JSON.stringify(name) + ' already exists. Use a new VM name.');
    }
    // Tart no longer has this VM: a delete outside the tool, or one cut short, left its record. It stays until the
    // new clone's record replaces it, so a clone or a write that fails still leaves this name controllable.
  }
  const cached = command === 'create' && imageCached(await listTart('oci'), source);
  requireDisk(home, { operation: command, image: source, cached, imageGb });
  if (command === 'clone') await getVm(source);
  checkState(paths, ['config', 'root', 'records']);
  await tart(tartArgv.clone(source, name), { timeout: 0 });
  const record = makeVmRecord(name, source, new Date().toISOString());
  try {
    const vm = await getVm(name);
    writeJson(recordPath(paths, name), record);
    return { record, vm, ...(command === 'create' ? { image_cached: cached } : {}),
      ...(imageGb === undefined ? {} : { image_gb: imageGb }) };
  } catch (error) {
    throw new Error('Tart reported cloning ' + JSON.stringify(name) + ', but verification or recording failed. ' +
      'Inspect the VM and its record before retrying. ' + error.message);
  }
}

function readExit(log, launchId) {
  const contents = readPrivateFile(log);
  for (const line of (contents ?? '').trimEnd().split('\n').reverse()) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event?.launch_id === launchId && event.event === 'exit') return event;
  }
  return null;
}

function deadlineAfter(seconds) {
  return performance.now() + seconds * 1000;
}

function timeLeft(deadline) {
  return Math.max(0, Math.ceil(deadline - performance.now()));
}

async function pollUntil(deadline, read, { retryErrors = false } = {}) {
  let remaining = timeLeft(deadline);
  while (remaining > 0) {
    let result;
    try { result = await read(Math.min(INSPECTION_MS, remaining)); }
    catch (error) { if (!retryErrors && timeLeft(deadline) > 0) throw error; }
    // A read that finds what it waits for counts even when it returns just past the deadline.
    if (result) return result;
    if (timeLeft(deadline) === 0) break;
    await sleep(Math.min(POLL_MS, timeLeft(deadline)));
    remaining = timeLeft(deadline);
  }
  return null;
}

async function startVm({ name, desktop }, paths, home) {
  requireRecord(paths, name);
  const runFiles = runPaths(paths.run, name);
  checkSocketLength(runFiles.socket);
  const vm = await getVm(name);
  if (vm.Running) throw new Error('VM ' + JSON.stringify(name) + ' is running. Stop it before starting it again.');
  const running = await runningMacs();
  if (macLimitReached(vm, running)) throw new Error(limitRefusal(name, running));
  requireDisk(home, { operation: 'start' });
  if (desktop) await checkLsof();
  checkState(paths, ['config', 'root', 'run']);
  const release = await acquireStartLock(runFiles.lock, name);
  try {
    let socketState = await supervisorState(runFiles.socket);
    if (socketState.kind === 'stale') {
      // Under the start lock no other start is binding this path, and a live supervisor listens on it from before
      // it starts Tart until it exits, so a connection refused twice is a socket a killed supervisor or a restart left.
      const first = fs.lstatSync(runFiles.socket, { throwIfNoEntry: false });
      await sleep(POLL_MS);
      socketState = await supervisorState(runFiles.socket);
      const second = fs.lstatSync(runFiles.socket, { throwIfNoEntry: false });
      if (socketState.kind === 'stale') {
        if (!first || !second || first.ino !== second.ino || first.dev !== second.dev) {
          throw new Error('The supervisor socket for ' + JSON.stringify(name) + ' changed while it was checked. Retry tart-vm start.');
        }
        fs.rmSync(runFiles.socket, { force: true });
        fs.rmSync(runFiles.record, { force: true });
        socketState = { kind: 'absent' };
      }
    }
    if (socketState.kind !== 'absent') {
      throw new Error('A supervisor already holds ' + JSON.stringify(name) + '. Check tart-vm status.');
    }
    return await launch(name, desktop, runFiles, running);
  } finally {
    release();
  }
}

function readLock(path) {
  try { return JSON.parse(readPrivateFile(path) ?? 'null'); }
  catch { return null; }
}

// true: a running tart-vm start holds it; false: its holder has exited, or the pid now runs something else;
// null: the lock names no process, or ps could not say.
async function lockHolderRuns(holder) {
  if (!Number.isSafeInteger(holder?.pid) || holder.pid <= 0) return null;
  try { process.kill(holder.pid, 0); }
  catch (error) { if (error.code === 'ESRCH') return false; }
  const result = await call('/bin/ps', ['-o', 'command=', '-p', String(holder.pid)]);
  if (result.error) return result.error.code === 1 && !result.stdout.trim() ? false : null;
  return result.stdout.includes('tart-vm.js start');
}

async function acquireStartLock(path, name) {
  const token = randomBytes(16).toString('hex');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let fd;
    try { fd = openPrivateFile(path, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (attempt > 0) break;
      const holder = readLock(path);
      const runs = await lockHolderRuns(holder);
      const stat = fs.lstatSync(path, { throwIfNoEntry: false });
      // A lock whose start is no longer running was left by one that was killed. A lock naming no process, left by a
      // start killed between creating and writing it, is taken only once older than any start holds one.
      const abandoned = runs === false ||
        (runs === null && !holder?.pid && stat && Date.now() - stat.mtimeMs > (START_TIMEOUT + LOCK_SLACK) * 1000);
      // Remove it only if it is still the lock just judged, not one another start has since taken.
      if (!abandoned || readLock(path)?.token !== holder?.token) break;
      fs.rmSync(path, { force: true });
      continue;
    }
    try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token, at: new Date().toISOString() }) + '\n'); }
    finally { fs.closeSync(fd); }
    return () => { if (readLock(path)?.token === token) fs.rmSync(path, { force: true }); };
  }
  throw new Error('Another tart-vm start of ' + JSON.stringify(name) + ' is in progress. Wait for it to finish, then check tart-vm status.');
}

async function launch(name, desktop, runFiles, running) {
  const launchId = randomBytes(16).toString('hex');
  const deadline = deadlineAfter(START_TIMEOUT);
  const args = [SUPERVISOR, 'serve', name, launchId, ...(desktop ? ['--desktop'] : [])];
  const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore' });
  const exited = new Promise((done) => {
    child.once('exit', () => done(true));
    child.once('error', () => done(true));
  });
  let ended = false;
  void exited.then(() => { ended = true; });
  child.unref();

  try {
    const started = await pollUntil(deadline, async (timeout) => {
      if (ended) {
        const event = readExit(runFiles.log, launchId);
        const outcome = typeof event?.tart_error?.kind === 'string' && Array.isArray(event.tart_error.names)
          ? event.tart_error : classifyTartError(event?.stderr ?? '');
        if (outcome.kind === 'limit') {
          let names = outcome.names;
          if (names.length === 0) {
            try { names = await runningMacs(); } catch { names = running; }
          }
          throw new Error(limitRefusal(name, names));
        }
        if (outcome.kind === 'running') throw new Error('VM ' + JSON.stringify(name) + ' is running. Stop it first.');
        if (outcome.kind === 'missing') throw new Error('VM ' + JSON.stringify(name) + ' disappeared. Check tart-vm list.');
        throw new Error('Could not start the supervisor or tart run for ' + JSON.stringify(name) +
          '. Check tart-vm status and ' + JSON.stringify(runFiles.log) + '.');
      }
      const state = await supervisorState(runFiles.socket, timeout);
      if (!launchReady(state, child.pid, launchId)) return null;
      if (!(await getVm(name, { timeout })).Running || ended) return null;
      const listener = desktop ? await listenerFor(state.run, Math.max(1, Math.min(timeout, timeLeft(deadline)))) : null;
      if (ended || (desktop && !listener)) return null;
      return { name, ...runAnswer(state.run, listener) };
    });
    if (started) return started;
    throw new Error('VM ' + JSON.stringify(name) + ' did not become ready within ' + START_TIMEOUT +
      ' seconds. Check ' + JSON.stringify(runFiles.log) + ' and retry.');
  } catch (error) {
    if (!ended) {
      child.kill('SIGTERM');
      // Keep the caller alive until the supervisor has reaped the Tart process it started.
      const cleanedUp = await new Promise((done) => {
        const timer = setTimeout(() => done(false), 5000);
        void exited.then(() => { clearTimeout(timer); done(true); });
      });
      if (!cleanedUp) {
        // The detached supervisor leads a private group that includes its Tart child.
        if (!ended && child.pid) {
          try { process.kill(-child.pid, 'SIGKILL'); }
          catch (killError) { if (killError.code !== 'ESRCH') throw killError; }
        }
        throw new Error(error.message + ' Supervisor cleanup did not finish. Check tart-vm status and the run directory for ' +
          JSON.stringify(name) + '.');
      }
    }
    throw error;
  }
}

async function statusVm(name, paths) {
  const vm = await getVm(name);
  const run = await readSupervision(paths, name);
  let listener;
  if (run?.desktop && run.port !== null) {
    await checkLsof();
    listener = await listenerFor(run);
    if (!listener) throw new Error('Tart\'s desktop listener is missing for ' + JSON.stringify(name) + '. Recheck tart-vm status.');
  }
  return { name, vm, ...runAnswer(run, listener) };
}

async function stopVm({ name, graceful, timeout }, paths) {
  requireRecord(paths, name);
  const runFiles = runPaths(paths.run, name);
  const seconds = timeout ?? (graceful ? GRACEFUL_TIMEOUT : POWER_OFF_TIMEOUT);
  const readStopped = async (remaining) => {
    const vm = await getVm(name, { timeout: remaining });
    return vm.State === 'stopped' ? vm : null;
  };
  let stopped;
  let execFailure = null;
  if (graceful) {
    if (!(await getVm(name)).Running) throw new Error('VM ' + JSON.stringify(name) + ' is not running. Check tart-vm status.');
    // One deadline bounds the request and the wait. A guest that shuts down can drop the agent's connection before
    // tart exec answers (measured 2026-11-23), so the VM's own state decides; a failed exec is named only if it never stops.
    const deadline = deadlineAfter(seconds);
    const asked = tart(tartArgv.shutdown(name), { timeout: seconds * 1000 }).then(() => null, (error) => error);
    stopped = await pollUntil(deadline, readStopped, { retryErrors: true });
    execFailure = await asked;
  } else {
    await tart(tartArgv.stop(name, timeout), { timeout: seconds * 1000 + INSPECTION_MS });
    stopped = await pollUntil(deadlineAfter(INSPECTION_MS / 1000), readStopped, { retryErrors: true });
  }
  if (!stopped) {
    const cause = graceful ? 'The guest did not shut down within ' + seconds + (seconds === 1 ? ' second.' : ' seconds.') +
      (execFailure ? ' Asking it through tart exec also failed: ' + execFailure.message : '')
      : 'Tart did not report the VM stopped.';
    throw new Error(cause + ' Check tart-vm status for ' + JSON.stringify(name) + '.');
  }
  const finished = await pollUntil(deadlineAfter(5), async () => {
    const state = await supervisorState(runFiles.socket);
    return state.kind === 'absent' || state.kind === 'stale';
  });
  if (!finished) throw new Error('The VM stopped, but its supervisor has not exited. Check tart-vm status and the run log.');
  return { name, vm: stopped, method: graceful ? 'guest-shutdown' : 'power-off', timeout_seconds: seconds };
}

async function deleteVm({ name, gateApproved }, paths, home) {
  const record = readVmRecord(paths, name);
  const vm = await getVm(name, { missing: record !== null });
  if (vm === null) {
    // Tart no longer has this VM: a delete outside the tool, or one cut short, left its record.
    clearRecord(paths, name);
    return { name, deleted: false, vm_missing: true, record_removed: true, gate_approved: gateApproved };
  }
  if (vm.Running) throw new Error('VM ' + JSON.stringify(name) + ' is running. Stop it first.');
  if (!record && !gateApproved) {
    throw new Error('VM ' + JSON.stringify(name) +
      ' has no tart-vm record. Use --gate-approved only after DevOps Expert\'s gate and the requester\'s yes naming this VM.');
  }
  const before = diskSpace(home).free_bytes;
  await tart(tartArgv.delete(name), { timeout: 0 });
  if (await getVm(name, { missing: true })) {
    throw new Error('Tart still lists ' + JSON.stringify(name) + ' after delete. Check tart-vm status before retrying.');
  }
  if (isToolName(name)) {
    clearRecord(paths, name);
    const runFiles = runPaths(paths.run, name);
    // A supervisor killed outright leaves its socket and run record; the VM is gone, so they are too.
    if ((await supervisorState(runFiles.socket)).kind === 'stale') {
      fs.rmSync(runFiles.socket, { force: true });
      fs.rmSync(runFiles.record, { force: true });
    }
  }
  return { name, deleted: true, gate_approved: gateApproved, free_bytes_before: before, free_bytes_after: diskSpace(home).free_bytes };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCommand(argv);
  const { command, name } = options;
  if (command === 'help') return HELP;
  const paths = statePaths();
  const home = tartHome();
  if (command === 'preflight') return preflight(paths, home);
  checkState(paths);
  if (['create', 'clone', 'start', 'stop', 'delete'].includes(command)) outsideTool(home);
  const version = await readVersion();
  let result;
  switch (command) {
    case 'list': {
      const local = await listTart('local');
      result = { vms: await Promise.all(local.map(async (vm) =>
        vmListItem(vm, readVmRecord(paths, vm.Name), await readSupervision(paths, vm.Name)))) };
      break;
    }
    case 'create':
    case 'clone':
      result = await cloneVm(options, paths, home);
      break;
    case 'start':
      result = await startVm(options, paths, home);
      break;
    case 'status':
      result = await statusVm(name, paths);
      break;
    case 'stop':
      result = await stopVm(options, paths);
      break;
    case 'delete':
      result = await deleteVm(options, paths, home);
      break;
  }
  return answer(command, version, result);
}

if (invokedDirectly(ENTRY)) {
  try {
    const result = await main();
    process.stdout.write(typeof result === 'string' ? result : redactJson(result) + '\n');
  } catch (error) {
    process.stderr.write(redact('Error: ' + error.message) + '\n');
    process.exitCode = 1;
  }
}
