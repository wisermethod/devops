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
export const NO_DESKTOP_SESSION = 'The VM has no ready desktop session. Use tart-vm start --desktop.';
export const RFB_DROPPED = 'The RFB connection dropped. Stop the VM and start it again with start --desktop.';

const NEW_NAME = /^wiser-tart-[a-z0-9][a-z0-9-]{0,30}$/;
const START_FLAGS = ['--no-graphics', '--no-clipboard', '--no-audio', '--no-usb-accessories'];
const POINT_FLAGS = { '--x': 'n', '--y': 'n' };
const DESKTOP_COMMANDS = {
  screenshot: { operands: ['name'], flags: { '--out': 'path' }, required: ['--out'] },
  move: { operands: ['name'], flags: POINT_FLAGS, required: Object.keys(POINT_FLAGS) },
  click: { operands: ['name'], flags: { ...POINT_FLAGS, '--button': 'left|right|middle' }, required: Object.keys(POINT_FLAGS) },
  'double-click': { operands: ['name'], flags: POINT_FLAGS, required: Object.keys(POINT_FLAGS) },
  drag: { operands: ['name'], flags: { '--from-x': 'n', '--from-y': 'n', '--to-x': 'n', '--to-y': 'n' },
    required: ['--from-x', '--from-y', '--to-x', '--to-y'] },
  scroll: { operands: ['name'], flags: { ...POINT_FLAGS, '--direction': 'up|down|left|right', '--steps': 'n' },
    required: ['--x', '--y', '--direction'] },
  type: { operands: ['name'], flags: { '--text': 'text' }, required: ['--text'] },
  key: { operands: ['name'], flags: { '--keys': 'combo' }, required: ['--keys'] }
};

export function isDesktopCommand(command) {
  return typeof command === 'string' && Object.hasOwn(DESKTOP_COMMANDS, command);
}

const COMMANDS = {
  help: { operands: [] },
  preflight: { operands: [] },
  list: { operands: [] },
  create: { operands: ['name'], flags: { '--image': 'ref', '--image-gb': 'n' } },
  clone: { operands: ['source', 'name'] },
  start: { operands: ['name'], flags: { '--desktop': true } },
  status: { operands: ['name'] },
  ...DESKTOP_COMMANDS,
  stop: { operands: ['name'], flags: { '--graceful': true, '--timeout': 'seconds' } },
  delete: { operands: ['name'], flags: { '--gate-approved': true } }
};

function usage(command, { operands, flags = {}, required = [] }) {
  return [command, ...operands.map((name) => '<' + name + '>'),
    ...Object.entries(flags).map(([flag, value]) => {
      const part = value === true ? flag : flag + ' <' + value + '>';
      return required.includes(flag) ? part : '[' + part + ']';
    })].join(' ');
}

