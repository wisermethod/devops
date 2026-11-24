import assert from 'node:assert/strict';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { classifyTartError, diskDecision, parseGet, parseList, parseVncLine, redact, runAnswer, tartArgv } from '../scripts/tart-vm-core.js';

const TOOL = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(TOOL, 'scripts', 'tart-vm.js');
const SUPERVISOR = join(TOOL, 'scripts', 'tart-vm-supervisor.js');
const RFB_FIXTURE = fileURLToPath(new URL('fixtures/rfb-server.bin', import.meta.url));
const STUB = fs.readFileSync(new URL('fixtures/stub.cjs', import.meta.url), 'utf8');
const IMAGE = 'ghcr.io/cirruslabs/macos-tahoe-base:latest';
const VM = 'wiser-tart-test';
const CLONE = 'wiser-tart-clone';
const SECRET = 'fixture-pine-blue-spring';
const PORT = 49158;
const ACCESS_TIME = '2026-11-23T10:20:30Z';
const BASE_VM = {
  OS: 'darwin', CPU: 4, Memory: 8192, Disk: 50, DiskFormat: 'raw', Size: 33,
  Display: '1024x768', MACAddress: '00:11:22:33:44:55', Running: false, State: 'stopped'
};
const FLAGS = ['--no-graphics', '--no-clipboard', '--no-audio', '--no-usb-accessories'];
const GIGABYTE = 1_000_000_000;

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

async function eventually(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await sleep(25);
  }
  assert.ok(predicate(), 'condition did not become true');
}

