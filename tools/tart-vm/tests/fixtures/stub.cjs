const fs = require('node:fs');
const { createCipheriv, timingSafeEqual } = require('node:crypto');
const { createServer } = require('node:net');
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

function recordRfb(kind, bytes) {
  fs.appendFileSync(join(dir, 'rfb.jsonl'), JSON.stringify({ kind, hex: bytes.toString('hex') }) + '\n');
}

function expectedResponse(passphrase, challenge) {
  const desKey = Buffer.alloc(8);
  Buffer.from(passphrase).subarray(0, 8).forEach((byte, index) => {
    desKey[index] = Number.parseInt(byte.toString(2).padStart(8, '0').split('').reverse().join(''), 2);
  });
  // With three copies of the same key, DES-EDE3 reduces to single DES.
  const cipher = createCipheriv('des-ede3', Buffer.concat([desKey, desKey, desKey]), null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(challenge), cipher.final()]);
}

function updatePacket(width, height, encoding = 0) {
  const packet = Buffer.alloc(16);
  packet.writeUInt16BE(1, 2);
  packet.writeUInt16BE(width, 8);
  packet.writeUInt16BE(height, 10);
  packet.writeInt32BE(encoding, 12);
  return packet;
}

function startRfb(onListen) {
  const capture = fs.readFileSync(process.env.TART_TEST_RFB_FIXTURE);
  const challenge = capture.subarray(14, 30);
  const expected = expectedResponse(config.rfbPassphrase ?? config.passphrase, challenge);
  const server = createServer((socket) => {
    socket.on('error', () => socket.destroy());
    socket.setNoDelay(true);
    socket.write(capture.subarray(0, 12));
    let buffered = Buffer.alloc(0);
    let phase = 0;
    let width = capture.readUInt16BE(34);
    let height = capture.readUInt16BE(36);
    let resized = false;
    let partialSent = false;
    const handshake = [
      { kind: 'version', bytes: 12, response: capture.subarray(12, 14) },
      { kind: 'security-type', bytes: 1, response: challenge },
      { kind: 'des-response', bytes: 16, response: capture.subarray(30, 34) },
      { kind: 'client-init', bytes: 1, response: capture.subarray(34, 72) }
    ];
    const names = { 0: 'pixel-format', 2: 'encodings', 3: 'update-request', 4: 'key', 5: 'pointer', 6: 'cut-text' };
    function take(length) {
      const bytes = buffered.subarray(0, length);
      buffered = buffered.subarray(length);
      return bytes;
    }
    function framebuffer() {
      const pixels = Buffer.alloc(width * height * 4);
      for (let y = 0; y < 64; y += 1) {
        const start = 88 + y * 64 * 4;
        capture.copy(pixels, y * width * 4, start, start + 64 * 4);
      }
      socket.write(updatePacket(width, height));
      socket.write(pixels);
    }
    socket.on('data', (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      while (buffered.length) {
        if (phase < handshake.length) {
          const step = handshake[phase];
          if (buffered.length < step.bytes) break;
          const bytes = take(step.bytes);
          recordRfb(step.kind, bytes);
          if (phase === 2 && !timingSafeEqual(bytes, expected)) {
            // A server's failure reason may contain credentials. The client must ignore it.
            const reason = Buffer.from('Fixture rejected ' + config.passphrase);
            const failure = Buffer.alloc(8);
            failure.writeUInt32BE(1);
            failure.writeUInt32BE(reason.length, 4);
            socket.end(Buffer.concat([failure, reason]));
            return;
          }
          socket.write(step.response);
          phase += 1;
          continue;
        }
        const type = buffered[0];
        const length = { 0: 20, 2: 4, 3: 10, 4: 8, 5: 6, 6: 8 }[type];
        if (length === undefined) { socket.destroy(); return; }
        if (buffered.length < length) break;
        const extra = type === 2 ? 4 * buffered.readUInt16BE(2) : type === 6 ? buffered.readUInt32BE(4) : 0;
        if (buffered.length < length + extra) break;
        const bytes = take(length + extra);
        recordRfb(names[type], bytes);
        if (type !== 3) continue;
        if (config.dropListenerOnRequest) {
          server.close();
          socket.destroy();
          fs.rmSync(join(dir, 'vnc-port'), { force: true });
          return;
        }
        if (config.resizeOnRequest && !resized) {
          width = 80;
          height = 72;
          resized = true;
          socket.write(updatePacket(width, height, -223));
          continue;
        }
        if (config.partialFirst && !partialSent) {
          partialSent = true;
          const one = updatePacket(1, 1);
          socket.write(Buffer.concat([one, Buffer.from([1, 2, 3, 0])]));
          continue;
        }
        if (config.resizeAfterUpdate && !resized) {
          resized = true;
          const pixels = Buffer.alloc(width * height * 4, 7);
          const whole = Buffer.concat([updatePacket(width, height), pixels]);
          width = 80;
          height = 72;
          socket.write(Buffer.concat([whole, updatePacket(width, height, -223)]));
          continue;
        }
        if (config.updateDelay) setTimeout(() => framebuffer(), config.updateDelay);
        else framebuffer();
      }
    });
  });
  server.listen(0, '127.0.0.1', () => onListen(server.address().port));
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
  const portPath = join(dir, 'vnc-port');
  if (fs.existsSync(portPath)) {
    const port = fs.readFileSync(portPath, 'utf8');
    console.log('tart ' + pid + ' user 7u IPv6 device 0t0 TCP ' + config.listener + ':' + port + ' (LISTEN)');
  }
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
    data[name] = { ...vm, pid: process.pid, Running: true, State: 'running' };
    store(data);
    if (args.includes('--vnc-experimental') && !config.omitDesktopUrl) {
      startRfb((port) => {
        fs.writeFileSync(join(dir, 'vnc-port'), String(port));
        const secret = config.passphrase;
        const split = Math.floor(secret.length / 2);
        // The final stderr line arrives before the supervisor knows the secret.
        process.stderr.write('Tart observed ' + secret + ' and vnc://:' + secret + '@127.0.0.1:' + port + '\n');
        process.stdout.write('VNC server is running at vnc://:' + secret.slice(0, split));
        setTimeout(() => process.stdout.write(secret.slice(split) + '@127.0.0.1:' + port + '\n'), 50);
      });
    }
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