const SUPERVISOR_COMMANDS = { serve: { operands: ['name', 'launch-id'], flags: { '--desktop': true } } };
export const HELP = [
  'Usage: node scripts/tart-vm.js <command>',
  ...Object.entries(COMMANDS).map(([name, spec]) => '  ' + usage(name, spec)),
  '  --help  Show this usage for any command.',
  '  --image defaults to ' + DEFAULT_IMAGE + '.',
  '  --image-gb supplies the size in decimal GB for an uncached image.',
  '  --desktop enables Tart\'s experimental VNC listener on every interface.',
  '  Screen capture and input require start --desktop. Coordinates are framebuffer pixels.',
  '  --button defaults to left. --steps is a positive whole number and defaults to 1.',
  '  --keys takes one combination such as cmd+n, cmd+space, shift+tab or return.',
  '  Modifiers: cmd, shift. Keys: letters, digits, space, return, tab, escape, backspace, delete,',
  '  up, down, left, right, home, end, pageup, pagedown.',
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
    const text = token === '--text' && value !== undefined;
    const coordinate = supported[token] === 'n' && isDesktopCommand(command) && /^-\d+$/.test(value);
    if (!text && !coordinate && (!value || value.startsWith('-'))) {
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
  for (const flag of spec.required ?? []) {
    if (!Object.hasOwn(flags, flag)) usageError(command + ' needs ' + flag + '.', script);
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
  if (isDesktopCommand(command)) return { command, name, ...desktopOptions(command, flags) };
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
    state.run.supervisor_pid === supervisorPid && (!state.run.desktop || (state.run.port !== null && state.rfb?.connected === true));
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

// DES uses one-based, most-significant-bit-first positions in its standard tables.
const DES_KEY_PERMUTATION = [
  57, 49, 41, 33, 25, 17, 9,
  1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27,
  19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15,
  7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29,
  21, 13, 5, 28, 20, 12, 4
];
const DES_SUBKEY_PERMUTATION = [
  14, 17, 11, 24, 1, 5,
  3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8,
  16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55,
  30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53,
  46, 42, 50, 36, 29, 32
];
const DES_ROTATIONS = [
  1, 1, 2, 2, 2, 2, 2, 2,
  1, 2, 2, 2, 2, 2, 2, 1
];
const DES_INITIAL_PERMUTATION = [
  58, 50, 42, 34, 26, 18, 10, 2,
  60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6,
  64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1,
  59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5,
  63, 55, 47, 39, 31, 23, 15, 7
];
const DES_FINAL_PERMUTATION = [
  40, 8, 48, 16, 56, 24, 64, 32,
  39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30,
  37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28,
  35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26,
  33, 1, 41, 9, 49, 17, 57, 25
];
const DES_EXPANSION = [
  32, 1, 2, 3, 4, 5,
  4, 5, 6, 7, 8, 9,
  8, 9, 10, 11, 12, 13,
  12, 13, 14, 15, 16, 17,
  16, 17, 18, 19, 20, 21,
  20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29,
  28, 29, 30, 31, 32, 1
];
const DES_ROUND_PERMUTATION = [
  16, 7, 20, 21, 29, 12, 28, 17,
  1, 15, 23, 26, 5, 18, 31, 10,
  2, 8, 24, 14, 32, 27, 3, 9,
  19, 13, 30, 6, 22, 11, 4, 25
];
const DES_S_BOXES = [
  [
    14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7,
    0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
    4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0,
    15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13
  ],
  [
    15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10,
    3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5,
    0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15,
    13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9
  ],
  [
    10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8,
    13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
    13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7,
    1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12
  ],
  [
    7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15,
    13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
    10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4,
    3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14
  ],
  [
    2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9,
    14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
    4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14,
    11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3
  ],
  [
    12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11,
    10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
    9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6,
    4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13
  ],
  [
    4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1,
    13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
    1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2,
    6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12
  ],
  [
    13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7,
    1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
    7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8,
    2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11
  ],
];

function desPermute(value, width, table) {
  let result = 0n;
  for (const position of table) {
    result = (result << 1n) | ((value >> BigInt(width - position)) & 1n);
  }
  return result;
}

function rotate28(value, shift) {
  return ((value << shift) | (value >> (28n - shift))) & 0xfffffffn;
}

function desRound(right, subkey) {
  const expanded = desPermute(right, 32, DES_EXPANSION) ^ subkey;
  let substituted = 0n;
  for (const [index, box] of DES_S_BOXES.entries()) {
    const group = Number((expanded >> BigInt(42 - index * 6)) & 63n);
    const row = ((group & 32) >> 4) | (group & 1);
    const column = (group >> 1) & 15;
    substituted = (substituted << 4n) | BigInt(box[row * 16 + column]);
  }
  return desPermute(substituted, 32, DES_ROUND_PERMUTATION);
}

export function desEncryptBlock(key, block) {
  if (key.length !== 8 || block.length !== 8) throw new Error('DES needs an 8-byte key and block.');
  const permutedKey = desPermute(Buffer.from(key).readBigUInt64BE(), 64, DES_KEY_PERMUTATION);
  let keyLeft = permutedKey >> 28n;
  let keyRight = permutedKey & 0xfffffffn;
  const permutedBlock = desPermute(Buffer.from(block).readBigUInt64BE(), 64, DES_INITIAL_PERMUTATION);
  let left = permutedBlock >> 32n;
  let right = permutedBlock & 0xffffffffn;
  for (const rotation of DES_ROTATIONS) {
    keyLeft = rotate28(keyLeft, BigInt(rotation));
    keyRight = rotate28(keyRight, BigInt(rotation));
    const subkey = desPermute((keyLeft << 28n) | keyRight, 56, DES_SUBKEY_PERMUTATION);
    [left, right] = [right, left ^ desRound(right, subkey)];
  }
  const encrypted = Buffer.alloc(8);
  encrypted.writeBigUInt64BE(desPermute((right << 32n) | left, 64, DES_FINAL_PERMUTATION));
  return encrypted;
}

export function vncKey(passphrase) {
  const key = Buffer.alloc(8);
  const bytes = typeof passphrase === 'string' ? Buffer.from(passphrase, 'utf8') : passphrase;
  for (let index = 0; index < Math.min(bytes.length, key.length); index += 1) {
    for (let bit = 0; bit < 8; bit += 1) {
      key[index] = (key[index] << 1) | ((bytes[index] >> bit) & 1);
    }
  }
  return key;
}

const RFB_VERSION = 'RFB 003.008\n';
const VNC_AUTH = 2;
const RAW = 0;
const DESKTOP_SIZE = -223;
const BGRX = Buffer.from([32, 24, 0, 1, 0, 255, 0, 255, 0, 255, 16, 8, 0, 0, 0, 0]);
const MAX_SERVER_NAME = 1024 * 1024;
const MAX_FRAMEBUFFER = 256 * 1024 * 1024;

function pixelFormat(bytes) {
  return {
    bpp: bytes[0], depth: bytes[1], bigEndian: Boolean(bytes[2]), trueColour: Boolean(bytes[3]),
    redMax: bytes.readUInt16BE(4), greenMax: bytes.readUInt16BE(6), blueMax: bytes.readUInt16BE(8),
    redShift: bytes[10], greenShift: bytes[11], blueShift: bytes[12]
  };
}

function setEncodings() {
  const bytes = Buffer.alloc(12);
  bytes[0] = 2;
  bytes.writeUInt16BE(2, 2);
  bytes.writeInt32BE(RAW, 4);
  bytes.writeInt32BE(DESKTOP_SIZE, 8);
  return bytes;
}

export function framebufferRequest(width, height) {
  const bytes = Buffer.alloc(10);
  bytes[0] = 3; // Origin (0, 0), non-incremental.
  bytes.writeUInt16BE(width, 6);
  bytes.writeUInt16BE(height, 8);
  return bytes;
}

export class RfbClient {
  #next;
  #key;
  #rectangles;
  #update;
  framebuffer = null;

  constructor(passphrase) {
    this.#key = vncKey(passphrase);
    this.#read(12, this.#version);
  }

  #read(size, parse, discard = false) {
    this.#next = { size, parse, discard, used: 0, buffer: null };
  }

  feed(bytes) {
    if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
    const output = { send: [], events: [] };
    let offset = 0;
    while (offset < bytes.length || this.#next.size === 0) {
      const next = this.#next;
      const count = Math.min(next.size - next.used, bytes.length - offset);
      const part = bytes.subarray(offset, offset + count);
      offset += count;
      if (!next.discard && count < next.size) {
        next.buffer ??= Buffer.alloc(next.size);
        next.buffer.set(part, next.used);
      }
      next.used += count;
      if (next.used === next.size) next.parse.call(this, next.buffer ?? part, output);
    }
    return output;
  }

  #version(bytes, output) {
    const version = bytes.toString('ascii');
    if (version !== RFB_VERSION) throw new Error('RFB server did not offer version 3.8.');
    output.events.push({ type: 'version', version: version.trimEnd() });
    output.send.push(Buffer.from(RFB_VERSION));
    this.#read(1, (count) => {
      if (count[0] === 0) throw new Error('RFB server refused to offer security types.');
      this.#read(count[0], this.#security);
    });
  }

  #security(bytes, output) {
    if (!bytes.includes(VNC_AUTH)) throw new Error('RFB server did not offer VNC authentication (security type 2).');
    output.events.push({ type: 'security', offered: [...bytes], selected: VNC_AUTH });
    output.send.push(Buffer.from([VNC_AUTH]));
    this.#read(16, this.#challenge);
  }

  #challenge(bytes, output) {
    try {
      output.send.push(Buffer.concat([
        desEncryptBlock(this.#key, bytes.subarray(0, 8)),
        desEncryptBlock(this.#key, bytes.subarray(8, 16))
      ]));
    } finally {
      this.#key.fill(0);
      this.#key = null;
    }
    this.#read(4, this.#securityResult);
  }

  #securityResult(bytes, output) {
    const result = bytes.readUInt32BE();
    if (result !== 0) throw new Error('RFB security result failure (' + result + ').');
    output.events.push({ type: 'security-result', result });
    output.send.push(Buffer.from([1])); // ClientInit, shared.
    this.#read(24, this.#serverInit);
  }

  #serverInit(bytes) {
    const width = bytes.readUInt16BE(0);
    const height = bytes.readUInt16BE(2);
    const format = bytes.subarray(4, 20);
    const nameLength = bytes.readUInt32BE(20);
    if (nameLength > MAX_SERVER_NAME) throw new Error('RFB desktop name is too long.');
    this.#read(nameLength, (name, output) => {
      this.#resize(width, height);
      if (!format.subarray(0, 13).equals(BGRX.subarray(0, 13))) {
        output.send.push(Buffer.concat([Buffer.alloc(4), BGRX]));
      }
      output.send.push(setEncodings());
      output.events.push({ type: 'server-init', width, height, format: pixelFormat(format), name: name.toString('utf8') });
      this.#read(1, this.#message);
    });
  }

  #resize(width, height) {
    const size = width * height * 4;
    if (!size || size > MAX_FRAMEBUFFER) throw new Error('RFB framebuffer dimensions are unsupported.');
    this.framebuffer = { width, height, pixels: Buffer.alloc(size) };
  }

  #message(bytes, output) {
    switch (bytes[0]) {
      case 0:
        this.#read(3, (header, result) => {
          this.#rectangles = header.readUInt16BE(1);
          this.#update = { type: 'framebuffer-update', raw: [], resized: false };
          this.#nextRectangle(result);
        });
        break;
      case 1:
        throw new Error('RFB SetColourMapEntries is unsupported. The client requires true colour.');
      case 2:
        output.events.push({ type: 'bell' });
        this.#read(1, this.#message);
        break;
      case 3:
        this.#read(7, (header) => {
          this.#read(header.readUInt32BE(3), (_discarded, result) => {
            result.events.push({ type: 'server-cut-text-dropped' });
            this.#read(1, this.#message);
          }, true);
        });
        break;
      default:
        throw new Error('Unsupported RFB server message ' + bytes[0] + '.');
    }
  }

  #nextRectangle(output) {
    if (this.#rectangles === 0) {
      // The frame these rectangles were written into: a DesktopSize later in the same bytes replaces this.framebuffer.
      // Not enumerable, so comparing or serializing an event never walks the pixels.
      Object.defineProperty(this.#update, 'framebuffer', { value: this.framebuffer, enumerable: false });
      output.events.push(this.#update);
      this.#read(1, this.#message);
      return;
    }
    this.#rectangles -= 1;
    this.#read(12, this.#rectangle);
  }

  #rectangle(bytes, output) {
    const x = bytes.readUInt16BE(0);
    const y = bytes.readUInt16BE(2);
    const width = bytes.readUInt16BE(4);
    const height = bytes.readUInt16BE(6);
    const encoding = bytes.readInt32BE(8);
    if (encoding === DESKTOP_SIZE) {
      this.#resize(width, height);
      this.#update.resized = true;
      output.events.push({ type: 'desktop-size', width, height });
      this.#nextRectangle(output);
      return;
    }
    if (encoding !== RAW) throw new Error('Unsupported RFB rectangle encoding ' + encoding + '.');
    const framebuffer = this.framebuffer;
    if (!width || !height || x + width > framebuffer.width || y + height > framebuffer.height) {
      throw new Error('RFB Raw rectangle is outside the framebuffer.');
    }
    const rowSize = width * 4;
    this.#read(rowSize * height, (pixels, result) => {
      for (let row = 0; row < height; row += 1) {
        const destination = ((y + row) * framebuffer.width + x) * 4;
        framebuffer.pixels.set(pixels.subarray(row * rowSize, (row + 1) * rowSize), destination);
      }
      this.#update.raw.push({ x, y, width, height });
      this.#nextRectangle(result);
    });
  }
}

const PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc;
});

function pngChunk(type, data) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length);
  header.write(type, 4, 'ascii');
  let crc = 0xffffffff;
  for (const bytes of [header.subarray(4), data]) {
    for (const byte of bytes) crc = (crc >>> 8) ^ PNG_CRC_TABLE[(crc ^ byte) & 255];
  }
  const trailer = Buffer.alloc(4);
  trailer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, data, trailer]);
}

export function pngFromBgrx({ pixels, width, height }, deflate) {
  const stride = 1 + width * 3;
  const scanlines = Buffer.alloc(stride * height); // Filter 0 for each row.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const target = y * stride + 1 + x * 3;
      scanlines[target] = pixels[source + 2];
      scanlines[target + 1] = pixels[source + 1];
      scanlines[target + 2] = pixels[source];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2; // RGB.
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', deflate(scanlines)), pngChunk('IEND', Buffer.alloc(0))
  ]);
}

const BUTTONS = { left: 1, middle: 2, right: 4 };
const SCROLL_BUTTONS = { up: 8, down: 16, left: 32, right: 64 };
const MODIFIERS = { cmd: 0xffe9, shift: 0xffe1 };
const KEYS = {
  space: 0x20, return: 0xff0d, tab: 0xff09, escape: 0xff1b, backspace: 0xff08, delete: 0xffff,
  up: 0xff52, down: 0xff54, left: 0xff51, right: 0xff53,
  home: 0xff50, end: 0xff57, pageup: 0xff55, pagedown: 0xff56
};
const SHIFTED = '~!@#$%^&*()_+{}|:"<>?';
// Caps keep one desktop command, which holds the RFB queue while it runs, to well under the client's deadline.
export const MAX_TEXT = 1000;
export const MAX_STEPS = 100;
const UNSHIFTED = '`1234567890-=[]\\;\',./';