function fixture(t, config = {}, initial = {}, homeName = 'h') {
  const dir = fs.mkdtempSync('/tmp/tv-');
  const home = join(dir, homeName);
  const bin = join(dir, 'bin');
  const configDir = process.platform === 'darwin'
    ? join(home, 'Library', 'Application Support', 'wiser')
    : join(home, '.config', 'wiser');
  const state = join(configDir, 'tart-vm');
  const records = join(state, 'vms');
  const run = join(state, 'run');
  const env = { ...process.env, TART_TEST_DIR: dir, TART_TEST_RFB_FIXTURE: RFB_FIXTURE,
    PATH: bin, HOME: home, XDG_CONFIG_HOME: '', TART_HOME: join(home, 'tart') };
  fs.mkdirSync(home);
  fs.mkdirSync(bin);
  fs.writeFileSync(join(bin, 'tart'), '#!' + process.execPath + '\n' + STUB, { mode: 0o700 });
  fs.symlinkSync('tart', join(bin, 'lsof'));
  fs.symlinkSync('tart', join(bin, 'sw_vers'));
  const conf = {
    image: BASE_VM, version: '2.42.0', macosVersion: '26.3', cached: [IMAGE], accessed: ACCESS_TIME,
    passphrase: SECRET, listener: '*', ...config
  };
  fs.writeFileSync(join(dir, 'config.json'), JSON.stringify(conf));
  fs.writeFileSync(join(dir, 'vms.json'), JSON.stringify(initial));
  fs.writeFileSync(join(dir, 'calls.jsonl'), '');
  fs.writeFileSync(join(dir, 'rfb.jsonl'), '');
  const outputs = [];
  const vms = () => JSON.parse(fs.readFileSync(join(dir, 'vms.json'), 'utf8'));
  t.after(async () => {
    const pids = Object.values(vms()).map((vm) => vm.pid).filter((pid) => pid && alive(pid));
    for (const pid of pids) {
      try { process.kill(pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    try { await eventually(() => pids.every((pid) => !alive(pid))); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  const sync = (program, args, childEnv = env) => {
    const result = spawnSync(program, args, { cwd: TOOL, env: childEnv, encoding: 'utf8', timeout: 15_000 });
    outputs.push(result.stdout ?? '', result.stderr ?? '');
    if (result.error) throw result.error;
    return result;
  };
  const command = (...args) => sync(process.execPath, [CLI, ...args]);
  const asyncCommand = (...args) => new Promise((done) => {
    execFile(process.execPath, [CLI, ...args], { cwd: TOOL, env, timeout: 15_000 }, (error, stdout, stderr) => {
      outputs.push(stdout, stderr);
      done({ status: error ? error.code : 0, stdout, stderr });
    });
  });
  const calls = () => fs.readFileSync(join(dir, 'calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  return {
    dir, env, configDir, state, records, run, vms, outputs, calls, sync, command, asyncCommand,
    port: () => Number(fs.readFileSync(join(dir, 'vnc-port'), 'utf8')),
    rfb: () => fs.readFileSync(join(dir, 'rfb.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse),
    ok: (...args) => successful(command(...args)),
    refused: (args, message) => refusal(command(...args), message),
    tart: () => calls().filter(({ program }) => program === 'tart').map(({ args }) => args),
    runFile: (name, ext) => join(run, createHash('sha256').update(name).digest('hex').slice(0, 12) + '.' + ext)
  };
}

function successful(result) {
  assert.ok(!result.stderr.includes(SECRET), 'stderr exposed the fixture passphrase');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.ok(!result.stdout.includes(SECRET), 'stdout exposed the fixture passphrase');
  return JSON.parse(result.stdout);
}

function refusal(result, message) {
  assert.ok(!result.stderr.includes(SECRET), 'stderr exposed the fixture passphrase');
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, message);
}

function querySocket(path, request = '{"cmd":"status"}\n') {
  return new Promise((done, reject) => {
    const socket = createConnection(path);
    let output = '';
    socket.setEncoding('utf8');
    socket.setTimeout(3000, () => socket.destroy(new Error('test request timed out')));
    socket.on('connect', () => socket.write(request));
    socket.on('data', (chunk) => { output += chunk; });
    socket.on('error', reject);
    socket.on('end', () => done(output));
  });
}

function fileText(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return fileText(path);
    return entry.isFile() ? [fs.readFileSync(path, 'utf8')] : [];
  });
}

function mode(path) {
  return fs.statSync(path).mode & 0o777;
}

test('help is available without Tart, and every command refuses unknown flags before consulting it', (t) => {
  const f = fixture(t);
  const noTart = { ...f.env, PATH: '' };
  for (const args of [[], ['help'], ['--help'], ['start', '--help']]) {
    const result = f.sync(process.execPath, [CLI, ...args], noTart);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    for (const word of ['help', 'preflight', 'list', 'create', 'clone', 'start', 'status', 'stop',
      'delete', '--help', '--image', '--image-gb', '--desktop', '--graceful', '--timeout', '--gate-approved',
      'screenshot', '--out', 'move', 'click', 'double-click', 'drag', 'scroll', 'type', 'key', '--x', '--y', '--button',
      '--from-x', '--from-y', '--to-x', '--to-y', '--direction', '--steps', '--text', '--keys']) {
      assert.ok(result.stdout.includes(word));
    }
  }
  for (const args of [['help'], ['--help'], ['preflight'], ['list'], ['create', VM], ['clone', 'source', VM],
    ['start', VM], ['status', VM], ['stop', VM], ['delete', VM], ...desktopCommands(f).map(([cmd]) => [cmd, VM])]) {
    f.refused([...args, '--fixture-unknown'], /Unknown option "--fixture-unknown".*help/);
  }
  const supervisorHelp = f.sync(process.execPath, [SUPERVISOR, '--help'], noTart);
  assert.equal(supervisorHelp.status, 0);
  assert.match(supervisorHelp.stdout, /serve <name> <launch-id> \[--desktop\]/);
  refusal(f.sync(process.execPath, [SUPERVISOR, 'serve', VM, '0'.repeat(32), '--bad']),
    /Unknown option "--bad".*help/);
  assert.deepEqual(f.calls(), []);
  assert.ok(!fs.existsSync(f.configDir));
});

test('builds the fixed Tart run argv and opts into VNC only for desktop', () => {
  assert.deepEqual(tartArgv.start(VM, false), ['run', VM, ...FLAGS]);
  assert.deepEqual(tartArgv.start(VM, true), ['run', VM, ...FLAGS, '--vnc-experimental']);
});

test('preflight reports independent facts and answers even when Tart is missing', (t) => {
  const f = fixture(t, { macosVersion: '12.6' }, {
    'host-mac': { ...BASE_VM, Running: true, State: 'running' },
    'host-linux': { ...BASE_VM, OS: 'linux', Running: true, State: 'running' },
    'sleeping-mac': { ...BASE_VM, State: 'suspended' }
  });
  const preflight = f.ok('preflight');
  assert.equal(preflight.tart_version, '2.42.0');
  assert.equal(preflight.apple_silicon, process.platform === 'darwin' && process.arch === 'arm64');
  assert.equal(preflight.macos_version, '12.6');
  assert.equal(preflight.macos_13_or_later, false);
  assert.ok(preflight.disk.free_bytes > 0);
  assert.equal(preflight.disk.measured_at, fs.realpathSync(f.env.HOME));
  assert.equal(preflight.default_image_cached, true);
  assert.deepEqual(preflight.running_macos_vms, ['host-mac']);
  assert.deepEqual(preflight.state_directories.records, { path: f.records, state: 'absent' });
  assert.deepEqual(preflight.errors, {});
  const noTart = successful(f.sync(process.execPath, [CLI, 'preflight'], { ...f.env, PATH: '' }));
  assert.equal(noTart.tart_version, null);
  assert.match(noTart.errors.tart_version, /tart --version/);
  assert.equal(noTart.default_image_cached, null);
  assert.equal(noTart.running_macos_vms, null);
  assert.ok(noTart.disk.free_bytes > 0);
  assert.ok(!fs.existsSync(f.configDir));
});

test('create and clone preserve the source settings and report local VMs and their records', (t) => {
  const external = { ...BASE_VM, OS: 'linux', CPU: 6, Display: '1920x1080' };
  const f = fixture(t, {}, { 'other VM': external });
  const beforeCreate = Date.now();
  const made = f.ok('create', VM);
  assert.deepEqual(made.vm, BASE_VM);
  assert.equal(made.image_cached, true);
  const { created_at: timestamp, ...recordFields } = made.record;
  assert.deepEqual(recordFields, { name: VM, source: IMAGE, tool_version: '0.1.0' });
  assert.ok(Date.parse(timestamp) >= beforeCreate && Date.parse(timestamp) <= Date.now());
  const record = join(f.records, VM + '.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(record)), made.record);
  for (const path of [f.configDir, f.state, f.records]) assert.equal(mode(path), 0o700);
  assert.equal(mode(record), 0o600);
  assert.deepEqual(f.ok('clone', 'other VM', CLONE).vm, external);
  assert.deepEqual(f.vms()['other VM'], external);
  const listed = f.ok('list').vms;
  assert.deepEqual(listed.map((vm) => [vm.Name, vm.created_by_tool]), [['other VM', false], [VM, true], [CLONE, true]]);
  assert.deepEqual(f.tart().filter(([cmd]) => cmd === 'clone'), [['clone', IMAGE, VM], ['clone', 'other VM', CLONE]]);
  assert.deepEqual(f.ok('status', 'other VM').vm, external);
  assert.equal(f.ok('delete', CLONE).deleted, true);
  assert.ok(!fs.existsSync(join(f.records, CLONE + '.json')));
});

test('both name-creating commands reject invalid names before Tart runs', (t) => {
  const f = fixture(t);
  for (const name of ['bad', 'wiser-tart--test', 'wiser-tart-Test', 'wiser-tart-' + 'x'.repeat(32), 'wiser-tart-test\n']) {
    const reported = /Invalid new VM name .*wiser-tart-/;
    f.refused(['create', name], reported);
    f.refused(['clone', 'source', name], reported);
  }
  assert.deepEqual(f.calls(), []);
});

test('thresholds allow exactly the specified number of free bytes', () => {
  const other = 'ghcr.io/example/fixture:latest';
  const cases = [
    [{ operation: 'create', image: IMAGE, cached: false }, 53],
    [{ operation: 'create', image: IMAGE, cached: false, imageGb: 1 }, 53],
    [{ operation: 'create', image: other, cached: false, imageGb: 6.5 }, 26.5],
    [{ operation: 'create', image: other, cached: true }, 20],
    [{ operation: 'clone' }, 20],
    [{ operation: 'start' }, 20]
  ];
  for (const [parameters, gigabytes] of cases) {
    const minimumBytes = gigabytes * GIGABYTE;
    for (const [delta, kind] of [[-1, 'insufficient'], [0, 'enough'], [1, 'enough']]) {
      assert.deepEqual(diskDecision({ ...parameters, freeBytes: minimumBytes + delta }), { kind, minimumBytes });
    }
  }
});

test('an uncached custom image requires --image-gb before Tart can clone it', (t) => {
  const f = fixture(t);
  const ref = 'ghcr.io/example/fixture:latest';
  f.refused(['create', VM, '--image', ref], /Uncached image .*requires --image-gb/);
  assert.ok(!f.tart().some(([cmd]) => cmd === 'clone'));
  const made = f.ok('create', VM, '--image', ref, '--image-gb', '1.5');
  assert.equal(made.record.source, ref);
  assert.equal(made.image_gb, 1.5);
  assert.equal(made.image_cached, false);
});

test('two running Mac VMs block a third before run, with a Linux VM excluded from the count', (t) => {
  const f = fixture(t, {}, {
    alpha: { ...BASE_VM, Running: true, State: 'running' },
    beta: { ...BASE_VM, Running: true, State: 'running' },
    penguin: { ...BASE_VM, OS: 'linux', Running: true, State: 'running' }
  });
  f.ok('create', VM);
  const refusal = f.command('start', VM);
  assert.equal(refusal.status, 1);
  assert.equal(refusal.stdout, '');
  assert.match(refusal.stderr, /macOS VM limit.*"alpha", "beta".*Stop a running macOS VM/);
  assert.ok(!refusal.stderr.includes('penguin'));
  assert.ok(!f.tart().some(([cmd]) => cmd === 'run'));
});

test('a headless start runs with one running Mac and one running Linux VM', async (t) => {
  const f = fixture(t, {}, {
    alpha: { ...BASE_VM, Running: true, State: 'running' },
    penguin: { ...BASE_VM, OS: 'linux', Running: true, State: 'running' }
  });
  f.ok('create', VM);
  const started = f.ok('start', VM);
  assert.equal(started.desktop, false);
  assert.equal(started.supervised, true);
  assert.equal(started.pid, f.vms()[VM].pid);
  assert.ok(!('listener' in started));
  assert.deepEqual(f.tart().filter(([cmd]) => cmd === 'run'), [['run', VM, ...FLAGS]]);
  assert.ok(!f.calls().some(({ program }) => program === 'lsof'));
  const stopped = f.ok('stop', VM, '--timeout', '4');
  assert.equal(stopped.method, 'power-off');
  assert.deepEqual(f.tart().find(([cmd]) => cmd === 'stop'), ['stop', VM, '--timeout', '4']);
  await eventually(() => !alive(started.pid));
});

test('Tart\'s limit error follows the same refusal path after run was attempted', (t) => {
  const f = fixture(t, { runError: 'THE number of VMs EXCEEDS THE SYSTEM LIMIT (other running VMs: alpha, beta)' });
  f.ok('create', VM);
  f.refused(['start', VM], /macOS VM limit.*"alpha", "beta".*Stop a running macOS VM/);
  assert.deepEqual(f.tart().find(([cmd]) => cmd === 'run'), ['run', VM, ...FLAGS]);
  assert.ok(!fs.existsSync(f.runFile(VM, 'sock')));
  assert.ok(!fs.existsSync(f.runFile(VM, 'json')));
});

test('a Linux VM can start beside two Macs, and concurrent starts hold just one Tart process', async (t) => {
  const f = fixture(t, { image: { ...BASE_VM, OS: 'linux' } }, {
    alpha: { ...BASE_VM, Running: true, State: 'running' },
    beta: { ...BASE_VM, Running: true, State: 'running' }
  });
  f.ok('create', VM);
  const results = await Promise.all([f.asyncCommand('start', VM), f.asyncCommand('start', VM)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [0, 1]);
  const started = successful(results.find((result) => result.status === 0));
  assert.equal(results.find((result) => result.status === 1).stdout, '');
  assert.deepEqual(f.tart().filter(([command]) => command === 'run'), [['run', VM, ...FLAGS]]);
  assert.ok(alive(started.pid));
  f.ok('stop', VM);
});

test('delete requires a record or the gate, and running and unrecorded VMs receive the specified refusals', (t) => {
  const other = 'external';
  const running = 'running-vm';
  const f = fixture(t, {}, { [other]: BASE_VM, [running]: { ...BASE_VM, Running: true, State: 'running' } });
  f.refused(['start', other], /"external".*no tart-vm record/);
  f.refused(['stop', other], /"external".*no tart-vm record/);
  f.refused(['delete', other], /"external".*--gate-approved/);
  f.refused(['delete', running, '--gate-approved'], /"running-vm" is running\. Stop it first/);
  assert.ok(!f.tart().some(([cmd]) => ['run', 'stop', 'delete'].includes(cmd)));
  const deleted = f.ok('delete', other, '--gate-approved');
  assert.ok(deleted.deleted && deleted.free_bytes_before > 0 && deleted.free_bytes_after > 0);
  assert.deepEqual(f.tart().find(([cmd]) => cmd === 'delete'), ['delete', other]);
  assert.ok(!(other in f.vms()));
});

test('the desktop supervisor and Tart survive the caller shell and clean run state on stop', async (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  const tmpA = fs.mkdtempSync(join(f.dir, 'a-'));
  const tmpB = fs.mkdtempSync(join(f.dir, 'b-'));
  const invoked = f.sync('/bin/sh', ['-c', '"$1" scripts/tart-vm.js start "$2" --desktop ; exit', 'sh', process.execPath, VM],
    { ...f.env, TMPDIR: tmpA });
  const started = successful(invoked);
  const socket = f.runFile(VM, 'sock');
  const runPath = f.runFile(VM, 'json');
  const state = JSON.parse(await querySocket(socket));
  assert.equal(started.pid, f.vms()[VM].pid);
  assert.equal(state.run.tart_pid, started.pid);
  assert.ok(alive(state.run.tart_pid));
  assert.ok(alive(state.run.supervisor_pid));
  assert.deepEqual(JSON.parse(fs.readFileSync(runPath)), state.run);
  assert.equal(mode(f.run), 0o700);
  assert.equal(mode(socket), 0o600);
  assert.equal(mode(runPath), 0o600);
  assert.equal(mode(f.runFile(VM, 'log')), 0o600);
  assert.equal(started.desktop, true);
  assert.equal(started.listener, '*:' + f.port());
  assert.deepEqual(started.rfb, { connected: true, framebuffer: { width: 1024, height: 768 } });
  assert.match(started.listener_reach, /every network this Mac joins.*only guard/);
  assert.deepEqual(f.tart().filter(([cmd]) => cmd === 'run'), [['run', VM, ...FLAGS, '--vnc-experimental']]);
  const status = successful(f.sync(process.execPath, [CLI, 'status', VM], { ...f.env, TMPDIR: tmpB }));
  assert.equal(status.supervised, true);
  assert.equal(status.desktop, true);
  assert.equal(status.listener, '*:' + f.port());
  assert.deepEqual(status.rfb, started.rfb);
  assert.deepEqual(f.calls().filter(({ program, args }) => program === 'lsof' && args[0] === '-nP').map(({ args }) => args),
    Array(2).fill(['-nP', '-a', '-p', String(started.pid), '-iTCP', '-sTCP:LISTEN']));
  const [listed] = f.ok('list').vms;
  assert.ok(listed.supervised && listed.desktop && listed.created_by_tool);
  assert.equal(f.ok('stop', VM).method, 'power-off');
  assert.deepEqual(f.tart().find(([cmd]) => cmd === 'stop'), ['stop', VM]);
  await eventually(() => !alive(state.run.supervisor_pid) && !alive(state.run.tart_pid));
  assert.ok(!fs.existsSync(socket));
  assert.ok(!fs.existsSync(runPath));
  assert.equal(f.ok('status', VM).supervised, false);
});

test('every command, socket replies, VM records and the supervisor log keep the passphrase secret', async (t) => {
  const f = fixture(t);
  f.command('help');
  f.ok('preflight');
  f.ok('create', VM);
  f.ok('clone', VM, CLONE);
  f.ok('start', VM, '--desktop');
  f.ok('status', VM);
  f.ok('list');
  f.refused(['start', VM, '--desktop'], /is running/);
  f.refused(['delete', VM], /is running/);
  const socket = f.runFile(VM, 'sock');
  const reply = await querySocket(socket);
  const badReply = await querySocket(socket, JSON.stringify({ cmd: SECRET }) + '\n');
  const malformed = await querySocket(socket, '{"cmd":{"toString":1}}\n');
  const record = JSON.parse(fs.readFileSync(f.runFile(VM, 'json')));
  assert.equal(record.passphrase_length, SECRET.length);
  assert.equal(record.port, f.port());
  assert.equal(JSON.parse(badReply).ok, false);
  assert.equal(JSON.parse(malformed).ok, false);
  for (const args of desktopCommands(f)) f.ok(...args);
  for (const args of desktopCommands(f)) f.refused([args[0], CLONE, ...args.slice(2)], /start --desktop/);
  f.refused(['key', VM, '--keys', SECRET], /Unknown key.*redacted/);
  f.refused(['click', VM, '--x', '1', '--y', '2', '--button', SECRET], /Unknown button.*redacted/);
  f.refused(['scroll', VM, '--x', '1', '--y', '2', '--direction', SECRET], /Unknown scroll direction.*redacted/);
  const beforeStop = fileText(f.state);
  const stopped = f.ok('stop', VM, '--graceful', '--timeout', '3');
  assert.equal(stopped.method, 'guest-shutdown');
  assert.deepEqual(f.tart().find(([cmd]) => cmd === 'exec'), ['exec', VM, 'sudo', '-n', '/sbin/shutdown', '-h', 'now']);
  assert.ok(!f.tart().some(([cmd]) => cmd === 'stop'));
  const log = fs.readFileSync(f.runFile(VM, 'log'), 'utf8').trim().split('\n').map(JSON.parse);
  const beforeDelete = fileText(f.state);
  f.ok('delete', VM);
  assert.ok(!fs.existsSync(f.runFile(VM, 'log')), 'delete removes the VM\'s supervisor log');
  assert.equal(log.at(-1).event, 'exit');
  assert.equal(log.at(-1).code, 0);
  assert.equal(log.at(-1).stderr, 'Tart observed <redacted len=' + SECRET.length + '> and vnc://:<redacted>@127.0.0.1:' + f.port());
  const clientMessages = f.rfb().filter(({ kind }) => kind !== 'des-response');
  assert.ok(clientMessages.some(({ kind }) => kind === 'pointer'));
  assert.ok(clientMessages.some(({ kind }) => kind === 'key'));
  assert.ok(clientMessages.every(({ kind }) => kind !== 'cut-text'));
  const wire = Buffer.concat(clientMessages.map(({ hex }) => Buffer.from(hex, 'hex')));
  assert.ok(!wire.includes(Buffer.from(SECRET)), 'an RFB message exposed the fixture passphrase');
  for (const text of [...f.outputs, ...beforeStop, ...beforeDelete, ...fileText(f.state), reply, badReply]) {
    assert.ok(!text.includes(SECRET), 'a file, answer, or socket reply exposed the fixture passphrase');
  }
});

test('a guest shutdown timeout leaves Tart running and never invokes force stop', (t) => {
  const f = fixture(t, { ignoreShutdown: true });
  f.ok('create', VM);
  const started = f.ok('start', VM);
  f.refused(['stop', VM, '--graceful', '--timeout', '1'], /guest did not shut down within 1 second/);
  assert.ok(alive(started.pid));
  assert.ok(!f.tart().some(([cmd]) => cmd === 'stop'));
  f.ok('stop', VM);
});

test('a desktop start that cannot inspect the listener stops its own Tart process', (t) => {
  const f = fixture(t, { listenerError: true });
  f.ok('create', VM);
  f.refused(['start', VM, '--desktop'], /lsof could not inspect Tart/);
  const vm = f.ok('status', VM);
  assert.equal(vm.vm.State, 'stopped');
  assert.equal(vm.supervised, false);
  assert.ok(!fs.existsSync(f.runFile(VM, 'sock')));
  assert.ok(!fs.existsSync(f.runFile(VM, 'json')));
  assert.ok(!fileText(f.state).some((text) => text.includes(SECRET)));
});

test('the 120-second startup deadline stops Tart if its desktop URL never arrives', (t) => {
  const f = fixture(t, { omitDesktopUrl: true });
  f.ok('create', VM);
  const clock = join(f.dir, 'clock.cjs');
  fs.writeFileSync(clock, [
    "if (process.argv[2] === 'start') {",
    "  const { performance } = require('node:perf_hooks');",
    "  const now = performance.now.bind(performance);",
    "  Object.defineProperty(performance, 'now', { value: () => now() * 60 });",
    "}"
  ].join('\n'));
  refusal(f.sync(process.execPath, ['--require', clock, CLI, 'start', VM, '--desktop']),
    /did not become ready within 120 seconds/);
  assert.deepEqual(f.tart().filter(([cmd]) => cmd === 'run' || cmd === 'stop'), [['run', VM, ...FLAGS, '--vnc-experimental']]);
  assert.equal(f.vms()[VM].State, 'stopped');
  assert.ok(!fs.existsSync(f.runFile(VM, 'sock')));
  assert.ok(!fs.existsSync(f.runFile(VM, 'json')));
});

test('an incomplete record does not authorize control of a VM', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  fs.writeFileSync(join(f.records, VM + '.json'), JSON.stringify({ name: VM }));
  f.refused(['start', VM], /Incomplete VM record.*wiser-tart-test/);
  f.refused(['delete', VM, '--gate-approved'], /Incomplete VM record.*wiser-tart-test/);
  assert.ok(!f.tart().some(([cmd]) => cmd === 'run' || cmd === 'delete'));
});

test('an unsafe symlink directory is refused and preflight reports it', (t) => {
  const f = fixture(t);
  const elsewhere = join(f.dir, 'elsewhere');
  fs.mkdirSync(elsewhere);
  fs.mkdirSync(f.configDir, { recursive: true, mode: 0o700 });
  fs.symlinkSync(elsewhere, f.state);
  f.refused(['list'], /Unsafe state directory.*tart-vm.*real directory/);
  const state = f.ok('preflight').state_directories;
  assert.equal(state.root.state, 'unsafe');
  assert.equal(state.records.state, 'unchecked');
  assert.deepEqual(fs.readdirSync(elsewhere), []);
});

test('a group-writable run directory is refused before Tart runs', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  fs.mkdirSync(f.run, { recursive: true });
  fs.chmodSync(f.run, 0o770);
  const callsBefore = f.calls();
  f.refused(['start', VM], /Unsafe state directory.*run.*no access for group or other/);
  assert.deepEqual(f.calls(), callsBefore);
});

test('a socket path over the byte limit is refused before tart run', (t) => {
  const f = fixture(t, {}, {}, 'é'.repeat(55));
  f.ok('create', VM);
  const length = Buffer.byteLength(f.runFile(VM, 'sock'));
  f.refused(['start', VM], new RegExp('socket path is ' + length + ' bytes and the limit is 103 bytes'));
  assert.ok(!f.tart().some(([cmd]) => cmd === 'run'));
});

test('other Tart versions carry the proved-version warning', (t) => {
  const f = fixture(t, { version: '2.43.1' });
  const result = f.ok('list');
  assert.equal(result.tart_version, '2.43.1');
  assert.deepEqual(result.warnings, ['This tool was proved on Tart 2.42.0.']);
});

test('core parses structured state and spreads neither malformed JSON nor raw Tart errors', () => {
  assert.deepEqual(parseGet(JSON.stringify(BASE_VM)), BASE_VM);
  assert.throws(() => parseGet('{"OS":"darwin","State":"stopped","Running":true}'), /tart get returned unexpected JSON/);
  assert.throws(() => parseList('{}', 'local'), /tart list returned unexpected JSON/);
  assert.equal(classifyTartError('THE SPECIFIED VM "x" DOES NOT EXIST').kind, 'missing');
  assert.equal(classifyTartError('VM "x" IS RUNNING').kind, 'running');
  assert.equal(classifyTartError('VM "x" IS NOT RUNNING').kind, 'not-running');
  assert.deepEqual(classifyTartError('The number of VMs exceeds the system limit'), { kind: 'limit', names: [] });
  assert.equal(redact('vnc://:other-url-secret@127.0.0.1:1 and ' + SECRET, SECRET),
    'vnc://:<redacted>@127.0.0.1:1 and <redacted len=' + SECRET.length + '>');
});

test('the desktop URL is read from the line Tart 2.42.0 prints, and from no other address', () => {
  const url = 'vnc://:' + SECRET + '@127.0.0.1:' + PORT;
  assert.deepEqual(parseVncLine('VNC server is running at ' + url), { url, passphrase: SECRET, port: PORT });
  assert.deepEqual(parseVncLine(url), { url, passphrase: SECRET, port: PORT });
  assert.equal(parseVncLine('Opening vnc://:x@10.0.0.1:5900...'), null);
  assert.equal(parseVncLine('Stopping VM...'), null);
});

function staleSocket(path) {
  const result = spawnSync(process.execPath, ['-e',
    'require("net").createServer().listen(' + JSON.stringify(path) + ', () => process.kill(process.pid, "SIGKILL"))']);
  fs.chmodSync(path, 0o600);
  assert.ok(fs.lstatSync(path).isSocket());
  return result.pid;
}

function staleRecord(path, pid) {
  fs.writeFileSync(path, JSON.stringify({ supervisor_pid: pid, tart_pid: pid, desktop: false, port: null,
    started_at: '2026-11-23T10:20:30Z', passphrase_length: null }) + '\n', { mode: 0o600 });
}

test('a stale socket is cleared at start whatever process its old record names', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  const socket = f.runFile(VM, 'sock');
  fs.mkdirSync(socket.slice(0, socket.lastIndexOf('/')), { recursive: true, mode: 0o700 });
  staleRecord(f.runFile(VM, 'json'), staleSocket(socket));
  assert.equal(f.ok('start', VM).supervised, true);
  f.ok('stop', VM);
  assert.ok(!fs.existsSync(socket));
  // A reused pid: the old record names a live process that is not a supervisor.
  staleSocket(socket);
  staleRecord(f.runFile(VM, 'json'), process.pid);
  assert.equal(f.ok('start', VM).supervised, true);
  f.ok('stop', VM);
});

test('overlapping starts over a stale socket run one Tart process and keep the survivor reachable', async (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  const socket = f.runFile(VM, 'sock');
  fs.mkdirSync(socket.slice(0, socket.lastIndexOf('/')), { recursive: true, mode: 0o700 });
  staleRecord(f.runFile(VM, 'json'), staleSocket(socket));
  const results = await Promise.all([f.asyncCommand('start', VM), f.asyncCommand('start', VM)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [0, 1]);
  assert.equal(f.tart().filter(([command]) => command === 'run').length, 1);
  assert.equal(JSON.parse(await querySocket(socket)).ok, true);
  assert.ok(!fs.existsSync(f.runFile(VM, 'lock')), 'the start lock is released');
  f.ok('stop', VM);
});

function holdLock(t, path) {
  // A second process holding the name's kernel lock, as another tart-vm command would.
  fs.mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true, mode: 0o700 });
  const holder = spawn(process.execPath, ['-e',
    "const fs = require('fs'); fs.openSync(process.argv[1], fs.constants.O_RDWR | fs.constants.O_CREAT | 0x20, 0o600);" +
    " process.stdout.write('held\\n'); setInterval(() => {}, 1000);", path], { stdio: ['ignore', 'pipe', 'ignore'] });
  t.after(() => holder.kill('SIGKILL'));
  return new Promise((done, fail) => {
    holder.stdout.once('data', () => done(holder));
    holder.once('exit', (code) => fail(new Error('The lock holder exited with ' + code + ' before it held ' + path + '.')));
  });
}

test('a VM name another tart-vm command holds is refused, and free the moment that holder exits', async (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  const lock = f.runFile(VM, 'lock');
  const holder = await holdLock(t, lock);
  const before = f.tart().length;
  for (const args of [['start', VM], ['delete', VM], ['create', VM]]) {
    f.refused(args, /Another tart-vm command is working on "wiser-tart-test"/);
  }
  assert.deepEqual(f.tart().slice(before).filter(([cmd]) => ['run', 'delete', 'clone', 'get'].includes(cmd)), []);
  const exited = new Promise((done) => holder.once('exit', done));
  holder.kill('SIGKILL');
  await exited;
  assert.equal(f.ok('start', VM).supervised, true);
  assert.ok(!fs.existsSync(lock), 'the name is released with no file left');
  f.ok('stop', VM);
});

test('a lock file a killed command left behind blocks nothing', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  const lock = f.runFile(VM, 'lock');
  fs.mkdirSync(lock.slice(0, lock.lastIndexOf('/')), { recursive: true, mode: 0o700 });
  fs.writeFileSync(lock, JSON.stringify({ pid: 999999, token: 'b'.repeat(32) }) + '\n', { mode: 0o600 });
  assert.equal(f.ok('start', VM).supervised, true);
  assert.ok(!fs.existsSync(lock));
  f.ok('stop', VM);
});

test('graceful stop --timeout bounds the request to the guest as well as the wait', (t) => {
  const f = fixture(t, { execHangs: true });
  f.ok('create', VM);
  f.ok('start', VM);
  const begun = Date.now();
  f.refused(['stop', VM, '--graceful', '--timeout', '1'], /within 1 second\./);
  assert.ok(Date.now() - begun < 8000, 'the stop returned within its timeout and inspection');
  assert.ok(!f.tart().some(([cmd]) => cmd === 'stop'), 'a graceful stop never forces the VM off');
  f.ok('stop', VM);
});

test('a record whose VM Tart no longer has is cleared by create and by delete', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  const drop = () => {
    const data = f.vms(); delete data[VM];
    fs.writeFileSync(join(f.dir, 'vms.json'), JSON.stringify(data));
  };
  drop();
  assert.equal(f.ok('create', VM).record.name, VM);
  drop();
  const removed = f.ok('delete', VM);
  assert.equal(removed.vm_missing, true);
  assert.equal(removed.record_removed, true);
  assert.ok(!fs.existsSync(join(f.records, VM + '.json')));
  f.refused(['delete', VM], /does not exist/);
});

test('a supervisor whose Tart cannot be spawned exits and leaves no socket', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  fs.mkdirSync(f.run, { recursive: true, mode: 0o700 });
  const empty = join(f.dir, 'empty');
  fs.mkdirSync(empty);
  const result = spawnSync(process.execPath, [SUPERVISOR, 'serve', VM, 'a'.repeat(32)],
    { env: { ...f.env, PATH: empty }, encoding: 'utf8', timeout: 10_000 });
  assert.notEqual(result.error?.code, 'ETIMEDOUT');
  assert.equal(result.status, 1);
  assert.ok(!fs.existsSync(f.runFile(VM, 'sock')));
  const exit = fs.readFileSync(f.runFile(VM, 'log'), 'utf8').trim().split('\n').map(JSON.parse).at(-1);
  assert.equal(exit.event, 'exit');
  assert.equal(exit.spawn_failed, true);
});

test('a desktop run that ends before its URL is read keeps only the class of Tart\'s error', (t) => {
  const f = fixture(t, { exitBeforeUrl: true });
  f.ok('create', VM);
  f.refused(['start', VM, '--desktop'], /Could not start/);
  const log = fs.readFileSync(f.runFile(VM, 'log'), 'utf8');
  assert.ok(!log.includes(SECRET), 'the log holds no passphrase Tart printed before its URL');
  const exit = log.trim().split('\n').map(JSON.parse).at(-1);
  assert.equal(exit.stderr_withheld, true);
  assert.equal(exit.tart_error.kind, 'other');
  for (const text of f.outputs) assert.ok(!text.includes(SECRET));
});

test('a graceful stop whose tart exec loses the guest still succeeds once the VM reads stopped', (t) => {
  const f = fixture(t, { execDropsConnection: true });
  f.ok('create', VM);
  f.ok('start', VM);
  const stopped = f.ok('stop', VM, '--graceful', '--timeout', '5');
  assert.equal(stopped.method, 'guest-shutdown');
  assert.equal(stopped.vm.State, 'stopped');
  assert.ok(!f.tart().some(([cmd]) => cmd === 'stop'), 'a graceful stop never forces the VM off');
  f.refused(['stop', VM, '--graceful'], /is not running/);
});

function setConfig(f, changes) {
  const path = join(f.dir, 'config.json');
  fs.writeFileSync(path, JSON.stringify({ ...JSON.parse(fs.readFileSync(path, 'utf8')), ...changes }));
}

test('a record whose VM was gone stays until the new clone is recorded', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  const data = f.vms(); delete data[VM];
  fs.writeFileSync(join(f.dir, 'vms.json'), JSON.stringify(data));
  setConfig(f, { failGet: VM });
  f.refused(['create', VM], /verification or recording failed/);
  assert.ok(fs.existsSync(join(f.records, VM + '.json')), 'the old record still covers the clone Tart made');
  setConfig(f, { failGet: null });
  assert.equal(f.ok('delete', VM).deleted, true);
});

