/**
 * vm-job core. Node built-ins only. No network, no write, no gateway call.
 * The five scripts are the contract texts shipped under scripts/texts/.
 */

import { randomBytes } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

const HELP_HINT = 'Run "node scripts/vm-job.js help" for usage.';

const PURPOSE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UNIT_RE = /^vm-job-[a-z0-9]+(-[a-z0-9]+)*-[0-9]{8}t[0-9]{6}z-[0-9a-f]{6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX32_RE = /^[0-9a-f]{32}$/;
const DIGITS_RE = /^(0|[1-9][0-9]*)$/;

const UNIT_MAX = 120;
const SCRIPT_MAX = 4096;
const OPERAND_MAX = 4096;

// argv is /bin/sh, -c, the script, sh, and then the command's own strings.
// start adds unit, limit, token, and the job text: 8 strings before operands.
// The connector admits at most 64 strings, so start admits at most 56 operands.
// A caller that sends an operation plus 55 package operands uses all 56.
const MAX_OPERANDS = 56;

const SHOW_FIELDS = [
  'LoadState',
  'ActiveState',
  'SubState',
  'Result',
  'ExecMainCode',
  'ExecMainStatus',
  'InvocationID',
  'TasksCurrent',
  'ExecMainStartTimestamp',
  'ExecMainExitTimestamp'
];

const NO_PROCESS = new Set(['', '[not set]', '0']);
const STEPS = new Set(['start', 'poll', 'readback', 'journal', 'release']);

const VALUE_FLAGS = {
  start: ['--purpose', '--limit', '--token', '--script'],
  poll: ['--unit', '--wait'],
  readback: ['--invocation', '--lines'],
  journal: ['--unit', '--lines'],
  release: ['--unit', '--invocation'],
  classify: ['--step', '--answer', '--unit', '--recorded']
};

const REQUIRED = {
  start: ['--purpose', '--limit', '--token', '--script'],
  poll: ['--unit', '--wait'],
  readback: ['--invocation', '--lines'],
  journal: ['--unit', '--lines'],
  release: ['--unit', '--invocation'],
  classify: ['--step', '--answer']
};

function shipped(name) {
  const url = new URL(`./texts/${name}`, import.meta.url);
  const buffer = readFileSync(url);
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
}

export const STARTER = shipped('starter.sh');
export const RELEASE = shipped('release.sh');
export const POLL = shipped('poll.sh');
export const READBACK = shipped('readback.sh');
export const JOURNAL = shipped('journal.sh');

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

function fail(message) {
  throw new UsageError(message);
}

export const HELP = `vm-job: build the argv for one tracked background job, and classify the answer.

Usage:
  node scripts/vm-job.js help
  node scripts/vm-job.js start --purpose <purpose> --limit <seconds> --token <token> --script <file> [-- <operand>...]
  node scripts/vm-job.js poll --unit <unit> --wait <seconds>
  node scripts/vm-job.js readback --invocation <id> --lines <count>
  node scripts/vm-job.js journal --unit <unit> --lines <count>
  node scripts/vm-job.js release --unit <unit> --invocation <id>
  node scripts/vm-job.js classify --step <step> --answer <file> [--unit <unit>] [--recorded <id>]

Commands:
  help        Print this usage and exit.
  start       Print { command, unit, argv } for the starter.
  poll        Print { command, argv } for one poll.
  readback    Print { command, argv } for one read-back by invocation ID.
  journal     Print { command, argv } for one journal read by unit.
  release     Print { command, argv } for the release script.
  classify    Print { command, step, class, finished, facts } for one saved answer.
              finished is present only for step poll.

start:
  --purpose <purpose>   Lowercase letters, digits, and single hyphens. Required.
  --limit <seconds>     A whole number from 1 to 86400, written in digits. Required.
  --token <token>       none, or a lowercase UUID. Required.
  --script <file>       Absolute path of the job script. Required.
  -- <operand>          Each operand, after --. At most 56. An empty operand is allowed.
                        An operand may start with a dash. Without --, a dash is a flag.

poll:
  --unit <unit>         The unit name start printed. Required.
  --wait <seconds>      A whole number from 0 to 40, written in digits. Required.

readback:
  --invocation <id>     32 lowercase hex characters. Required.
  --lines <count>       A whole number from 1 to 2000, written in digits. Required.

journal:
  --unit <unit>         The unit name. Required.
  --lines <count>       A whole number from 1 to 2000, written in digits. Required.

release:
  --unit <unit>         The unit name. Required.
  --invocation <id>     32 lowercase hex characters. Required.

classify:
  --step <step>         start, poll, readback, journal, or release. Required.
  --answer <file>       Absolute path of the gateway answer, one JSON object. Required.
  --unit <unit>         Required when --step is start. Refused on the other steps.
  --recorded <id>       Optional when --step is poll. Refused on the other steps.

A whole number is written in digits with no sign and no leading zero, except 0 itself.
A unit name matches vm-job-<purpose>-<yyyymmddthhmmssz>-<six lowercase hex> and is at most 120 characters.
The job script is UTF-8, at most 4096 code points, contains no NUL, and its first line is exactly set -eu.

No command takes --env. This tool installs nothing, and --install is refused by name like any other unknown flag.
An unknown flag is refused by name before any file is read. A repeated flag is refused.
A flag that needs a value, given none or given a value that starts with -, is refused.
Every path is absolute. A relative path is refused by name.
Success prints one JSON object and exits 0. A refusal prints to stderr, leaves stdout empty, and exits 1.
`;

function stampUtc(date) {
  const pad = (value, width) => String(value).padStart(width, '0');
  return `${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1, 2)}${pad(date.getUTCDate(), 2)}t${pad(date.getUTCHours(), 2)}${pad(date.getUTCMinutes(), 2)}${pad(date.getUTCSeconds(), 2)}z`;
}

function canonical(flag, candidate) {
  const absolute = resolve(candidate);
  const missing = [];
  let head = absolute;
  for (;;) {
    try {
      const real = realpathSync(head);
      return missing.length === 0 ? real : join(real, ...missing);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
        fail(`Error: ${flag} could not be resolved to a real path. Confirm every folder on the way is readable by this account.`);
      }
      const parent = dirname(head);
      if (parent === head) return absolute;
      missing.unshift(basename(head));
      head = parent;
    }
  }
}