function desktopOptions(command, flags) {
  const integer = (flag) => {
    const value = Number(flags[flag]);
    if (!/^-?\d+$/.test(flags[flag]) || !Number.isSafeInteger(value)) {
      usageError(flag + ' must be a whole number.', 'tart-vm');
    }
    return value;
  };
  switch (command) {
    case 'screenshot': return { out: flags['--out'] };
    case 'type':
      if ([...flags['--text']].length > MAX_TEXT) usageError('--text takes at most ' + MAX_TEXT + ' characters. Split longer text into several type commands.', 'tart-vm');
      return { text: flags['--text'] };
    case 'key': return { keys: flags['--keys'] };
    case 'drag':
      return {
        from: { x: integer('--from-x'), y: integer('--from-y') },
        to: { x: integer('--to-x'), y: integer('--to-y') }
      };
    default:
      return {
        x: integer('--x'), y: integer('--y'),
        ...(command === 'click' ? { button: flags['--button'] ?? 'left' } : {}),
        ...(command === 'scroll'
          ? { direction: flags['--direction'], steps: flags['--steps'] === undefined ? 1 : integer('--steps') }
          : {})
      };
  }
}

export function pointerEvent(mask, x, y) {
  const bytes = Buffer.alloc(6);
  bytes[0] = 5;
  bytes[1] = mask;
  bytes.writeUInt16BE(x, 2);
  bytes.writeUInt16BE(y, 4);
  return bytes;
}

