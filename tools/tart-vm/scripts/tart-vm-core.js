export const TOOL_VERSION = '0.1.0';
export const PROVED_TART_VERSION = '2.42.0';
export const DEFAULT_IMAGE = 'ghcr.io/cirruslabs/macos-tahoe-base:latest';
export const GB = 1_000_000_000;
export const START_TIMEOUT = 120;
export const GRACEFUL_TIMEOUT = 120;
export const POWER_OFF_TIMEOUT = 30;
export const SOCKET_LIMIT = 103;
const MAX_TIMEOUT = 2_147_473;
export const LISTENER_REACH =
  "The port can be reached from every network this Mac joins and Tart's passphrase is its only guard.";

const NEW_NAME = /^wiser-tart-[a-z0-9][a-z0-9-]{0,30}$/;
const START_FLAGS = ['--no-graphics', '--no-clipboard', '--no-audio', '--no-usb-accessories'];
const COMMANDS = {
  help: { operands: [] },
  preflight: { operands: [] },
  list: { operands: [] },
  create: { operands: ['name'], flags: { '--image': 'ref', '--image-gb': 'n' } },
  clone: { operands: ['source', 'name'] },
  start: { operands: ['name'], flags: { '--desktop': true } },
  status: { operands: ['name'] },
  stop: { operands: ['name'], flags: { '--graceful': true, '--timeout': 'seconds' } },
  delete: { operands: ['name'], flags: { '--gate-approved': true } }
};

function usage(command, { operands, flags = {} }) {
  return [command, ...operands.map((name) => '<' + name + '>'),
    ...Object.entries(flags).map(([flag, value]) => value === true ? '[' + flag + ']' : '[' + flag + ' <' + value + '>]')].join(' ');
}

const SUPERVISOR_COMMANDS = { serve: { operands: ['name', 'launch-id'], flags: { '--desktop': true } } };
export const HELP = [
  'Usage: node scripts/tart-vm.js <command>',
  ...Object.entries(COMMANDS).map(([name, spec]) => '  ' + usage(name, spec)),
  '  --help  Show this usage for any command.',
  '  --image defaults to ' + DEFAULT_IMAGE + '.',
  '  --image-gb supplies the size in decimal GB for an uncached image.',
  '  --desktop enables Tart\'s experimental VNC listener on every interface.',
  '  stop powers the VM off by default. --graceful asks the guest to shut down.',
  '  --timeout defaults to 30 seconds for power-off and 120 seconds for graceful shutdown.',
  '  --gate-approved is for an unrecorded VM after DevOps Expert\'s gate and the requester\'s yes naming the VM.'
].join('\n') + '\n';

export const SUPERVISOR_HELP = [
  'Internal to tart-vm start.',
  'Usage: node scripts/tart-vm-supervisor.js ' + usage('serve', SUPERVISOR_COMMANDS.serve),
  '  help, --help  Show this usage.'
].join('\n') + '\n';

function usageError(message, script) {
  throw new Error(message + ' Run "node scripts/' + script + '.js help" for usage.');
}

function parse(argv, commands, script) {
  const [first = 'help', ...args] = argv;
  const command = first === '--help' ? 'help' : first;
  const spec = command === 'help' ? COMMANDS.help : Object.hasOwn(commands, command) && commands[command];
  if (!spec) {
    const kind = command.startsWith('-') ? 'option' : 'command';
    usageError('Unknown ' + kind + ' ' + JSON.stringify(command) + '.', script);
  }
  const flags = Object.create(null);
  const operands = [];
  const supported = { '--help': true, ...spec.flags };
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('-')) {
      operands.push(token);
      continue;
    }
    if (!Object.hasOwn(supported, token)) usageError('Unknown option ' + JSON.stringify(token) + '.', script);
    if (Object.hasOwn(flags, token)) usageError(token + ' was given more than once.', script);
    if (supported[token] === true) {
      flags[token] = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith('-')) {
      if (value?.startsWith('-') && !Object.hasOwn(supported, value)) {
        usageError('Unknown option ' + JSON.stringify(value) + '.', script);
      }
      usageError(token + ' needs a value.', script);
    }
    flags[token] = value;
    index += 1;
  }
  if (operands.length > spec.operands.length) {
    usageError('Unexpected argument ' + JSON.stringify(operands[spec.operands.length]) + '.', script);
  }
  if (flags['--help'] || command === 'help') return { command: 'help' };
  if (operands.length < spec.operands.length) {
    usageError(command + ' needs <' + spec.operands[operands.length] + '>.', script);
  }
  return { command, operands, flags };
}

export function isToolName(name) {
  return typeof name === 'string' && NEW_NAME.test(name);
}

function validateToolName(name) {
  if (!isToolName(name)) {
    throw new Error('Invalid new VM name ' + JSON.stringify(name) +
      '. Use wiser-tart- followed by 1 to 31 lowercase letters, digits or hyphens, starting with a letter or digit.');
  }
}