function screenFile(flag, value) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`Error: ${flag} needs a path. ${HELP_HINT}`);
  }
  if (!isAbsolute(value)) {
    fail(`Error: ${flag} must be an absolute path; got "${value}".`);
  }
  const resolved = canonical(flag, value);
  let info;
  try {
    info = statSync(resolved);
  } catch {
    fail(`Error: no file at ${resolved}. Pass an absolute path to a readable file.`);
  }
  if (!info.isFile()) {
    fail(`Error: ${flag} ${resolved} is not a file.`);
  }
  try {
    lstatSync(resolved);
  } catch {
    fail(`Error: ${flag} could not be resolved to a real path. Confirm every folder on the way is readable by this account.`);
  }
  return resolved;
}

function readBuffer(flag, resolved) {
  try {
    return readFileSync(resolved);
  } catch {
    fail(`Error: ${flag} at ${resolved} could not be read. Pass an absolute path to a readable file.`);
  }
}

function codePoints(text) {
  let count = 0;
  for (const _ of text) count += 1;
  return count;
}

function wholeNumber(flag, value, min, max) {
  if (!DIGITS_RE.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    fail(`Error: ${flag} must be a whole number from ${min} to ${max} written in digits; got "${value}".`);
  }
  return value;
}

function checkPurpose(value) {
  if (!PURPOSE_RE.test(value)) {
    fail(`Error: --purpose must match ^[a-z0-9]+(-[a-z0-9]+)*$; got "${value}".`);
  }
  return value;
}

function checkUnit(flag, value) {
  if (!UNIT_RE.test(value)) {
    fail(`Error: ${flag} must match ^vm-job-[a-z0-9]+(-[a-z0-9]+)*-[0-9]{8}t[0-9]{6}z-[0-9a-f]{6}$; got "${value}".`);
  }
  if (value.length > UNIT_MAX) {
    fail(`Error: the unit name is ${value.length} characters; the maximum is ${UNIT_MAX}.`);
  }
  return value;
}