test('a graceful stop rides out a failed tart get while its timeout runs', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  f.ok('start', VM);
  setConfig(f, { failGetNumber: 2 });
  const stopped = f.ok('stop', VM, '--graceful', '--timeout', '10');
  assert.equal(stopped.method, 'guest-shutdown');
  assert.equal(stopped.vm.State, 'stopped');
  assert.ok(Number(fs.readFileSync(join(f.dir, 'get-count'), 'utf8')) >= 2);
});

function desktopCommands(f) {
  return [
    ['screenshot', VM, '--out', join(f.dir, 'screen.png')],
    ['move', VM, '--x', '0', '--y', '767'],
    ['click', VM, '--x', '18', '--y', '27', '--button', 'right'],
    ['double-click', VM, '--x', '30', '--y', '40'],
    ['drag', VM, '--from-x', '4', '--from-y', '10', '--to-x', '36', '--to-y', '20'],
    ['scroll', VM, '--x', '10', '--y', '20', '--direction', 'up', '--steps', '2'],
    ['type', VM, '--text', 'aA1!\n\t -'],
    ['key', VM, '--keys', 'cmd+n']
  ];
}

test('a wrong password fails on the RFB security result and the supervisor reaps its Tart child', (t) => {
  const f = fixture(t, { rfbPassphrase: 'different-fixture' });
  f.ok('create', VM);
  f.refused(['start', VM, '--desktop'], /RFB security result failure \(1\).*start --desktop/);
  assert.equal(f.vms()[VM].State, 'stopped');
  assert.ok(!fs.existsSync(f.runFile(VM, 'sock')));
  assert.ok(!fs.existsSync(f.runFile(VM, 'json')));
  assert.deepEqual(f.rfb().map(({ kind }) => kind), ['version', 'security-type', 'des-response']);
  assert.ok(!fileText(f.state).some((text) => text.includes(SECRET)));
});

