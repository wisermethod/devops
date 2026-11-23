const fs = require('node:fs');
const { basename, join } = require('node:path');

const program = basename(process.argv[1]);
const args = process.argv.slice(2);
const dir = process.env.TART_TEST_DIR;
const vmPath = join(dir, 'vms.json');
const config = JSON.parse(fs.readFileSync(join(dir, 'config.json'), 'utf8'));
fs.appendFileSync(join(dir, 'calls.jsonl'), JSON.stringify({ program, args }) + '\n');

function vms() {
  return JSON.parse(fs.readFileSync(vmPath, 'utf8'));
}

function store(data) {
  const pending = vmPath + '.' + process.pid;
  fs.writeFileSync(pending, JSON.stringify(data));
  fs.renameSync(pending, vmPath);
}

function fail(message) {
  process.stderr.write(message + '\n');
  process.exit(1);
}

if (program === 'sw_vers') {
  if (args.join(' ') !== '-productVersion') fail('unexpected sw_vers flags');
  console.log(config.macosVersion);
  return;
}

if (program === 'lsof') {
  if (args.join(' ') === '-v') return;
  const pid = args[3];
  if (args.join(' ') !== '-nP -a -p ' + pid + ' -iTCP -sTCP:LISTEN') fail('unexpected lsof flags');
  if (config.listenerError) fail('fixture lsof failed');
  if (!Object.values(vms()).some((vm) => vm.pid === Number(pid))) process.exit(1);
  console.log('COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME');
  console.log('tart ' + pid + ' user 4u IPv4 device 0t0 TCP *:11111 (LISTEN)');
  console.log('tart ' + pid + ' user 7u IPv6 device 0t0 TCP ' + config.listener + ':' + config.port + ' (LISTEN)');
  return;
}

const [command, name, target] = args;
const data = vms();
const vm = data[name];
const missing = (name) => fail('the specified VM "' + name + '" does not exist');
switch (command) {
  case '--version':
    console.log(config.version);
    break;
  case 'list': {
    const masked = (Name, vm, Source) => ({
      Name, Source, State: vm.State, Running: vm.Running, Disk: vm.Disk, Size: vm.Size, Accessed: config.accessed
    });
    if (args.join(' ') === 'list --source local --format json') {
      console.log(JSON.stringify(Object.entries(data).map(([name, vm]) => masked(name, vm, 'local'))));
    } else if (args.join(' ') === 'list --source oci --format json') {
      console.log(JSON.stringify(config.cached.map((name) => masked(name, config.image, 'OCI'))));
    } else fail('unexpected list flags');
    break;
  }
  case 'get': {
    if (!vm) missing(name);
    if (config.failGet === name) fail('fixture get failed');
    if (config.failGetNumber) {
      const counter = join(dir, 'get-count');
      const count = Number(fs.existsSync(counter) ? fs.readFileSync(counter, 'utf8') : 0) + 1;
      fs.writeFileSync(counter, String(count));
      if (count === config.failGetNumber) fail('fixture get failed once');
    }
    if (args.slice(2).join(' ') !== '--format json') fail('unexpected get flags');
    const { pid, ...details } = vm;
    console.log(JSON.stringify(details));
    break;
  }
  case 'clone': {
    if (args.length !== 3) fail('unexpected clone flags');
    if (data[target]) fail('destination exists');
    const { pid, ...source } = vm ?? config.image;
    data[target] = { ...source, State: 'stopped', Running: false };
    store(data);
    break;
  }
  case 'run': {
    if (!vm) missing(name);
    if (config.runError) fail(config.runError);
    if (vm.Running) fail('VM "' + name + '" is running');
    function finish() {
      const data = vms();
      data[name] = { ...vm, Running: false, State: 'stopped' };
      store(data);
      process.exit(0);
    }
    process.on('SIGINT', finish);
    process.on('SIGTERM', finish);
    if (config.exitBeforeUrl && args.includes('--vnc-experimental')) fail('Tart observed ' + config.passphrase + ' before any URL');
    if (args.includes('--vnc-experimental') && !config.omitDesktopUrl) {
      const secret = config.passphrase;
      const split = Math.floor(secret.length / 2);
      // Evidence that the final stderr line is saved only after the secret becomes known.
      process.stderr.write('Tart observed ' + secret + ' and vnc://:' + secret + '@127.0.0.1:' + config.port + '\n');
      process.stdout.write('VNC server is running at vnc://:' + secret.slice(0, split));
      setTimeout(() => process.stdout.write(secret.slice(split) + '@127.0.0.1:' + config.port + '\n'), 50);
    }
    data[name] = { ...vm, pid: process.pid, Running: true, State: 'running' };
    store(data);
    setInterval(() => {}, 1000);
    break;
  }
  case 'exec':
  case 'stop':
    if (!vm) missing(name);
    if (!vm.Running) fail('VM "' + name + '" is not running');
    if (command === 'exec' && args.slice(2).join(' ') !== 'sudo -n /sbin/shutdown -h now') fail('unexpected shutdown argv');
    if (command === 'exec' && config.execHangs) { setInterval(() => {}, 1000); break; }
    if (command !== 'exec' || !config.ignoreShutdown) process.kill(vm.pid, 'SIGINT');
    // A guest shutting down can drop the agent's connection: Tart then exits non-zero though the VM stops.
    if (command === 'exec' && config.execDropsConnection) fail('connection to the guest agent was lost');
    break;
  case 'delete':
    if (!vm) missing(name);
    if (vm.Running) fail('VM "' + name + '" is running');
    delete data[name];
    store(data);
    break;
  default:
    fail('unhandled stub command');
}
