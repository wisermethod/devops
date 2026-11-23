import assert from 'node:assert/strict';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { classifyTartError, diskDecision, parseGet, parseList, parseVncLine, redact, tartArgv } from '../scripts/tart-vm-core.js';

const TOOL = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(TOOL, 'scripts', 'tart-vm.js');
const SUPERVISOR = join(TOOL, 'scripts', 'tart-vm-supervisor.js');
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
  const env = { ...process.env, TART_TEST_DIR: dir, PATH: bin, HOME: home, XDG_CONFIG_HOME: '', TART_HOME: join(home, 'tart') };
  fs.mkdirSync(home);
  fs.mkdirSync(bin);
  fs.writeFileSync(join(bin, 'tart'), '#!' + process.execPath + '\n' + STUB, { mode: 0o700 });
  fs.symlinkSync('tart', join(bin, 'lsof'));
  fs.symlinkSync('tart', join(bin, 'sw_vers'));
  const conf = {
    image: BASE_VM, version: '2.42.0', macosVersion: '26.3', cached: [IMAGE], accessed: ACCESS_TIME,
    passphrase: SECRET, port: PORT, listener: '*', ...config
  };
  fs.writeFileSync(join(dir, 'config.json'), JSON.stringify(conf));
  fs.writeFileSync(join(dir, 'vms.json'), JSON.stringify(initial));
  fs.writeFileSync(join(dir, 'calls.jsonl'), '');
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
      'delete', '--help', '--image', '--image-gb', '--desktop', '--graceful', '--timeout', '--gate-approved']) {
      assert.ok(result.stdout.includes(word));
    }
  }
  for (const args of [['help'], ['--help'], ['preflight'], ['list'], ['create', VM], ['clone', 'source', VM],
    ['start', VM], ['status', VM], ['stop', VM], ['delete', VM]]) {
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
  assert.equal(started.listener, '*:49158');
  assert.match(started.listener_reach, /every network this Mac joins.*only guard/);
  assert.deepEqual(f.tart().filter(([cmd]) => cmd === 'run'), [['run', VM, ...FLAGS, '--vnc-experimental']]);
  const status = successful(f.sync(process.execPath, [CLI, 'status', VM], { ...f.env, TMPDIR: tmpB }));
  assert.equal(status.supervised, true);
  assert.equal(status.desktop, true);
  assert.equal(status.listener, '*:49158');
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
  const record = JSON.parse(fs.readFileSync(f.runFile(VM, 'json')));
  assert.equal(record.passphrase_length, SECRET.length);
  assert.equal(record.port, PORT);
  assert.equal(JSON.parse(badReply).ok, false);
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
  assert.equal(log.at(-1).stderr, 'Tart observed <redacted len=' + SECRET.length + '> and vnc://:<redacted>@127.0.0.1:' + PORT);
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
  fs.mkdirSync(f.run);
  fs.chmodSync(f.run, 0o770);
  const callsBefore = f.calls();
  f.refused(['start', VM], /Unsafe state directory.*run.*group and other write access/);
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

test('a start lock held by a live start refuses, and one older than any start is taken over', (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  const lock = f.runFile(VM, 'lock');
  fs.mkdirSync(lock.slice(0, lock.lastIndexOf('/')), { recursive: true, mode: 0o700 });
  fs.writeFileSync(lock, '{}\n', { mode: 0o600 });
  f.refused(['start', VM], /in progress/);
  const old = new Date(Date.now() - 600_000);
  fs.utimesSync(lock, old, old);
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

test('a start lock is taken from a holder that is not a running start, and kept from one that is, whatever its age', async (t) => {
  const f = fixture(t);
  f.ok('create', VM);
  const lock = f.runFile(VM, 'lock');
  fs.mkdirSync(lock.slice(0, lock.lastIndexOf('/')), { recursive: true, mode: 0o700 });
  const holder = (pid) => fs.writeFileSync(lock, JSON.stringify({ pid, token: 'b'.repeat(32) }) + '\n', { mode: 0o600 });
  // A holder that has exited, fresh: taken at once.
  holder(spawnSync(process.execPath, ['-e', '0']).pid);
  assert.equal(f.ok('start', VM).supervised, true);
  f.ok('stop', VM);
  // A reused pid: alive, but not a tart-vm start.
  holder(process.pid);
  assert.equal(f.ok('start', VM).supervised, true);
  f.ok('stop', VM);
  // A running start, its lock ten minutes old as after a clock step: kept.
  const runner = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)', 'tart-vm.js', 'start', VM], { stdio: 'ignore' });
  t.after(() => runner.kill('SIGKILL'));
  await eventually(() => alive(runner.pid));
  holder(runner.pid);
  const old = new Date(Date.now() - 600_000);
  fs.utimesSync(lock, old, old);
  f.refused(['start', VM], /in progress/);
  assert.ok(fs.existsSync(lock), 'a running start keeps its lock');
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
  assert.equal(fs.readFileSync(join(f.dir, 'get-count'), 'utf8') >= '2', true);
});