function checkToken(value) {
  if (value !== 'none' && !UUID_RE.test(value)) {
    fail(`Error: --token must be none or a lowercase UUID; got "${value}".`);
  }
  return value;
}

function checkHex32(flag, value) {
  if (!HEX32_RE.test(value)) {
    fail(`Error: ${flag} must be 32 lowercase hex characters; got "${value}".`);
  }
  return value;
}

function checkOperands(operands) {
  if (operands.length > MAX_OPERANDS) {
    fail(`Error: ${operands.length} operands is more than ${MAX_OPERANDS}; argv is at most 64 strings.`);
  }
  operands.forEach((operand, index) => {
    if (operand.includes('\0')) {
      fail(`Error: operand ${index + 1} contains a NUL.`);
    }
    const count = codePoints(operand);
    if (count > OPERAND_MAX) {
      fail(`Error: operand ${index + 1} is ${count} code points; the maximum is ${OPERAND_MAX}.`);
    }
  });
}

function readScript(flag, resolved) {
  const buffer = readBuffer(flag, resolved);
  if (buffer.includes(0)) {
    fail(`Error: ${flag} at ${resolved} contains a NUL.`);
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer);
  } catch {
    fail(`Error: ${flag} at ${resolved} is not valid UTF-8.`);
  }
  const count = codePoints(text);
  if (count > SCRIPT_MAX) {
    fail(`Error: the script is ${count} code points; the maximum is ${SCRIPT_MAX}.`);
  }
  const newline = text.indexOf('\n');
  const first = newline === -1 ? text : text.slice(0, newline);
  if (first !== 'set -eu') {
    fail('Error: the script\'s first line must be exactly "set -eu".');
  }
  return text;
}

function readAnswer(resolved) {
  const buffer = readBuffer('--answer', resolved);
  if (buffer.includes(0)) {
    fail(`Error: --answer at ${resolved} contains a NUL.`);
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail(`Error: --answer at ${resolved} is not valid UTF-8.`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(`Error: --answer at ${resolved} is not JSON.`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('Error: --answer must be one JSON object.');
  }
  return parsed;
}

function parseFlags(argv, valueFlags, allowOperands) {
  const known = new Set(valueFlags);
  const bare = new Set(['--help', '-h', 'help']);
  const values = {};
  const seen = new Set();
  const operands = [];
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') {
      if (!allowOperands) {
        fail(`Error: unexpected argument "--". ${HELP_HINT}`);
      }
      operands.push(...argv.slice(index + 1));
      break;
    }
    if (bare.has(token)) {
      help = true;
      continue;
    }
    if (typeof token === 'string' && token.startsWith('-')) {
      if (!known.has(token)) {
        fail(`Error: unknown option "${token}". ${HELP_HINT}`);
      }
      if (seen.has(token)) {
        fail(`Error: ${token} was given more than once and takes one value. ${HELP_HINT}`);
      }
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('-')) {
        fail(`Error: ${token} needs a value. ${HELP_HINT}`);
      }
      seen.add(token);
      values[token] = value;
      index += 1;
      continue;
    }
    fail(`Error: unexpected argument "${token}". ${HELP_HINT}`);
  }
  return { help, values, operands };
}

function requireFlag(values, flag) {
  if (!Object.prototype.hasOwnProperty.call(values, flag)) {
    fail(`Error: ${flag} is required. ${HELP_HINT}`);
  }
  return values[flag];
}

function linesOf(output) {
  if (typeof output !== 'string' || output === '') return [];
  const parts = output.split('\n');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts.map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
}

function lineCount(output) {
  return linesOf(output).length;
}

function afterPrefix(lines, prefix) {
  for (const line of lines) {
    if (line.startsWith(prefix)) return line.slice(prefix.length);
  }
  return null;
}

function unknownFacts(answer) {
  const facts = {};
  if (typeof answer.outcome === 'string') facts.outcome = answer.outcome;
  if (typeof answer.status === 'string') facts.status = answer.status;
  return facts;
}

function invocationFrom(lines, unit) {
  const prefix = `Running as unit: ${unit}.service; invocation ID: `;
  for (const line of lines) {
    if (!line.startsWith(prefix)) continue;
    const id = line.slice(prefix.length);
    if (HEX32_RE.test(id)) return id;
  }
  return null;
}