function validateLocalName(name) {
  if (!name || name === '.' || name === '..' || /[\/\\\x00-\x1f\x7f]/.test(name)) {
    throw new Error('Invalid local VM name ' + JSON.stringify(name) + '. Use a VM name from tart-vm list.');
  }
}

function positiveNumber(value, flag, integer = false) {
  if (value === undefined) return undefined;
  const pattern = integer ? /^\d+$/ : /^\d+(\.\d+)?$/;
  const number = Number(value);
  if (!pattern.test(value) || !Number.isFinite(number) || number <= 0 ||
      (integer ? number > MAX_TIMEOUT : number * GB > Number.MAX_SAFE_INTEGER - 20 * GB)) {
    throw new Error(flag + ' must be a positive ' +
      (integer ? 'whole number of seconds (up to ' + MAX_TIMEOUT + ').' : 'size in GB within the supported range.'));
  }
  return number;
}

export function parseCommand(argv) {
  const parsed = parse(argv, COMMANDS, 'tart-vm');
  if (!parsed.operands) return parsed;
  const { command, operands, flags } = parsed;
  const [first, second] = operands;
  const name = command === 'clone' ? second : first;
  if (command === 'create' || command === 'clone') validateToolName(name);
  else if (name !== undefined) validateLocalName(name);
  if (command === 'clone') validateLocalName(first);
  const image = flags['--image'] ?? DEFAULT_IMAGE;
  if (flags['--image'] && (/\s|[\\\x00-\x1f\x7f]/.test(image) || image.startsWith('/') ||
      image.split('/').some((part) => part === '.' || part === '..' || part === ''))) {
    throw new Error('Invalid --image ' + JSON.stringify(image) + '. Use an OCI image reference.');
  }
  return {
    command, name, source: command === 'create' ? image : first,
    imageGb: positiveNumber(flags['--image-gb'], '--image-gb'),
    desktop: flags['--desktop'] === true,
    graceful: flags['--graceful'] === true,
    timeout: positiveNumber(flags['--timeout'], '--timeout', true),
    gateApproved: flags['--gate-approved'] === true
  };
}

export function parseSupervisorCommand(argv) {
  const parsed = parse(argv, SUPERVISOR_COMMANDS, 'tart-vm-supervisor');
  if (parsed.command === 'help') return parsed;
  const [name, launchId] = parsed.operands;
  validateToolName(name);
  if (!/^[a-f0-9]{32}$/.test(launchId)) {
    usageError('Invalid launch ID. Start the supervisor through tart-vm start.', 'tart-vm-supervisor');
  }
  return { command: parsed.command, name, launchId, desktop: parsed.flags['--desktop'] === true };
}