function readPng(png) {
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const contents = png.subarray(offset + 4, offset + 8 + length);
    const type = contents.toString('ascii', 0, 4);
    let crc = 0xffffffff;
    for (const byte of contents) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    assert.equal(png.readUInt32BE(offset + 8 + length), (crc ^ 0xffffffff) >>> 0);
    chunks.push({ type, data: contents.subarray(4) });
    offset += 12 + length;
  }
  assert.deepEqual(chunks.map(({ type }) => type), ['IHDR', 'IDAT', 'IEND']);
  const [header, image] = chunks.map(({ data }) => data);
  assert.deepEqual([...header.subarray(8)], [8, 2, 0, 0, 0]);
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4), scanlines: inflateSync(image) };
}

test('screenshot requests a full update and writes a valid PNG at the resolved caller path', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  const destination = join(f.dir, 'frame');
  fs.mkdirSync(destination);
  const alias = join(f.dir, 'alias');
  fs.symlinkSync(destination, alias);
  const result = f.ok('screenshot', VM, '--out', join(alias, 'screen.png'));
  const path = join(fs.realpathSync(destination), 'screen.png');
  const png = fs.readFileSync(path);
  assert.deepEqual(result, { command: 'screenshot', tart_version: '2.42.0', name: VM,
    path, width: 1024, height: 768, bytes: png.length });
  const { width, height, scanlines } = readPng(png);
  assert.deepEqual([width, height], [1024, 768]);
  assert.equal(scanlines.length, (1 + width * 3) * height);
  // The first recorded BGRX pixel is 32 2d 2d ff, and the last of the 64x64 tile is white.
  assert.deepEqual([...scanlines.subarray(0, 4)], [0, 45, 45, 50]);
  const white = (1 + width * 3) * 63 + 1 + 63 * 3;
  assert.deepEqual([...scanlines.subarray(white, white + 3)], [255, 255, 255]);
  assert.deepEqual(f.rfb().filter(({ kind }) => kind === 'update-request').map(({ hex }) => hex),
    ['03000000000004000300']);
  assert.equal(f.rfb().filter(({ kind }) => kind === 'version').length, 1);
  f.ok('stop', VM);
});