function classifyStart(answer, unit) {
  if (typeof answer.status === 'string' && answer.status !== '' && answer.status !== 'vendor_error') {
    return { class: 'gateway-status', facts: { status: answer.status } };
  }
  if (answer.status === 'vendor_error') {
    return { class: 'unknown', facts: unknownFacts(answer) };
  }
  const lines = linesOf(answer.output);
  const invocationId = invocationFrom(lines, unit);
  if (invocationId !== null && lines.includes('start-exit:0')) {
    let token = null;
    for (const line of lines) {
      if (line.startsWith('token:') && !line.startsWith('token-changed:')) {
        token = line.slice('token:'.length);
        break;
      }
    }
    return { class: 'started', facts: { invocationId, token } };
  }
  if (lines.includes('existing-job') && answer.exit_code === 10) {
    const units = lines.slice(lines.indexOf('existing-job') + 1).filter((line) => line !== '');
    return { class: 'existing-job', facts: { units } };
  }
  if (lines.includes('lock-busy') && answer.exit_code === 11) {
    return { class: 'lock-busy', facts: {} };
  }
  if (lines.includes('enumeration-failed') && answer.exit_code === 12) {
    return { class: 'enumeration-failed', facts: {} };
  }
  const changed = afterPrefix(lines, 'token-changed:');
  if (changed !== null && answer.exit_code === 15) {
    return { class: 'token-changed', facts: { token: changed } };
  }
  if (lines.includes('token-write-failed') && answer.exit_code === 16) {
    return { class: 'token-write-failed', facts: {} };
  }
  const refused = lines.includes('start-exit:1') && lines.some((line) => (
    line.includes('Failed to find executable') || line.includes('already loaded or has a fragment file')
  ));
  if (refused) {
    return { class: 'refused-before-submission', facts: {} };
  }
  return { class: 'unknown', facts: unknownFacts(answer) };
}

function parseShow(output) {
  const found = {};
  const repeated = [];
  for (const line of linesOf(output)) {
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq);
    if (!SHOW_FIELDS.includes(key)) continue;
    if (Object.prototype.hasOwnProperty.call(found, key)) {
      if (!repeated.includes(key)) repeated.push(key);
      continue;
    }
    found[key] = line.slice(eq + 1);
  }
  return { found, repeated };
}

function showFacts(found) {
  const facts = {};
  for (const key of SHOW_FIELDS) {
    facts[key] = Object.prototype.hasOwnProperty.call(found, key) ? found[key] : null;
  }
  return facts;
}

function adoption(facts, recorded) {
  if (recorded === undefined) {
    const id = facts.InvocationID;
    facts.invocationId = typeof id === 'string' && id !== '' && id !== '[not set]' ? id : null;
  } else {
    facts.recorded = recorded;
  }
  return facts;
}

function idIsSet(value) {
  return typeof value === 'string' && value !== '' && value !== '[not set]';
}

function pollReadable(answer) {
  if (typeof answer.status === 'string' && answer.status !== '') return false;
  if (answer.outcome === 'ok') return true;
  return answer.outcome === 'remote_failure' && typeof answer.machine === 'string' && answer.machine !== '';
}

