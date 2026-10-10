/**
 * vm-job core. Node built-ins only. No network, no write, no gateway call.
 * The scripts under scripts/texts/ are the contract texts.
 */

import { createHash, randomBytes } from 'node:crypto';
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
const STEPS = new Set(['start', 'poll', 'readback', 'journal', 'release', 'scheduled-record']);

const MACHINE_PATH_RE = /^\/[A-Za-z0-9._/-]{1,200}$/;
const CALENDAR_RE = /^[A-Za-z0-9*:,./ -]{1,64}$/;

// argv is /bin/sh, -c, the script, sh, then the command's own strings.
// A plain start is 8 strings before operands. With stop-post the driver,
// two -p pairs, and the starter text sit in front of those, 13 in all.
const START_ARGV_PREFIX = 8;
const START_STOP_ARGV_PREFIX = 13;
const ARGV_MAX = 64;

const VALUE_FLAGS = {
  start: ['--purpose', '--limit', '--token', '--script', '--stop-post', '--stop-post-timeout'],
  poll: ['--unit', '--wait'],
  readback: ['--invocation', '--lines'],
  journal: ['--unit', '--lines'],
  release: ['--unit', '--invocation'],
  scheduled: ['--purpose', '--limit', '--script-path', '--wrapper-path', '--on-calendar', '--stop-post', '--stop-post-timeout'],
  classify: ['--step', '--answer', '--unit', '--recorded']
};

const REQUIRED = {
  start: ['--purpose', '--limit', '--token', '--script'],
  poll: ['--unit', '--wait'],
  readback: ['--invocation', '--lines'],
  journal: ['--unit', '--lines'],
  release: ['--unit', '--invocation'],
  scheduled: ['--purpose', '--limit', '--script-path', '--wrapper-path', '--on-calendar'],
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
export const STOP_POST = shipped('stop-post.sh');

function sliceBetween(text, startMark, endMark, label) {
  const start = text.indexOf(startMark);
  const end = text.indexOf(endMark);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`vm-job: ${label} is not in the shipped text.`);
  }
  return text.slice(start, end);
}

// The release checks the wrapper runs are this slice of release.sh, so the
// two cannot drift. The slice stops before release.sh's own exit line.
export const RELEASE_CORE = sliceBetween(
  RELEASE,
  'cur=$(systemctl show -p InvocationID --value "$unit.service")',
  'echo "release-exit:$rc"',
  'release checks'
);

// The shim line stop-post.sh installs, and the line the scheduled wrapper
// installs. One source, so the two prepend the same arguments.
export const SHIM_EXEC = (() => {
  const line = STOP_POST.split('\n').find((item) => item.startsWith('exec "$R"'));
  if (!line) throw new Error('vm-job: stop-post shim exec line is missing.');
  return line;
})();

export const ENUM_LINE = (() => {
  const line = STARTER.split('\n').find((item) => item.startsWith('existing=$(systemctl list-units'));
  if (!line) throw new Error('vm-job: starter enumeration line is missing.');
  return line;
})();

export const STARTER_LOCK_LINES = [
  'exec 9>/run/lock/vm-job.lock',
  'flock -w 20 9 || { echo lock-busy; exit 11; }'
];

if (!STARTER.endsWith('\n') || !RELEASE.endsWith('\n') || !STOP_POST.endsWith('\n')) {
  throw new Error('vm-job: a shipped script is missing its trailing newline.');
}
for (const line of STARTER_LOCK_LINES) {
  if (!STARTER.split('\n').includes(line)) {
    throw new Error('vm-job: starter lock line moved.');
  }
}
if (!RELEASE.includes(RELEASE_CORE) || !RELEASE_CORE.includes('active/exited') || !RELEASE_CORE.includes("failed/''*)")) {
  throw new Error('vm-job: release core is not the release text.');
}

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
  node scripts/vm-job.js start --purpose <purpose> --limit <seconds> --token <token> --script <file> [--stop-post <path> --stop-post-timeout <seconds>] [-- <operand>...]
  node scripts/vm-job.js poll --unit <unit> --wait <seconds>
  node scripts/vm-job.js readback --invocation <id> --lines <count>
  node scripts/vm-job.js journal --unit <unit> --lines <count>
  node scripts/vm-job.js release --unit <unit> --invocation <id>
  node scripts/vm-job.js scheduled --purpose <purpose> --limit <seconds> --script-path <path> --wrapper-path <path> --on-calendar <spec> [--stop-post <path> --stop-post-timeout <seconds>] [-- <operand>...]
  node scripts/vm-job.js classify --step <step> --answer <file> [--unit <unit>] [--recorded <id>]