test('screenshot refuses literal, symlinked and unresolvable paths before asking for a frame', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  const alias = join(f.dir, 'tool-alias');
  fs.symlinkSync(TOOL, alias);
  const roundabout = join(f.dir, 'scripts-alias');
  fs.symlinkSync(join(TOOL, 'scripts'), roundabout);
  const paths = [join(TOOL, 'never.png'), join(alias, 'never.png'), roundabout + '/../never.png'];
  for (const path of paths) f.refused(['screenshot', VM, '--out', path], /Refusing to write inside tart-vm/);
  const dangling = join(f.dir, 'dangling');
  fs.symlinkSync(join(f.dir, 'absent'), dangling);
  f.refused(['screenshot', VM, '--out', dangling], /Cannot resolve screenshot destination/);
  f.refused(['screenshot', VM, '--out', join(f.dir, 'missing', 'screen.png')], /existing parent directory/);
  assert.ok(!f.rfb().some(({ kind }) => kind === 'update-request'));
  f.ok('stop', VM);
});

test('DesktopSize triggers a new full screenshot request and changes the pointer bounds', (t) => {
  const f = fixture(t, { resizeOnRequest: true });
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  const result = f.ok('screenshot', VM, '--out', join(f.dir, 'resized.png'));
  assert.deepEqual([result.width, result.height], [80, 72]);
  assert.deepEqual(f.ok('status', VM).rfb, { connected: true, framebuffer: { width: 80, height: 72 } });
  assert.deepEqual(f.rfb().filter(({ kind }) => kind === 'update-request').map(({ hex }) => hex),
    ['03000000000004000300', '03000000000000500048']);
  f.refused(['move', VM, '--x', '80', '--y', '71'], /outside the 80x72 framebuffer/);
  f.ok('move', VM, '--x', '79', '--y', '71');
  f.ok('stop', VM);
});