export function keyEvent(down, keysym) {
  const bytes = Buffer.alloc(8);
  bytes[0] = 4;
  bytes[1] = Number(down);
  bytes.writeUInt32BE(keysym, 4);
  return bytes;
}

export function textKeyEvents(text) {
  if (typeof text !== 'string') throw new Error('Give the text with --text.');
  const messages = [];
  for (const character of text) {
    const shiftedPunctuation = SHIFTED.indexOf(character);
    const upper = /^[A-Z]$/.test(character);
    const shift = upper || shiftedPunctuation !== -1;
    let keysym;
    if (character === '\n') keysym = KEYS.return;
    else if (character === '\t') keysym = KEYS.tab;
    else if (upper) keysym = character.toLowerCase().charCodeAt(0);
    else if (shift) keysym = UNSHIFTED.charCodeAt(shiftedPunctuation);
    else if (/^[ -~]$/.test(character)) keysym = character.charCodeAt(0);
    else {
      throw new Error('Unsupported character ' + JSON.stringify(character) + ' (U+' +
        character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') +
        '). Use printable US-layout characters, Return or Tab.');
    }
    if (shift) messages.push(keyEvent(true, MODIFIERS.shift));
    messages.push(keyEvent(true, keysym), keyEvent(false, keysym));
    if (shift) messages.push(keyEvent(false, MODIFIERS.shift));
  }
  return messages;
}