export const tartArgv = {
  version: () => ['--version'],
  list: (source) => ['list', '--source', source, '--format', 'json'],
  get: (name) => ['get', name, '--format', 'json'],
  clone: (source, name) => ['clone', source, name],
  start: (name, desktop) => ['run', name, ...START_FLAGS, ...(desktop ? ['--vnc-experimental'] : [])],
  stop: (name, timeout) => ['stop', name, ...(timeout === undefined ? [] : ['--timeout', String(timeout)])],
  shutdown: (name) => ['exec', name, 'sudo', '-n', '/sbin/shutdown', '-h', 'now'],
  delete: (name) => ['delete', name]
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readTartJson(output, command, valid) {
  let value;
  try { value = JSON.parse(output); } catch { /* Report the command without echoing its output. */ }
  if (!valid(value)) {
    throw new Error('tart ' + command + ' returned unexpected JSON. Check tart ' +
      command + ' with --format json and run tart --version.');
  }
  return value;
}

function hasVmState(vm) {
  return ['running', 'stopped', 'suspended'].includes(vm.State) &&
    vm.Running === (vm.State === 'running');
}

export function parseList(output, source) {
  return readTartJson(output, 'list', (value) => Array.isArray(value) &&
    value.every((vm) => isObject(vm) && typeof vm.Name === 'string' && vm.Name.length > 0 &&
      vm.Source === (source === 'oci' ? 'OCI' : 'local') && hasVmState(vm)));
}

export function parseGet(output) {
  return readTartJson(output, 'get', (vm) => isObject(vm) && ['darwin', 'linux'].includes(vm.OS) && hasVmState(vm));
}

export function classifyTartError(line) {
  if (/\bexceeds the system limit\b/i.test(line)) {
    const others = /\(other running VMs:\s*([^\n]*)\)\s*$/i.exec(line);
    return { kind: 'limit', names: others ? others[1].split(',').map((name) => name.trim()).filter(Boolean) : [] };
  }
  if (/\bthe specified VM "[^\r\n]+" does not exist\b/i.test(line)) return { kind: 'missing' };
  if (/\bVM "[^\r\n]+" is not running\b/i.test(line)) return { kind: 'not-running' };
  if (/\bVM "[^\r\n]+" is running\b/i.test(line)) return { kind: 'running' };
  return { kind: 'other' };
}

export function macLimitReached(target, runningMacs) {
  return target.OS === 'darwin' && runningMacs.length >= 2;
}

export function limitRefusal(name, runningMacs) {
  const names = runningMacs.map((vm) => JSON.stringify(vm)).join(', ');
  const running = names ? ' Running VMs: ' + names + '.' : '';
  return 'Cannot start ' + JSON.stringify(name) + ' because Tart\'s macOS VM limit is two.' +
    running + ' Stop a running macOS VM first.';
}

export function diskDecision({ freeBytes, operation, image, cached, imageGb }) {
  const baseGb = 20;
  if (operation === 'create' && !cached && image !== DEFAULT_IMAGE && imageGb === undefined) {
    return { kind: 'image-size-required' };
  }
  const pullGb = image === DEFAULT_IMAGE ? Math.max(33, imageGb ?? 0) : imageGb;
  const minimumBytes = operation === 'create' && !cached ? baseGb * GB + Math.ceil(pullGb * GB) : baseGb * GB;
  return { kind: freeBytes < minimumBytes ? 'insufficient' : 'enough', minimumBytes };
}

export function diskRefusal(freeBytes, decision, image) {
  if (decision.kind === 'image-size-required') {
    return 'Uncached image ' + JSON.stringify(image) + ' requires --image-gb <n>. Supply its size in GB.';
  }
  return 'Tart\'s volume has ' + freeBytes + ' bytes free. This operation needs at least ' +
    decision.minimumBytes + ' bytes (' + decision.minimumBytes / GB + ' GB). Free space on that volume and retry.';
}

export function makeVmRecord(name, source, createdAt) {
  return { name, source, created_at: createdAt, tool_version: TOOL_VERSION };
}

export function validVmRecord(record, name) {
  return isObject(record) && record.name === name && typeof record.source === 'string' &&
    record.source.length > 0 && typeof record.created_at === 'string' &&
    Number.isFinite(Date.parse(record.created_at)) && typeof record.tool_version === 'string' &&
    /^\d+\.\d+\.\d+$/.test(record.tool_version);
}

export function makeRunRecord({ supervisorPid, tartPid, desktop, startedAt, vnc }) {
  return {
    supervisor_pid: supervisorPid,
    tart_pid: tartPid,
    desktop,
    port: vnc?.port ?? null,
    started_at: startedAt,
    passphrase_length: vnc?.passphrase.length ?? null
  };
}

export function validRunRecord(record) {
  if (!isObject(record) || !Number.isSafeInteger(record.supervisor_pid) || record.supervisor_pid <= 0 ||
      !Number.isSafeInteger(record.tart_pid) || record.tart_pid <= 0 ||
      typeof record.desktop !== 'boolean' || !Number.isFinite(Date.parse(record.started_at))) return false;
  if (record.port === null) return record.passphrase_length === null;
  return record.desktop && validPort(record.port) &&
    Number.isSafeInteger(record.passphrase_length) && record.passphrase_length > 0;
}

export function launchReady(state, supervisorPid, launchId) {
  return state?.launch_id === launchId && validRunRecord(state.run) &&
    state.run.supervisor_pid === supervisorPid && (!state.run.desktop || state.run.port !== null);
}

export function vmListItem(vm, record, run) {
  return { ...vm, created_by_tool: record !== null, ...(run ? { supervised: true, desktop: run.desktop } : {}) };
}

export function runAnswer(run, listener) {
  return {
    supervised: run !== null,
    desktop: run?.desktop ?? false,
    ...(run ? { pid: run.tart_pid } : {}),
    ...(listener ? { listener, listener_reach: LISTENER_REACH } : {})
  };
}

export function answer(command, tartVersion, fields) {
  return {
    command, tart_version: tartVersion, ...fields,
    ...(tartVersion === PROVED_TART_VERSION ? {} : { warnings: ['This tool was proved on Tart ' + PROVED_TART_VERSION + '.'] })
  };
}

function validPort(port) {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

export function parseVncLine(line) {
  // Tart 2.42.0 prints "VNC server is running at <url>" (Sources/tart/Commands/Run.swift).
  const url = /(?:^|\s)(vnc:\/\/:([^@\s]+)@127\.0\.0\.1:(\d+))$/.exec(line.trim());
  const port = Number(url?.[3]);
  return url && validPort(port) ? { url: url[1], passphrase: url[2], port } : null;
}

export function redact(text, passphrase) {
  const safe = text.replace(/vnc:\/\/:[^@]*@/gi, 'vnc://:<redacted>@');
  return passphrase ? safe.split(passphrase).join('<redacted len=' + passphrase.length + '>') : safe;
}

export function redactJson(object, passphrase) {
  return JSON.stringify(object, (_, value) => typeof value === 'string' ? redact(value, passphrase) : value);
}

export function parseListener(output, port) {
  const suffix = ':' + port;
  for (const line of output.split('\n')) {
    const listener = /\bTCP\s+(\S+)\s+\(LISTEN\)\s*$/.exec(line)?.[1];
    if (listener?.endsWith(suffix) && /^(?:\*|[\d.]+|\[[\da-f:.%a-z_-]+\]):\d+$/i.test(listener)) return listener;
  }
  return null;
}