test('all pointer and keyboard commands send the exact RFB events on a single session', async (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  const ptr = (mask, x, y) => '05' + mask.toString(16).padStart(2, '0') +
    x.toString(16).padStart(4, '0') + y.toString(16).padStart(4, '0');
  const press = (sym) => ['04010000' + sym, '04000000' + sym];
  const shift = (sym) => ['040100000000ffe1', ...press(sym), '040000000000ffe1'];
  const testEvents = async (args, kind, hex) => {
    const before = f.rfb().length;
    const result = f.ok(...args);
    await eventually(() => f.rfb().length >= before + hex.length);
    assert.deepEqual(f.rfb().slice(before), hex.map((hex) => ({ kind, hex })));
    return result;
  };
  const [, move, click, double, drag, scroll, type, key] = desktopCommands(f);
  await testEvents(move, 'pointer', [ptr(0, 0, 767)]);
  await testEvents(click, 'pointer', [0, 4, 0].map((mask) => ptr(mask, 18, 27)));
  for (const [button, mask] of [['left', 1], ['middle', 2]]) {
    const args = button === 'left' ? click.slice(0, -2) : [...click.slice(0, -1), button];
    await testEvents(args, 'pointer', [0, mask, 0].map((m) => ptr(m, 18, 27)));
  }
  await testEvents(double, 'pointer', [0, 1, 0, 1, 0].map((mask) => ptr(mask, 30, 40)));
  await testEvents(drag, 'pointer', [ptr(0, 4, 10), ptr(1, 4, 10), ptr(1, 20, 15), ptr(1, 36, 20), ptr(0, 36, 20)]);
  await testEvents(scroll, 'pointer', [0, 8, 0, 8, 0].map((mask) => ptr(mask, 10, 20)));
  for (const [direction, mask] of [['down', 16], ['left', 32], ['right', 64]]) {
    const args = [...scroll.slice(0, -3), direction];
    await testEvents(args, 'pointer', [0, mask, 0].map((m) => ptr(m, 10, 20)));
  }
  const typed = await testEvents(type, 'key', [
    ...press('00000061'), ...shift('00000061'), ...press('00000031'), ...shift('00000031'),
    ...press('0000ff0d'), ...press('0000ff09'), ...press('00000020'), ...press('0000002d')
  ]);
  assert.deepEqual(typed, { command: 'type', name: VM, tart_version: '2.42.0', length: 8 });
  await testEvents(['type', VM, '--text', ''], 'key', []);
  await testEvents(['type', VM, '--text', '-'], 'key', press('0000002d'));
  await testEvents(key, 'key', ['040100000000ffe9', ...press('0000006e'), '040000000000ffe9']);
  await testEvents(['key', VM, '--keys', 'cmd+space'], 'key',
    ['040100000000ffe9', ...press('00000020'), '040000000000ffe9']);
  await testEvents(['key', VM, '--keys', 'shift+tab'], 'key', shift('0000ff09'));
  await testEvents(['key', VM, '--keys', 'return'], 'key', press('0000ff0d'));
  assert.equal(f.rfb().filter(({ kind }) => kind === 'des-response').length, 1);
  f.ok('stop', VM);
});