function keyCombination(combo) {
  if (typeof combo !== 'string') throw new Error('Give one combination with --keys.');
  const parts = combo.split('+');
  const key = parts.pop();
  const name = key.toLowerCase();
  const keysym = Object.hasOwn(KEYS, name) ? KEYS[name] : /^[a-z0-9]$/.test(name) ? name.charCodeAt(0) : null;
  if (keysym === null) throw new Error('Unknown key ' + JSON.stringify(key) + '. See tart-vm help for supported keys.');
  const modifiers = [];
  for (const part of parts) {
    const modifier = part.toLowerCase();
    if (!Object.hasOwn(MODIFIERS, modifier)) {
      throw new Error('Unknown modifier ' + JSON.stringify(part) + '. Use cmd or shift.');
    }
    const sym = MODIFIERS[modifier];
    if (modifiers.includes(sym)) throw new Error('Repeated modifier ' + JSON.stringify(part) + '. Give each modifier once.');
    modifiers.push(sym);
  }
  const chord = [...modifiers, keysym];
  return [...chord.map((sym) => keyEvent(true, sym)), ...chord.reverse().map((sym) => keyEvent(false, sym))];
}

export function checkPoint(point, { width, height }) {
  if (!Number.isInteger(point?.x) || !Number.isInteger(point?.y) ||
      point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) {
    throw new Error('Pointer coordinates are outside the ' + width + 'x' + height +
      ' framebuffer. Use whole pixels within its bounds.');
  }
}

function pointerStep(mask, { x, y }, delay = 0) {
  return { bytes: pointerEvent(mask, x, y), delay };
}

function dragSteps(from, to) {
  const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  const segments = Math.min(32, Math.max(2, Math.ceil(distance / 16)));
  const events = [pointerStep(0, from, 60), pointerStep(1, from, 16)];
  let previous = from;
  for (let index = 1; index <= segments; index += 1) {
    const x = Math.round(from.x + (to.x - from.x) * index / segments);
    const y = Math.round(from.y + (to.y - from.y) * index / segments);
    if (x === previous.x && y === previous.y) continue;
    previous = { x, y };
    events.push(pointerStep(1, previous, 16));
  }
  events.push(pointerStep(0, to));
  return events;
}

function* scrollSteps(at, mask, steps) {
  yield pointerStep(0, at);
  for (let index = 0; index < steps; index += 1) {
    yield pointerStep(mask, at, 20);
    yield pointerStep(0, at, 20);
  }
}

export function desktopInput(request, framebuffer) {
  const { cmd, x, y, from, to, text, keys, button, direction, steps } = request;
  if (cmd === 'type' && (typeof text !== 'string' || [...text].length > MAX_TEXT)) {
    throw new Error('--text takes at most ' + MAX_TEXT + ' characters. Split longer text into several type commands.');
  }
  if (cmd === 'type' || cmd === 'key') {
    const bytes = cmd === 'type' ? textKeyEvents(text) : keyCombination(keys);
    return {
      events: bytes.map((bytes) => ({ bytes, delay: cmd === 'type' ? 25 : 40 })),
      result: cmd === 'type' ? { length: text.length } : {}
    };
  }
  if (cmd === 'drag') {
    checkPoint(from, framebuffer);
    checkPoint(to, framebuffer);
    return {
      events: dragSteps(from, to),
      result: { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } }
    };
  }
  const at = { x, y };
  checkPoint(at, framebuffer);
  switch (cmd) {
    case 'move':
      return { events: [pointerStep(0, at)], result: at };
    case 'click':
    case 'double-click': {
      const double = cmd === 'double-click';
      const selected = double ? 'left' : button;
      if (!Object.hasOwn(BUTTONS, selected)) {
        throw new Error('Unknown button ' + JSON.stringify(selected) + '. Use left, right or middle.');
      }
      const press = pointerStep(BUTTONS[selected], at, 50);
      const events = [pointerStep(0, at, 60), press, pointerStep(0, at, double ? 80 : 0)];
      if (double) events.push(press, pointerStep(0, at));
      return { events, result: { ...at, button: selected } };
    }
    case 'scroll': {
      if (!Object.hasOwn(SCROLL_BUTTONS, direction)) {
        throw new Error('Unknown scroll direction ' + JSON.stringify(direction) + '. Use up, down, left or right.');
      }
      if (!Number.isSafeInteger(steps) || steps < 1 || steps > MAX_STEPS) {
        throw new Error('--steps must be a whole number from 1 to ' + MAX_STEPS + '.');
      }
      return { events: scrollSteps(at, SCROLL_BUTTONS[direction], steps), result: { ...at, direction, steps } };
    }
    default:
      throw new Error('Unknown desktop command. See tart-vm help.');
  }
}