Commands:
  help        Print this usage and exit.
  start       Print { command, unit, argv } for the starter.
  poll        Print { command, argv } for one poll.
  readback    Print { command, argv } for one read-back by invocation ID.
  journal     Print { command, argv } for one journal read by unit.
  release     Print { command, argv } for the release script.
  scheduled   Print { command, purpose, serviceName, timerName, wrapper, service, timer, sha256, writers }.
  classify    Print { command, step, class, finished, facts } for one saved answer.
              finished is present only for step poll.

start:
  --purpose <purpose>         Lowercase letters, digits, and single hyphens. Required.
  --limit <seconds>           A whole number from 1 to 86400, written in digits. Required.
  --token <token>             none, or a lowercase UUID. Required.
  --script <file>             Absolute path of the job script. Required.
  --stop-post <path>          Absolute path of the stop-post script on the machine. Only with --stop-post-timeout.
  --stop-post-timeout <seconds>  A whole number from 30 to 3600, written in digits. Only with --stop-post.
  -- <operand>                Each operand, after --. At most 56, or 51 when --stop-post is set.
                              An empty operand is allowed. An operand may start with a dash.
                              Without --, a dash is a flag.

poll:
  --unit <unit>         The unit name start printed. Required.
  --wait <seconds>      A whole number from 0 to 10, written in digits. Required.

readback:
  --invocation <id>     32 lowercase hex characters. Required.
  --lines <count>       A whole number from 1 to 2000, written in digits. Required.

journal:
  --unit <unit>         The unit name. Required.
  --lines <count>       A whole number from 1 to 2000, written in digits. Required.

release:
  --unit <unit>         The unit name. Required.
  --invocation <id>     32 lowercase hex characters. Required.

scheduled:
  --purpose <purpose>         Lowercase letters, digits, and single hyphens. Required.
  --limit <seconds>           A whole number from 1 to 86400, written in digits. Required.
  --script-path <path>        Absolute path of the job script on the machine. Required.
  --wrapper-path <path>       Absolute path where the skill installs the wrapper. Required.
  --on-calendar <spec>        A systemd calendar expression, checked by pattern only. Required.
  --stop-post <path>          Absolute path of the stop-post script on the machine. Only with --stop-post-timeout.
  --stop-post-timeout <seconds>  A whole number from 30 to 3600, written in digits. Only with --stop-post.
  -- <operand>                Each operand, after --. At most 56. Passed to the job on each firing.

Writers install the wrapper, the service and the timer. Each writer script is at most 4096 code points.
The wrapper text may be longer. A single line that cannot fit in one writer is refused.

classify:
  --step <step>         start, poll, readback, journal, release, or scheduled-record. Required.
  --answer <file>       Absolute path of the gateway answer, one JSON object. Required.
  --unit <unit>         Required when --step is start. Refused on the other steps.
  --recorded <id>       Optional when --step is poll. Refused on the other steps.

A whole number is written in digits with no sign and no leading zero, except 0 itself.
A unit name matches vm-job-<purpose>-<yyyymmddthhmmssz>-<six lowercase hex> and is at most 120 characters.
The job script is UTF-8, at most 4096 code points, contains no NUL, and its first line is exactly set -eu.
--stop-post, --script-path and --wrapper-path match ^/[A-Za-z0-9._/-]{1,200}$, with no ".." segment and no "//".
--on-calendar matches ^[A-Za-z0-9*:,./ -]{1,64}$.