test('invalid coordinates, keysyms and later unsupported characters are rejected before input is sent', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  const before = f.rfb();
  const [, move, click, , drag, scroll] = desktopCommands(f);
  f.refused([...move.slice(0, -1), '768'], /outside the 1024x768 framebuffer/);
  f.refused(['move', VM, '--x', '-1', '--y', '0'], /outside the 1024x768 framebuffer/);
  f.refused([...drag.slice(0, -1), '999'], /outside the 1024x768 framebuffer/);
  f.refused([...click.slice(0, -1), 'other'], /Unknown button "other"/);
  f.refused([...scroll.slice(0, -1), '0'], /--steps must be a whole number/);
  f.refused(['key', VM, '--keys', 'cmd+f1'], /Unknown key "f1"/);
  for (const name of ['option', 'control', 'alt', 'alt_l']) {
    f.refused(['key', VM, '--keys', name + '+n'], new RegExp('Unknown modifier "' + name + '"'));
  }
  f.refused(['key', VM, '--keys', 'cmd+cmd+n'], /Repeated modifier "cmd"/);
  f.refused(['type', VM, '--text', 'abc🙂'], /Unsupported character.*U\+1F642/);
  assert.deepEqual(f.rfb(), before);
  f.ok('stop', VM);
});

test('all desktop commands require a VM record and a desktop start', (t) => {
  const f = fixture(t);
  for (const args of desktopCommands(f)) f.refused(args, /has no tart-vm record.*start --desktop/);
  f.ok('create', VM);
  f.ok('start', VM);
  for (const args of desktopCommands(f)) f.refused(args, /no ready desktop session.*start --desktop/);
  assert.deepEqual(f.rfb(), []);
  f.ok('stop', VM);
});