function classifyPoll(answer, recorded) {
  if (!pollReadable(answer)) {
    return { class: 'not-read', finished: false, facts: adoption(showFacts({}), recorded) };
  }
  const { found, repeated } = parseShow(answer.output);
  if (repeated.length > 0) {
    const facts = adoption(showFacts(found), recorded);
    facts.repeated = repeated;
    if (repeated.includes('InvocationID')) {
      facts.InvocationID = null;
      if (recorded === undefined) facts.invocationId = null;
    }
    return { class: 'unrecognized', finished: false, facts };
  }
  const missing = SHOW_FIELDS.some((key) => !Object.prototype.hasOwnProperty.call(found, key));
  if (missing) {
    return { class: 'not-read', finished: false, facts: adoption(showFacts(found), recorded) };
  }
  const facts = adoption(showFacts(found), recorded);
  if (recorded !== undefined && idIsSet(found.InvocationID) && found.InvocationID !== recorded) {
    return { class: 'other-invocation', finished: false, facts };
  }
  if (found.ActiveState === 'activating' || (found.ActiveState === 'active' && found.SubState === 'running')) {
    return { class: 'running', finished: false, facts };
  }
  if (found.ActiveState === 'deactivating') {
    return { class: 'deactivating', finished: false, facts };
  }
  if (found.ActiveState === 'active' && found.SubState === 'exited' && found.ExecMainCode === '1' && found.ExecMainStatus === '0') {
    return { class: 'succeeded', finished: true, facts };
  }
  if (found.ActiveState === 'active' && found.SubState === 'exited' && found.ExecMainCode !== '1') {
    return { class: 'signal', finished: true, facts };
  }
  if (found.ActiveState === 'failed' && !NO_PROCESS.has(found.TasksCurrent)) {
    return { class: 'stuck', finished: false, facts };
  }
  if (found.ActiveState === 'failed' && found.Result === 'exit-code') {
    return { class: 'failed-exit', finished: true, facts };
  }
  if (found.ActiveState === 'failed' && found.Result === 'timeout') {
    return { class: 'failed-timeout', finished: true, facts };
  }
  if (found.ActiveState === 'failed') {
    return { class: 'failed-other', finished: true, facts };
  }
  if (found.LoadState === 'not-found' || found.LoadState === 'inactive' || found.ActiveState === 'inactive') {
    return { class: 'not-loaded', finished: false, facts };
  }
  return { class: 'unrecognized', finished: false, facts };
}

function noEntries(output) {
  const lines = linesOf(typeof output === 'string' ? output : '')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return lines.length === 0 || (lines.length === 1 && lines[0] === '-- No entries --');
}

function classifyText(answer, journal) {
  if (answer.outcome === 'truncated') {
    return { class: 'truncated', facts: { lines: lineCount(answer.output) } };
  }
  if (answer.outcome !== 'ok') {
    return { class: 'not-read', facts: { lines: null } };
  }
  if (journal && noEntries(answer.output)) {
    return { class: 'no-entries', facts: { lines: 0 } };
  }
  return { class: 'read', facts: { lines: lineCount(answer.output) } };
}

function classifyRelease(answer) {
  if (typeof answer.status === 'string' && answer.status !== '') {
    return { class: 'unknown', facts: unknownFacts(answer) };
  }
  const lines = linesOf(answer.output);
  if (lines.includes('release-exit:0') && lines.includes('load-state:not-found')) {
    return { class: 'released', facts: {} };
  }
  if (lines.includes('lock-busy') && answer.exit_code === 11) {
    return { class: 'lock-busy', facts: {} };
  }
  const mismatch = afterPrefix(lines, 'invocation-mismatch:');
  if (mismatch !== null && answer.exit_code === 13) {
    return { class: 'invocation-mismatch', facts: { invocationId: mismatch } };
  }
  const state = afterPrefix(lines, 'not-finished:');
  if (state !== null && answer.exit_code === 14) {
    return { class: 'not-finished', facts: { state } };
  }
  const tasks = afterPrefix(lines, 'processes-remain:');
  if (tasks !== null && answer.exit_code === 17) {
    return { class: 'processes-remain', facts: { tasks } };
  }
  return { class: 'unknown', facts: unknownFacts(answer) };
}

function verdict(step, result) {
  const object = { command: 'classify', step, class: result.class };
  if (Object.prototype.hasOwnProperty.call(result, 'finished')) object.finished = result.finished;
  object.facts = result.facts;
  return object;
}

function commandStart(values, operands) {
  const purpose = checkPurpose(requireFlag(values, '--purpose'));
  const limit = wholeNumber('--limit', requireFlag(values, '--limit'), 1, 86400);
  const token = checkToken(requireFlag(values, '--token'));
  const scriptPath = screenFile('--script', requireFlag(values, '--script'));
  const script = readScript('--script', scriptPath);
  checkOperands(operands);
  const unit = `vm-job-${purpose}-${stampUtc(new Date())}-${randomBytes(3).toString('hex')}`;
  if (unit.length > UNIT_MAX) {
    fail(`Error: the unit name is ${unit.length} characters; the maximum is ${UNIT_MAX}.`);
  }
  return {
    command: 'start',
    unit,
    argv: ['/bin/sh', '-c', STARTER, 'sh', unit, limit, token, script, ...operands]
  };
}