No command takes --env. This tool installs nothing, and --install is refused by name like any other unknown flag.
An unknown flag is refused by name before any file is read. A repeated flag is refused.
A flag that needs a value, given none or given a value that starts with -, is refused.
Every path this tool opens is absolute. A relative path is refused by name.
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

function checkOperands(operands, max = MAX_OPERANDS) {
  if (operands.length > max) {
    fail(`Error: ${operands.length} operands is more than ${max}; argv is at most ${ARGV_MAX} strings.`);
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
  if (typeof answer.action === 'string') facts.action = answer.action;
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
  if (answer.status === 'vendor_error' || answer.status === 'uncertain') {
    return { class: 'unknown', facts: unknownFacts(answer) };
  }
  if (typeof answer.status === 'string' && answer.status !== '') {
    return { class: 'gateway-status', facts: { status: answer.status } };
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

function machinePath(flag, value) {
  if (value.split('/').includes('..')) {
    fail(`Error: ${flag} must not contain a ".." segment; got "${value}".`);
  }
  if (value.includes('//')) {
    fail(`Error: ${flag} must not contain "//"; got "${value}".`);
  }
  if (!value.startsWith('/')) {
    fail(`Error: ${flag} must be an absolute path; got "${value}".`);
  }
  if (!MACHINE_PATH_RE.test(value)) {
    fail(`Error: ${flag} must match ^/[A-Za-z0-9._/-]{1,200}$; got "${value}".`);
  }
  return value;
}

function checkCalendar(value) {
  if (!CALENDAR_RE.test(value)) {
    fail(`Error: --on-calendar must match ^[A-Za-z0-9*:,./ -]{1,64}$; got "${value}".`);
  }
  return value;
}

function readStopPost(values) {
  const hasPath = Object.prototype.hasOwnProperty.call(values, '--stop-post');
  const hasTime = Object.prototype.hasOwnProperty.call(values, '--stop-post-timeout');
  if (!hasPath && !hasTime) return null;
  if (!hasPath || !hasTime) {
    fail(`Error: --stop-post and --stop-post-timeout are required together. ${HELP_HINT}`);
  }
  return {
    path: machinePath('--stop-post', values['--stop-post']),
    timeout: wholeNumber('--stop-post-timeout', values['--stop-post-timeout'], 30, 3600)
  };
}

function assertPurposeFits(purpose) {
  const sample = `vm-job-${purpose}-20261010t000000z-abcdef`;
  if (sample.length > UNIT_MAX) {
    fail(`Error: the unit name is ${sample.length} characters; the maximum is ${UNIT_MAX}.`);
  }
}

function shQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function serviceNameFor(purpose) {
  return `vmjob-scheduled-${purpose}.service`;
}

function timerNameFor(purpose) {
  return `vmjob-scheduled-${purpose}.timer`;
}

// systemd's vm-job-* glob is a prefix match. The scheduled service and timer
// are named vmjob-scheduled-* so a loaded timer never counts as a loaded job.
export function matchesVmJobEnumeration(name) {
  return /^vm-job-/.test(name);
}

function buildService(purpose, wrapperPath) {
  return `[Unit]
Description=scheduled vm-job ${purpose}

[Service]
Type=oneshot
ExecStart=/bin/sh ${wrapperPath}
`;
}

function buildTimer(purpose, spec) {
  return `[Unit]
Description=scheduled vm-job ${purpose}

[Timer]
OnCalendar=${spec}
Persistent=true
RandomizedDelaySec=0
Unit=${serviceNameFor(purpose)}

[Install]
WantedBy=timers.target
`;
}

// The starter's two lock lines are left out of the embedded copy. The wrapper
// already holds that lock, and opening it again on a second file descriptor
// would block until the wrapper's own wait ran out.
function starterWithoutLock() {
  const drop = new Set(STARTER_LOCK_LINES);
  return STARTER.split('\n').filter((line) => !drop.has(line)).join('\n').replace(/\n+$/, '');
}

function buildWrapper(purpose, limit, scriptPath, stop, operands) {
  const lines = [
    '#!/bin/sh',
    'rec() {',
    'mkdir -p /var/lib/vm-job/scheduled || return 1',
    'a=$1; b=$2',
    '[ -n "$a" ] || a=none',
    '[ -n "$b" ] || b=none',
    'tmp="$record.tmp.$$"',
    "printf '%s\\n%s\\n%s\\n' \"$a\" \"$b\" \"$3\" > \"$tmp\" || return 1",
    'mv "$tmp" "$record" || return 1',
    '}',
    'exec 9>/run/lock/vm-job.lock',
    'flock -w 20 9 || { echo scheduled:lock-busy; exit 0; }',
    `limit=${shQuote(limit)}`,
    `script_path=${shQuote(scriptPath)}`,
    `record=/var/lib/vm-job/scheduled/${purpose}`,
    'u=; i=; k=0',
    'if [ -f "$record" ]; then',
    'exec 3< "$record"',
    'IFS= read -r u <&3 || u=',
    'IFS= read -r i <&3 || i=',
    'IFS= read -r k <&3 || k=0',
    'exec 3<&-',
    'fi',
    'case "$k" in 0|[1-9]|[1-9][0-9]*) ;; *) k=0 ;; esac',
    'if [ "$u" = none ]; then u=; fi',
    'if [ "$i" = none ]; then i=; fi',
    ENUM_LINE,
    "set -f; oifs=$IFS; IFS='",
    "'",
    'set -- $existing; IFS=$oifs; set +f',
    'n=0; names=; only=',
    'for line do',
    '[ -z "$line" ] && continue',
    'name=${line%% *}; name=${name%.service}',
    'n=$((n + 1))',
    'if [ "$n" -eq 1 ]; then only=$name; else only=; fi',
    '[ -z "$names" ] && names=$name || names=$names,$name',
    'done',
    'if [ "$i" = pending ] && [ "$n" -eq 1 ] && [ -n "$u" ] && [ "$only" = "$u" ]; then',
    'i=$(systemctl show -p InvocationID --value "$u.service") || i=',
    'fi',
    'released=',
    'if [ "$n" -eq 1 ] && [ -n "$u" ] && [ "$only" = "$u" ]; then',
    'rs=0',
    'release_out=$(',
    'unit=$u; id=$i',
    RELEASE_CORE.trimEnd(),
    'exit "$rc"',
    ') || rs=$?',
    'if [ "$rs" -ne 0 ]; then',
    'first=$(printf \'%s\\n\' "$release_out" | head -n 1)',
    'echo "scheduled:release-refused:$first"',
    'else',
    'tries=0',
    'while [ "$tries" -lt 30 ]; do',
    'load=$(systemctl show -p LoadState --value "$u.service") || load=',
    'if [ "$load" = not-found ]; then released=1; echo "scheduled:released:$u"; break; fi',
    'tries=$((tries + 1))',
    '[ "$tries" -lt 30 ] && sleep 1',
    'done',
    'if [ -z "$released" ]; then',
    'active=$(systemctl show -p ActiveState --value "$u.service") || active=',
    'echo "scheduled:release-incomplete:$u:$active"',
    'rec "$u" "$i" "$((k + 1))" || exit 1',
    'exit 0',
    'fi',
    'fi',
    'fi',
    'if [ "$n" -gt 0 ] && [ -z "$released" ]; then',
    'rec "$u" "$i" "$((k + 1))" || exit 1',
    'echo "scheduled:skipped:$names"',
    'exit 0',
    'fi',
    'expect=$(cat /run/vm-job.token 2>/dev/null || echo none)',
    'job=$(cat "$script_path") || { echo scheduled:script-unreadable; exit 1; }',
    "stamp=$(date -u +%Y%m%dT%H%M%SZ | tr 'A-Z' 'a-z')",
    'rand=$(cat /proc/sys/kernel/random/uuid)',
    "hex=$(printf '%.6s' \"$rand\")",
    `unit="vm-job-${purpose}-\${stamp}-\${hex}"`,
    operands.length === 0 ? 'set --' : `set -- ${operands.map(shQuote).join(' ')}`,
    "sf=$(cat << 'E'",
    starterWithoutLock(),
    'E',
    ')'
  ];
  if (stop) {
    lines.push(
      'R=$(command -v systemd-run) || { echo stop-post-setup-failed; exit 1; }',
      'A=-p',
      `B=${shQuote(`ExecStopPost=/bin/sh ${stop.path}`)}`,
      'C=-p',
      `D=${shQuote(`TimeoutStopSec=${stop.timeout}`)}`,
      'export R A B C D',
      'um=$(umask); umask 077',
      'd=$(mktemp -d /run/vm-job-stop.XXXXXX) || { umask "$um"; echo stop-post-setup-failed; exit 1; }',
      'umask "$um"',
      `printf '%s\\n' '#!/bin/sh' ${shQuote(SHIM_EXEC)} > "$d/systemd-run" || { rm -rf "$d"; echo stop-post-setup-failed; exit 1; }`,
      'chmod 700 "$d/systemd-run" || { rm -rf "$d"; echo stop-post-setup-failed; exit 1; }',
      'trap \'rm -rf "$d"\' EXIT',
      'trap \'exit 143\' TERM HUP INT',
      '"$d/systemd-run" --version >/dev/null 2>&1 || { rm -rf "$d"; echo stop-post-setup-failed; exit 1; }',
      'PATH="$d:$PATH"; export PATH'
    );
  }
  lines.push(
    'rec "$unit" pending "$k" || exit 1',
    'status=0',
    'out=$(set -- "$unit" "$limit" "$expect" "$job" "$@"; eval "$sf") || status=$?',
    'case "$out" in',
    '*"Running as unit: $unit.service; invocation ID: "*"start-exit:0"*)',
    'inv=${out#*"invocation ID: "}',
    'inv=${inv%%[!0-9a-f]*}',
    'if [ "${#inv}" -eq 32 ]; then rec "$unit" "$inv" 0 || exit 1; exit 0; fi',
    'printf \'scheduled:start-unparsed:%s\\n\' "$unit"',
    'printf \'%s\\n\' "$out"',
    'exit "$status"',
    ';;',
    '*"start-exit:0"*)',
    'printf \'scheduled:start-unparsed:%s\\n\' "$unit"',
    'printf \'%s\\n\' "$out"',
    'exit "$status"',
    ';;',
    '*)',
    'printf \'%s\\n\' "$out"',
    'exit "$status"',
    ';;',
    'esac'
  );
  return `${lines.join('\n')}\n`;
}

// Each writer script is at most 4096 code points. The installed text may be longer:
// it is split on line boundaries, and the last writer of each file checks the sha256.
const WRITER_MAX = 4096;
const WRITER_DELIM = 'VMJOB_EOF';

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function fileLines(text) {
  const parts = text.split('\n');
  const lines = [];
  for (let index = 0; index < parts.length; index += 1) {
    if (index === parts.length - 1) {
      if (parts[index] !== '') lines.push(parts[index]);
    } else {
      lines.push(`${parts[index]}\n`);
    }
  }
  return lines;
}

function writerFrame(path, mode, body, sha, options) {
  const part = `${path}.part`;
  let script = '';
  if (body !== '') {
    const redir = options.first ? '>' : '>>';
    script += `cat ${redir} ${shQuote(part)} << '${WRITER_DELIM}'\n${body}${WRITER_DELIM}\n`;
  }
  if (options.last) {
    const mismatch = shQuote(`writer:sha-mismatch:${path}`);
    script += `got=$(sha256sum ${shQuote(part)}) || { echo ${mismatch}; exit 1; }\n`;
    script += 'got=${got%% *}\n';
    script += `[ "$got" = ${shQuote(sha)} ] || { echo ${mismatch}; exit 1; }\n`;
    if (options.syntax) script += `sh -n ${shQuote(part)} || exit 1\n`;
    script += `chmod ${mode} ${shQuote(part)} || exit 1\n`;
    script += `chown root:root ${shQuote(part)} || exit 1\n`;
    script += `mv ${shQuote(part)} ${shQuote(path)} || exit 1\n`;
    script += `echo ${shQuote(`installed:${path}`)}\n`;
  }
  return script;
}

function writerFits(path, mode, body, sha, options) {
  return codePoints(writerFrame(path, mode, body, sha, options)) <= WRITER_MAX;
}

function refuseWriter(kind, path, mode, body, sha, options) {
  const size = codePoints(writerFrame(path, mode, body, sha, options));
  fail(`Error: a ${kind} writer is ${size} code points; the maximum is ${WRITER_MAX}.`);
}

function packWriters(kind, path, text, mode, sha, syntax) {
  if (text.includes(WRITER_DELIM)) {
    fail(`Error: the ${kind} contains the writer delimiter "${WRITER_DELIM}".`);
  }
  const lines = fileLines(text);
  const scripts = [];
  let index = 0;
  while (index < lines.length) {
    const first = scripts.length === 0;
    const remaining = lines.slice(index);
    const all = remaining.join('');
    if (writerFits(path, mode, all, sha, { first, last: true, syntax })) {
      scripts.push(writerFrame(path, mode, all, sha, { first, last: true, syntax }));
      break;
    }
    let take = 0;
    let body = '';
    for (let cursor = 0; cursor < remaining.length; cursor += 1) {
      const next = body + remaining[cursor];
      if (!writerFits(path, mode, next, sha, { first, last: false, syntax })) break;
      body = next;
      take = cursor + 1;
    }
    if (take === 0) {
      refuseWriter(kind, path, mode, remaining[0], sha, { first, last: false, syntax });
    }
    scripts.push(writerFrame(path, mode, body, sha, { first, last: false, syntax }));
    index += take;
    if (index === lines.length) {
      if (!writerFits(path, mode, '', sha, { first: false, last: true, syntax })) {
        refuseWriter(kind, path, mode, '', sha, { first: false, last: true, syntax });
      }
      scripts.push(writerFrame(path, mode, '', sha, { first: false, last: true, syntax }));
    }
  }
  for (const script of scripts) {
    const size = codePoints(script);
    if (size > WRITER_MAX) {
      fail(`Error: a ${kind} writer is ${size} code points; the maximum is ${WRITER_MAX}.`);
    }
  }
  return scripts;
}

function commandStart(values, operands) {
  const purpose = checkPurpose(requireFlag(values, '--purpose'));
  const limit = wholeNumber('--limit', requireFlag(values, '--limit'), 1, 86400);
  const token = checkToken(requireFlag(values, '--token'));
  const stop = readStopPost(values);
  const scriptPath = screenFile('--script', requireFlag(values, '--script'));
  const script = readScript('--script', scriptPath);
  checkOperands(operands, ARGV_MAX - (stop ? START_STOP_ARGV_PREFIX : START_ARGV_PREFIX));
  const unit = `vm-job-${purpose}-${stampUtc(new Date())}-${randomBytes(3).toString('hex')}`;
  if (unit.length > UNIT_MAX) {
    fail(`Error: the unit name is ${unit.length} characters; the maximum is ${UNIT_MAX}.`);
  }
  const argv = stop
    ? [
      '/bin/sh', '-c', STOP_POST, 'sh',
      '-p', `ExecStopPost=/bin/sh ${stop.path}`,
      '-p', `TimeoutStopSec=${stop.timeout}`,
      STARTER, unit, limit, token, script, ...operands
    ]
    : ['/bin/sh', '-c', STARTER, 'sh', unit, limit, token, script, ...operands];
  return { command: 'start', unit, argv };
}

function commandScheduled(values, operands) {
  const purpose = checkPurpose(requireFlag(values, '--purpose'));
  assertPurposeFits(purpose);
  const limit = wholeNumber('--limit', requireFlag(values, '--limit'), 1, 86400);
  const scriptPath = machinePath('--script-path', requireFlag(values, '--script-path'));
  const wrapperPath = machinePath('--wrapper-path', requireFlag(values, '--wrapper-path'));
  const calendar = checkCalendar(requireFlag(values, '--on-calendar'));
  const stop = readStopPost(values);
  checkOperands(operands);
  const serviceName = serviceNameFor(purpose);
  const timerName = timerNameFor(purpose);
  if (matchesVmJobEnumeration(serviceName) || matchesVmJobEnumeration(timerName)) {
    fail('Error: the scheduled unit name matches vm-job-*, so it would count as a loaded job.');
  }
  const wrapper = buildWrapper(purpose, limit, scriptPath, stop, operands);
  const service = buildService(purpose, wrapperPath);
  const timer = buildTimer(purpose, calendar);
  const sha256 = {
    wrapper: sha256Hex(wrapper),
    service: sha256Hex(service),
    timer: sha256Hex(timer)
  };
  const writers = [
    ...packWriters('wrapper', wrapperPath, wrapper, '700', sha256.wrapper, true),
    ...packWriters('service', `/etc/systemd/system/${serviceName}`, service, '644', sha256.service, false),
    ...packWriters('timer', `/etc/systemd/system/${timerName}`, timer, '644', sha256.timer, false)
  ].map((script) => ['/bin/sh', '-c', script]);
  return {
    command: 'scheduled',
    purpose,
    serviceName,
    timerName,
    wrapper,
    service,
    timer,
    sha256,
    writers
  };
}

function commandPoll(values) {
  const unit = checkUnit('--unit', requireFlag(values, '--unit'));
  const wait = wholeNumber('--wait', requireFlag(values, '--wait'), 0, 10);
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

function classifyScheduledRecord(answer) {
  if ((typeof answer.status === 'string' && answer.status !== '') || answer.outcome !== 'ok') {
    return { class: 'not-read', facts: {} };
  }
  const lines = linesOf(answer.output);
  if (lines.length === 1 && lines[0] === 'none') {
    return { class: 'none', facts: {} };
  }
  const skipsOk = lines.length === 3
    && DIGITS_RE.test(lines[2])
    && Number.isSafeInteger(Number(lines[2]));
  if (!skipsOk) return { class: 'not-read', facts: {} };
  const skips = Number(lines[2]);
  if (lines[0] === 'none' && lines[1] === 'none') {
    return { class: 'skips-only', facts: { skips } };
  }
  const unitOk = UNIT_RE.test(lines[0]) && lines[0].length <= UNIT_MAX;
  if (unitOk && lines[1] === 'pending') {
    return { class: 'pending', facts: { unit: lines[0], skips } };
  }
  if (unitOk && HEX32_RE.test(lines[1])) {
    return {
      class: 'recorded',
      facts: { unit: lines[0], invocationId: lines[1], skips }
    };
  }
  return { class: 'not-read', facts: {} };
}

function commandClassify(values) {
  const step = requireFlag(values, '--step');
  if (!STEPS.has(step)) {
    fail(`Error: --step must be start, poll, readback, journal, release, or scheduled-record; got "${step}".`);
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
  if (step === 'scheduled-record') return verdict(step, classifyScheduledRecord(answer));
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
  const parsed = parseFlags(argv.slice(1), VALUE_FLAGS[command], command === 'start' || command === 'scheduled');
  if (parsed.help) return HELP;
  for (const flag of REQUIRED[command]) requireFlag(parsed.values, flag);
  if (command === 'start') return commandStart(parsed.values, parsed.operands);
  if (command === 'poll') return commandPoll(parsed.values);
  if (command === 'readback') return commandReadback(parsed.values);
  if (command === 'journal') return commandJournal(parsed.values);
  if (command === 'release') return commandRelease(parsed.values);
  if (command === 'scheduled') return commandScheduled(parsed.values, parsed.operands);
  return commandClassify(parsed.values);
}