test('a dropped RFB connection fails pending and later desktop work and remains visible in status', (t) => {
  const f = fixture(t, { dropListenerOnRequest: true });
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  const path = join(f.dir, 'dropped.png');
  f.refused(['screenshot', VM, '--out', path], /RFB connection dropped/);
  assert.ok(!fs.existsSync(path));
  f.refused(['move', VM, '--x', '1', '--y', '2'], /RFB connection dropped/);
  assert.deepEqual(f.ok('status', VM).rfb, { connected: false, framebuffer: { width: 1024, height: 768 } });
  assert.equal(f.rfb().filter(({ kind }) => kind === 'version').length, 1);
  f.ok('stop', VM);
});

test('desktop work waits for a pending screenshot and whole input commands stay together', async (t) => {
  const f = fixture(t, { updateDelay: 850 });
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  const [shot, move] = desktopCommands(f);
  const screenshot = f.asyncCommand(...shot);
  await eventually(() => f.rfb().some(({ kind }) => kind === 'update-request'));
  const chord = querySocket(f.runFile(VM, 'sock'), '{"cmd":"key","keys":"cmd+n"}\n');
  await sleep(75);
  const pointer = f.asyncCommand(...move);
  await sleep(100);
  assert.ok(!f.rfb().some(({ kind }) => kind === 'key' || kind === 'pointer'));
  successful(await screenshot);
  assert.equal(JSON.parse(await chord).ok, true);
  successful(await pointer);
  await eventually(() => f.rfb().some(({ kind }) => kind === 'pointer'));
  assert.deepEqual(f.rfb().slice(-6).map(({ kind }) => kind), ['update-request', 'key', 'key', 'key', 'key', 'pointer']);
  f.ok('stop', VM);
});

test('a screenshot waits for rectangles covering the whole frame', (t) => {
  const f = fixture(t, { partialFirst: true });
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  const result = f.ok('screenshot', VM, '--out', join(f.dir, 'partial.png'));
  assert.deepEqual([result.width, result.height], [1024, 768]);
  assert.ok(f.rfb().filter(({ kind }) => kind === 'update-request').length >= 2, 'a 1x1 update did not finish the shot');
  const { scanlines } = readPng(fs.readFileSync(result.path));
  const white = (1 + 1024 * 3) * 63 + 1 + 63 * 3;
  assert.deepEqual([...scanlines.subarray(white, white + 3)], [255, 255, 255]);
  f.ok('stop', VM);
});

test('a screenshot is the frame its update covered, not one a later DesktopSize in the same bytes made', (t) => {
  const f = fixture(t, { resizeAfterUpdate: true });
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  const result = f.ok('screenshot', VM, '--out', join(f.dir, 'before-resize.png'));
  assert.deepEqual([result.width, result.height], [1024, 768]);
  const { scanlines } = readPng(fs.readFileSync(result.path));
  assert.deepEqual([...scanlines.subarray(1, 4)], [7, 7, 7], 'the pixels are the update\'s, not a cleared buffer');
  assert.equal(f.ok('status', VM).rfb.framebuffer.width, 80);
  f.ok('stop', VM);
});

test('desktop commands are capped, a failed one does not stall the next, and a non-file destination is named', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  f.refused(['scroll', VM, '--x', '1', '--y', '1', '--direction', 'down', '--steps', '101'], /from 1 to 100/);
  f.refused(['type', VM, '--text', 'a'.repeat(1001)], /at most 1000 characters/);
  f.refused(['click', VM, '--x', '5000', '--y', '1'], /outside the/);
  assert.equal(f.ok('move', VM, '--x', '10', '--y', '10').x, 10);
  const folder = join(f.dir, 'a-folder');
  fs.mkdirSync(folder);
  f.refused(['screenshot', VM, '--out', folder], /is not a regular file/);
  f.ok('stop', VM);
});

test('the text cap holds for a request sent straight to the supervisor socket', async (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  const reply = JSON.parse(await querySocket(f.runFile(VM, 'sock'), JSON.stringify({ cmd: 'type', text: 'a'.repeat(1001) }) + '\n'));
  assert.equal(reply.ok, false);
  assert.match(reply.error, /at most 1000 characters/);
  assert.ok(!f.rfb().some(({ kind }) => kind === 'key'), 'no key reached the guest');
  assert.equal(f.ok('move', VM, '--x', '1', '--y', '1').x, 1);
  f.ok('stop', VM);
});

test('a command that outlasts a keepalive interval still answers, the keepalive newlines skipped', async (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  f.ok('start', VM, '--desktop');
  // About 15 s of key events, past one 10 s keepalive; the shared helper's 15 s limit is too short for it.
  const typed = await new Promise((done) => execFile(process.execPath, [CLI, 'type', VM, '--text', 'A'.repeat(150)],
    { cwd: TOOL, env: f.env, timeout: 60_000 }, (error, stdout, stderr) => done({ status: error ? error.code : 0, stdout, stderr })));
  assert.equal(typed.status, 0, typed.stderr);
  assert.equal(JSON.parse(typed.stdout).length, 150);
  assert.equal(f.rfb().filter(({ kind }) => kind === 'key').length, 600);
  f.ok('stop', VM);
});

test('a clone whose recording fails keeps a record, and a name Tart already has is never recorded', (t) => {
  const f = fixture(t, {}, { [CLONE]: BASE_VM });
  setConfig(f, { failGet: VM });
  f.refused(['create', VM], /verification or recording failed/);
  assert.ok(fs.existsSync(join(f.records, VM + '.json')), 'the clone Tart made has a record');
  setConfig(f, { failGet: null });
  assert.equal(f.ok('delete', VM).deleted, true);
  // A VM made outside the tool under a tool name stays outside it.
  f.refused(['create', CLONE], /already exists/);
  assert.ok(!fs.existsSync(join(f.records, CLONE + '.json')));
  f.refused(['delete', CLONE], /--gate-approved/);
  // A VM made outside the tool under the name while Tart clones: the failed clone keeps no record for it.
  setConfig(f, { raceClone: VM });
  f.refused(['create', VM], /tart clone .* failed/);
  assert.ok(!fs.existsSync(join(f.records, VM + '.json')), 'a VM another program made is never recorded');
  f.refused(['delete', VM], /--gate-approved/);
});

test('a state directory group or other can read or search is refused', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  fs.mkdirSync(f.run, { recursive: true });
  fs.chmodSync(f.run, 0o744);
  const callsBefore = f.calls();
  f.refused(['start', VM], /Unsafe state directory.*run.*no access for group or other/);
  assert.deepEqual(f.calls(), callsBefore);
});

test('the listener reach follows the address lsof read', () => {
  const run = { desktop: true, tart_pid: 7 };
  assert.match(runAnswer(run, '*:49157').listener_reach, /every network this Mac joins/);
  assert.match(runAnswer(run, '127.0.0.1:49157').listener_reach, /only from this Mac/);
  assert.match(runAnswer(run, '[::1]:49157').listener_reach, /only from this Mac/);
  assert.match(runAnswer(run, '192.168.1.20:49157').listener_reach, /192\.168\.1\.20/);
});