function commandPoll(values) {
  const unit = checkUnit('--unit', requireFlag(values, '--unit'));
  const wait = wholeNumber('--wait', requireFlag(values, '--wait'), 0, 40);
  return { command: 'poll', argv: ['/bin/sh', '-c', POLL, 'sh', unit, wait] };
}

function commandReadback(values) {
  const id = checkHex32('--invocation', requireFlag(values, '--invocation'));
  const lines = wholeNumber('--lines', requireFlag(values, '--lines'), 1, 2000);
  return { command: 'readback', argv: ['/bin/sh', '-c', READBACK, 'sh', id, lines] };
}

function commandJournal(values) {
  const unit = checkUnit('--unit', requireFlag(values, '--unit'));
  const lines = wholeNumber('--lines', requireFlag(values, '--lines'), 1, 2000);
  return { command: 'journal', argv: ['/bin/sh', '-c', JOURNAL, 'sh', unit, lines] };
}

function commandRelease(values) {
  const unit = checkUnit('--unit', requireFlag(values, '--unit'));
  const id = checkHex32('--invocation', requireFlag(values, '--invocation'));
  return { command: 'release', argv: ['/bin/sh', '-c', RELEASE, 'sh', unit, id] };
}

function commandClassify(values) {
  const step = requireFlag(values, '--step');
  if (!STEPS.has(step)) {
    fail(`Error: --step must be start, poll, readback, journal, or release; got "${step}".`);
  }
  if (step === 'start') {
    if (!Object.prototype.hasOwnProperty.call(values, '--unit')) {
      fail('Error: --unit is required for step start.');
    }
  } else if (Object.prototype.hasOwnProperty.call(values, '--unit')) {
    fail('Error: --unit applies to step start. Drop it, or pass --step start.');
  }
  if (step !== 'poll' && Object.prototype.hasOwnProperty.call(values, '--recorded')) {
    fail('Error: --recorded applies to step poll. Drop it, or pass --step poll.');
  }
  const unit = step === 'start' ? checkUnit('--unit', values['--unit']) : undefined;
  const recorded = step === 'poll' && Object.prototype.hasOwnProperty.call(values, '--recorded')
    ? checkHex32('--recorded', values['--recorded'])
    : undefined;
  const answerPath = screenFile('--answer', requireFlag(values, '--answer'));
  const answer = readAnswer(answerPath);
  if (step === 'start') return verdict(step, classifyStart(answer, unit));
  if (step === 'poll') return verdict(step, classifyPoll(answer, recorded));
  if (step === 'readback') return verdict(step, classifyText(answer, false));
  if (step === 'journal') return verdict(step, classifyText(answer, true));
  return verdict(step, classifyRelease(answer));
}

export function runVmJob(argv) {
  if (!Array.isArray(argv) || argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    const rest = !Array.isArray(argv) || argv.length === 0 ? [] : argv.slice(1);
    parseFlags(rest, [], false);
    return HELP;
  }
  const command = argv[0];
  if (typeof command !== 'string' || command.startsWith('-') || !VALUE_FLAGS[command]) {
    if (typeof command === 'string' && command.startsWith('-')) {
      fail(`Error: unknown option "${command}". ${HELP_HINT}`);
    }
    fail(`Error: unknown command "${command}". ${HELP_HINT}`);
  }
  const parsed = parseFlags(argv.slice(1), VALUE_FLAGS[command], command === 'start');
  if (parsed.help) return HELP;
  for (const flag of REQUIRED[command]) requireFlag(parsed.values, flag);
  if (command === 'start') return commandStart(parsed.values, parsed.operands);
  if (command === 'poll') return commandPoll(parsed.values);
  if (command === 'readback') return commandReadback(parsed.values);
  if (command === 'journal') return commandJournal(parsed.values);
  if (command === 'release') return commandRelease(parsed.values);
  return commandClassify(parsed.values);
}
