#!/usr/bin/env node
/**
 * twenty-relay: print the writers, the login helper, and the state argv.
 * Node built-ins only. The rules every shipped script follows are
 * wiser/standards/script-contract.md. This tool installs no packages, so
 * --install, the contract's consent flag, is refused by name; the install's
 * name is --install-name.
 *
 * The file writers reproduce vm-job's scheduled writers. That builder is not
 * exported, and a tool may not import another tool, so the frame is copied
 * here. The one adaptation is the owner: chown 0:1000 and mode 0640, where
 * vm-job uses chown root:root. The directory writer sets 0750 and 0:1000.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HELP_HINT = 'Run "node scripts/twenty-relay.js help" for usage.';
const INSTALL_RE = /^[a-z][a-z0-9]{1,12}$/;
const LOGIN_RE = /^[a-z0-9-]{1,32}$/;
const UPSTREAM_RE = /^[a-z0-9-]{1,32}$/;
const HOST_RE = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const ACTIONS = new Set(['add', 'rotate', 'remove']);
const WRITER_MAX = 4096;
const WRITER_DELIM = 'VMJOB_EOF';
const FILE_MODE = '0640';
const FILE_OWNER = '0:1000';
const DIR_MODE = '0750';

const PAYLOAD_FILES = ['headers.js', 'relay.js', 'package.json', 'package-lock.json'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const payloadDir = path.join(root, 'payload');

class UsageError extends Error {}

function fail(message) {
  throw new UsageError(message);
}

function codePoints(text) {
  let count = 0;
  for (const _ of text) count += 1;
  return count;
}

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function checkInstall(value) {
  if (!INSTALL_RE.test(value)) {
    fail(`Error: --install-name must match ^[a-z][a-z0-9]{1,12}$; got "${value}". ${HELP_HINT}`);
  }
  return value;
}

function checkLogin(value) {
  if (!LOGIN_RE.test(value)) {
    fail(`Error: --login must match ^[a-z0-9-]{1,32}$; got "${value}". ${HELP_HINT}`);
  }
  return value;
}

function checkDomain(value) {
  const domain = String(value).toLowerCase();
  if (!HOST_RE.test(domain)) {
    fail(`Error: --domain must be an ASCII hostname; got "${value}". ${HELP_HINT}`);
  }
  return domain;
}

function checkUpstream(value) {
  if (!UPSTREAM_RE.test(value)) {
    fail(`Error: --upstream must match ^[a-z0-9-]{1,32}$; got "${value}". ${HELP_HINT}`);
  }
  return value;
}

function checkAction(value) {
  if (!ACTIONS.has(value)) {
    fail(`Error: --action must be add, rotate, or remove; got "${value}". ${HELP_HINT}`);
  }
  return value;
}

function checkTo(value) {
  if (value !== 'send' && value !== 'hold') {
    fail(`Error: --to must be send or hold; got "${value}". ${HELP_HINT}`);
  }
  return value;
}

const HELP = `twenty-relay: print writers, a login helper, and the argv that sets send or hold.

Usage:
  node scripts/twenty-relay.js help
  node scripts/twenty-relay.js writers --install-name <name>
  node scripts/twenty-relay.js login-helper --install-name <name> --login <login> --domain <domain> --upstream <name> --action add|rotate|remove
  node scripts/twenty-relay.js state --install-name <name> --to send|hold

Commands:
  help           Print this usage and exit.
  writers        Print the ordered writers that install the relay program.
  login-helper   Print the shell helper a person runs in a Cloud Shell session.
  state          Print the argv for one vm.command.run that writes state.

writers:
  --install-name <name>  Install name. Required. Matches ^[a-z][a-z0-9]{1,12}$.

login-helper:
  --install-name <name>  Install name. Required.
  --login <login>        Login. Required. Matches ^[a-z0-9-]{1,32}$.
  --domain <domain>      ASCII hostname. Required. Stored lowercase.
  --upstream <name>      Upstream name. Required. Matches ^[a-z0-9-]{1,32}$.
  --action <action>      add, rotate, or remove. Required.

state:
  --install-name <name>  Install name. Required.
  --to <word>            send or hold. Required.

No command takes --env or --install. This tool installs no packages and
reaches no machine; --install-name names the install on the machine.
A flag this command does not name is refused. --flag=value is refused.
A repeated flag is refused. A flag that needs a value, given none or given a
value that starts with -, is refused.
`;

function parseFlags(argv, valueFlags) {
  const known = new Set(valueFlags);
  const bare = new Set(['--help', '-h', 'help']);
  const values = {};
  const seen = new Set();
  let help = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') fail(`Error: unexpected argument "--". ${HELP_HINT}`);
    if (bare.has(token)) {
      help = true;
      continue;
    }
    if (typeof token === 'string' && token.startsWith('-')) {
      if (token === '--install') {
        fail(`Error: --install is refused: this tool installs nothing. Pass the install's name with --install-name. ${HELP_HINT}`);
      }
      if (!known.has(token)) fail(`Error: unknown option "${token}". ${HELP_HINT}`);
      if (seen.has(token)) fail(`Error: ${token} was given more than once and takes one value. ${HELP_HINT}`);
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('-')) fail(`Error: ${token} needs a value. ${HELP_HINT}`);
      seen.add(token);
      values[token] = value;
      index += 1;
      continue;
    }
    fail(`Error: unexpected argument "${token}". ${HELP_HINT}`);
  }
  return { help, values };
}

function requireFlag(values, flag) {
  if (!Object.prototype.hasOwnProperty.call(values, flag)) fail(`Error: ${flag} is required. ${HELP_HINT}`);
  return values[flag];
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

function writerFrame(filePath, mode, body, sha, options) {
  const part = `${filePath}.part`;
  const qpath = shQuote(filePath);
  const refused = shQuote(`writer:part-refused:${filePath}`);
  let script = `p=${shQuote(part)}\n`;
  if (options.first) {
    script += `if [ -L "$p" ]; then echo ${refused}; exit 1; fi\n`;
    script += `if [ -e "$p" ] && [ ! -f "$p" ]; then echo ${refused}; exit 1; fi\n`;
    script += `if [ -f "$p" ]; then rm -f -- "$p" || exit 1; fi\n`;
  } else {
    script += `if [ -L "$p" ] || [ ! -f "$p" ]; then echo ${refused}; exit 1; fi\n`;
  }
  if (body !== '') {
    const redir = options.first ? '>' : '>>';
    script += `cat ${redir} "$p" << '${WRITER_DELIM}'\n${body}${WRITER_DELIM}\n`;
  }
  if (options.last) {
    const mismatch = shQuote(`writer:sha-mismatch:${filePath}`);
    const destRefused = shQuote(`writer:destination-refused:${filePath}`);
    script += `got=$(sha256sum "$p") || { echo ${mismatch}; exit 1; }\n`;
    script += 'got=${got%% *}\n';
    script += `[ "$got" = ${shQuote(sha)} ] || { echo ${mismatch}; exit 1; }\n`;
    script += `chmod ${mode} "$p" || exit 1\n`;
    script += `chown ${FILE_OWNER} "$p" || exit 1\n`;
    script += `if [ -d ${qpath} ] && [ ! -L ${qpath} ]; then echo ${destRefused}; exit 1; fi\n`;
    script += `mv -T -- "$p" ${qpath} || exit 1\n`;
    script += `echo ${shQuote(`installed:${filePath}`)}\n`;
  }
  return script;
}

function writerFits(filePath, mode, body, sha, options) {
  return codePoints(writerFrame(filePath, mode, body, sha, options)) <= WRITER_MAX;
}

function packWriters(kind, filePath, text, mode, sha) {
  if (text.includes(WRITER_DELIM)) fail(`Error: the ${kind} contains the writer delimiter "${WRITER_DELIM}".`);
  const lines = fileLines(text);
  const scripts = [];
  let index = 0;
  while (index < lines.length) {
    const first = scripts.length === 0;
    const remaining = lines.slice(index);
    const all = remaining.join('');
    if (writerFits(filePath, mode, all, sha, { first, last: true })) {
      scripts.push(writerFrame(filePath, mode, all, sha, { first, last: true }));
      break;
    }
    let take = 0;
    let body = '';
    for (let cursor = 0; cursor < remaining.length; cursor += 1) {
      const next = body + remaining[cursor];
      if (!writerFits(filePath, mode, next, sha, { first, last: false })) break;
      body = next;
      take = cursor + 1;
    }
    if (take === 0) {
      const size = codePoints(writerFrame(filePath, mode, remaining[0], sha, { first, last: false }));
      fail(`Error: a ${kind} writer is ${size} code points; the maximum is ${WRITER_MAX}.`);
    }
    scripts.push(writerFrame(filePath, mode, body, sha, { first, last: false }));
    index += take;
    if (index === lines.length) {
      if (!writerFits(filePath, mode, '', sha, { first: false, last: true })) {
        const size = codePoints(writerFrame(filePath, mode, '', sha, { first: false, last: true }));
        fail(`Error: a ${kind} writer is ${size} code points; the maximum is ${WRITER_MAX}.`);
      }
      scripts.push(writerFrame(filePath, mode, '', sha, { first: false, last: true }));
    }
  }
  for (const script of scripts) {
    const size = codePoints(script);
    if (size > WRITER_MAX) fail(`Error: a ${kind} writer is ${size} code points; the maximum is ${WRITER_MAX}.`);
  }
  return scripts;
}

function directoryWriter(directory) {
  const q = shQuote(directory);
  const refused = shQuote(`writer:destination-refused:${directory}`);
  const installed = shQuote(`installed:${directory}`);
  return [
    `if [ -L ${q} ]; then echo ${refused}; exit 1; fi`,
    `if [ -e ${q} ] && [ ! -d ${q} ]; then echo ${refused}; exit 1; fi`,
    `mkdir -p -- ${q} || exit 1`,
    `chmod ${DIR_MODE} ${q} || exit 1`,
    `chown ${FILE_OWNER} ${q} || exit 1`,
    `echo ${installed}`
  ].join('\n');
}

function commandWriters(values) {
  const install = checkInstall(requireFlag(values, '--install-name'));
  const directory = `/opt/${install}/relay/app`;
  const sha256 = {};
  const writers = [['/bin/sh', '-c', `${directoryWriter(directory)}\n`]];
  for (const name of PAYLOAD_FILES) {
    const text = readFileSync(path.join(payloadDir, name), 'utf8');
    const digest = sha256Hex(text);
    sha256[name] = digest;
    const filePath = `${directory}/${name}`;
    const scripts = packWriters(name, filePath, text, FILE_MODE, digest);
    for (const script of scripts) writers.push(['/bin/sh', '-c', script]);
  }
  return {
    command: 'writers',
    install,
    directory,
    directoryMode: DIR_MODE,
    directoryOwner: FILE_OWNER,
    fileMode: FILE_MODE,
    fileOwner: FILE_OWNER,
    sha256,
    writers
  };
}

function helperText() {
  return `set -eu
install=$1
login=$2
domain=$3
upstream=$4
action=$5
die() { printf '%s\\n' "$1" >&2; exit 1; }
[ "$#" -eq 5 ] || die "usage: helper install login domain upstream action"
case "$install" in *[!a-z0-9]*|"") die "invalid install";; esac
first=$(printf '%.1s' "$install")
case "$first" in [a-z]) ;; *) die "invalid install";; esac
n=\${#install}
[ "$n" -ge 2 ] && [ "$n" -le 13 ] || die "invalid install"
case "$login" in *[!a-z0-9-]*|"") die "invalid login";; esac
n=\${#login}
[ "$n" -ge 1 ] && [ "$n" -le 32 ] || die "invalid login"
case "$upstream" in *[!a-z0-9-]*|"") die "invalid upstream";; esac
n=\${#upstream}
[ "$n" -ge 1 ] && [ "$n" -le 32 ] || die "invalid upstream"
case "$action" in add|rotate|remove) ;; *) die "invalid action";; esac
domain=$(printf '%s' "$domain" | tr 'A-Z' 'a-z')
n=\${#domain}
[ "$n" -ge 1 ] && [ "$n" -le 253 ] || die "invalid domain"
case "$domain" in .*|*.) die "invalid domain";; esac
saved=$IFS
IFS=.
set -f
set -- $domain
set +f
IFS=$saved
[ "$#" -ge 1 ] || die "invalid domain"
for label do
  n=\${#label}
  [ "$n" -ge 1 ] && [ "$n" -le 63 ] || die "invalid domain"
  case "$label" in -*|*-|*[!a-z0-9-]*) die "invalid domain";; esac
done
# install, login, domain, upstream and action were saved before set --.
conf=/opt/$install/relay/conf
dest=$conf/logins.json
container=\${install}-relay
hexbytes() {
  od -An -N "$1" -tx1 /dev/urandom | tr -d ' \\n' | tr 'A-F' 'a-f'
}
# The lock is taken before any password exists, so a helper that cannot run
# never prints one; it is held through the rename and the signal.
lockwait=\${TWENTY_RELAY_LOCK_WAIT:-30}
lock=$(dirname "\$conf")/.helper.lock
exec 9>"\$lock"
flock -w "\$lockwait" 9 || die "another helper is running"
password=
salt=
if [ "$action" != remove ]; then
  password=$(hexbytes 32)
  salt=$(hexbytes 16)
  [ "\${#password}" -eq 64 ] || die "could not read the password"
  [ "\${#salt}" -eq 32 ] || die "could not read the salt"
  [ -c /dev/tty ] || die "no terminal"
  printf '%s\\n' "$password" >/dev/tty || die "could not print the password"
fi
tmp=$conf/logins.json.tmp.$$
if [ "$action" = remove ]; then
  prefix=$(python3 - "$dest" "$tmp" "$login" "$domain" <<'PY'
import json, os, sys
dest, tmp, login, domain = sys.argv[1:5]
try:
    with open(dest, 'r', encoding='utf-8') as handle:
        rows = json.load(handle)
except FileNotFoundError:
    rows = []
if not isinstance(rows, list):
    sys.stderr.write('logins file is not a list\\n')
    sys.exit(1)
kept = []
removed = None
for row in rows:
    if isinstance(row, dict) and row.get('login') == login and removed is None:
        removed = row
        continue
    kept.append(row)
if removed is None:
    sys.stderr.write('login is not present\\n')
    sys.exit(1)
if removed.get('domain') != domain:
    sys.stderr.write('login is bound to another domain\\n')
    sys.exit(1)
with open(tmp, 'w', encoding='utf-8') as handle:
    json.dump(kept, handle, indent=2)
    handle.write('\\n')
    handle.flush()
    os.fsync(handle.fileno())
sys.stdout.write(str(removed.get('sha256') or '')[:8])
PY
)
else
  # The program is read into a variable first, so standard input carries
  # only the password, never the program, and the password is not in argv.
  program=$(cat <<'PY'
import datetime, hashlib, json, os, sys
dest, tmp, login, domain, upstream, salt, action = sys.argv[1:8]
password = sys.stdin.read()
if len(password) != 64:
    sys.stderr.write('password length\\n')
    sys.exit(1)
try:
    with open(dest, 'r', encoding='utf-8') as handle:
        rows = json.load(handle)
except FileNotFoundError:
    rows = []
if not isinstance(rows, list):
    sys.stderr.write('logins file is not a list\\n')
    sys.exit(1)
try:
    with open(os.path.join(os.path.dirname(dest), 'upstreams.json'), 'r', encoding='utf-8') as handle:
        upstreams = json.load(handle)
except (OSError, ValueError):
    upstreams = []
if not any(isinstance(row, dict) and row.get('name') == upstream for row in upstreams if isinstance(upstreams, list)):
    sys.stderr.write('upstream is not configured\\n')
    sys.exit(1)
digest = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
created = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
found = None
for index, row in enumerate(rows):
    if isinstance(row, dict) and row.get('login') == login:
        found = index
        break
entry = {
    'login': login,
    'domain': domain,
    'upstream': upstream,
    'salt': salt,
    'sha256': digest,
    'created': created
}
bound = [row.get('login') for row in rows
         if isinstance(row, dict) and row.get('domain') == domain and row.get('login') != login]
if action == 'add':
    if found is not None:
        sys.stderr.write('login is already present\\n')
        sys.exit(1)
    if bound:
        sys.stderr.write('domain is already bound to login %s\\n' % bound[0])
        sys.exit(1)
    rows.append(entry)
elif action == 'rotate':
    if found is None:
        sys.stderr.write('login is not present\\n')
        sys.exit(1)
    if rows[found].get('domain') != domain:
        sys.stderr.write('login is bound to another domain\\n')
        sys.exit(1)
    rows[found] = entry
else:
    sys.stderr.write('action\\n')
    sys.exit(1)
with open(tmp, 'w', encoding='utf-8') as handle:
    json.dump(rows, handle, indent=2)
    handle.write('\\n')
    handle.flush()
    os.fsync(handle.fileno())
sys.stdout.write(digest[:8])
PY
)
  prefix=$(printf '%s' "$password" | python3 -c "$program" "$dest" "$tmp" "$login" "$domain" "$upstream" "$salt" "$action")
fi
password=
salt=
chmod 0640 "$tmp" || die "chmod failed"
chown 0:1000 "$tmp" || die "chown failed"
mv -T -- "$tmp" "$dest" || die "rename failed"
if ! docker kill --signal=HUP -- "$container"; then
  printf 'login=%s\\ndomain=%s\\nhash=%s\\n' "$login" "$domain" "$prefix"
  printf '%s\\n' "logins.json is in place; the relay reads it at its next start or SIGHUP" >&2
  exit 3
fi
printf 'login=%s\\ndomain=%s\\nhash=%s\\n' "$login" "$domain" "$prefix"
`;
}

function commandLoginHelper(values) {
  const install = checkInstall(requireFlag(values, '--install-name'));
  const login = checkLogin(requireFlag(values, '--login'));
  const domain = checkDomain(requireFlag(values, '--domain'));
  const upstream = checkUpstream(requireFlag(values, '--upstream'));
  const action = checkAction(requireFlag(values, '--action'));
  const helper = helperText();
  return {
    command: 'login-helper',
    install,
    login,
    domain,
    upstream,
    action,
    helper,
    argv: ['sh', '-c', helper, 'sh', install, login, domain, upstream, action]
  };
}

function stateScript(install, to) {
  const qInstall = shQuote(install);
  const qTo = shQuote(to);
  return `set -eu
install=${qInstall}
to=${qTo}
die() { printf '%s\\n' "$1" >&2; exit 1; }
case "$install" in *[!a-z0-9]*|"") die "invalid install";; esac
first=$(printf '%.1s' "$install")
case "$first" in [a-z]) ;; *) die "invalid install";; esac
n=\${#install}
[ "$n" -ge 2 ] && [ "$n" -le 13 ] || die "invalid install"
case "$to" in send|hold) ;; *) die "invalid state";; esac
conf=/opt/$install/relay/conf
dest=$conf/state
status=$(dirname "\$conf")/journal/status
wait=\${TWENTY_RELAY_HOLD_WAIT:-130}
tmp=$(mktemp "$conf/state.XXXXXX")
printf '%s' "$to" > "$tmp"
chmod 0640 "$tmp" || die "chmod failed"
chown 0:1000 "$tmp" || die "chown failed"
mv -T -- "$tmp" "$dest" || die "rename failed"
read_status() {
  python3 - "\$status" <<'PY'
import sys
from datetime import datetime, timezone
path = sys.argv[1]
try:
    text = open(path, encoding="utf-8").read()
except OSError:
    sys.stdout.write("missing - - -\\n")
    raise SystemExit(0)
fields = {}
for part in text.split():
    if "=" in part:
        key, value = part.split("=", 1)
        fields[key] = value
stamp = fields.get("time", "")
try:
    when = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    age = int((datetime.now(timezone.utc) - when).total_seconds())
except ValueError:
    sys.stdout.write("bad - - -\\n")
    raise SystemExit(0)
if age < 0:
    age = 0
mark = "fresh" if age <= 15 else "stale"
state = fields.get("state") or "-"
inflight = fields.get("inflight") or "-"
sys.stdout.write("%s %s %s %s\\n" % (mark, state, inflight, age))
PY
}
take() {
  set -- $(read_status)
  mark=\$1
  st=\$2
  inf=\$3
  age=\$4
}
take
if [ "\$to" = hold ]; then
  now=$(date +%s) || die "clock"
  end=\$((now + wait))
  while [ "\$mark" != fresh ] || [ "\$st" != hold ]; do
    now=$(date +%s) || die "clock"
    [ "\$now" -ge "\$end" ] && break
    sleep 1
    take
  done
  while [ "\$mark" != fresh ] || [ "\$st" != hold ] || [ "\$inf" != 0 ]; do
    now=$(date +%s) || die "clock"
    [ "\$now" -ge "\$end" ] && break
    sleep 1
    take
  done
fi
# A count is reported only from a fresh status that has seen the word written.
if [ "\$mark" = fresh ] && [ "\$st" = "\$to" ]; then
  printf 'state=%s\\ninflight=%s\\nstatus-age=%s\\n' "\$to" "\$inf" "\$age"
else
  printf 'state=%s\\ninflight=unknown\\nstatus-age=%s\\n' "\$to" "\$age"
fi
`;
}

function commandState(values) {
  const install = checkInstall(requireFlag(values, '--install-name'));
  const to = checkTo(requireFlag(values, '--to'));
  const script = stateScript(install, to);
  if (codePoints(script) > WRITER_MAX) {
    fail(`Error: the state script is ${codePoints(script)} code points; the maximum is ${WRITER_MAX}.`);
  }
  return {
    command: 'state',
    install,
    to,
    argv: ['/bin/sh', '-c', script, 'sh']
  };
}

function run(argv) {
  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    if (argv.length > 1) fail(`Error: unexpected argument "${argv[1]}". ${HELP_HINT}`);
    return HELP;
  }
  const [command, ...rest] = argv;
  if (command === 'writers') {
    const parsed = parseFlags(rest, ['--install-name']);
    if (parsed.help) return HELP;
    return commandWriters(parsed.values);
  }
  if (command === 'login-helper') {
    const parsed = parseFlags(rest, ['--install-name', '--login', '--domain', '--upstream', '--action']);
    if (parsed.help) return HELP;
    return commandLoginHelper(parsed.values);
  }
  if (command === 'state') {
    const parsed = parseFlags(rest, ['--install-name', '--to']);
    if (parsed.help) return HELP;
    return commandState(parsed.values);
  }
  fail(`Error: unknown command "${command}". ${HELP_HINT}`);
}

try {
  const result = run(process.argv.slice(2));
  if (typeof result === 'string') process.stdout.write(result.endsWith('\n') ? result : `${result}\n`);
  else process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  const message = error instanceof UsageError || (error instanceof Error && error.message)
    ? error.message
    : 'Error: twenty-relay failed.';
  const line = message.startsWith('Error:') ? message : `Error: twenty-relay failed: ${message}`;
  process.stderr.write(line.endsWith('\n') ? line : `${line}\n`);
  process.exit(1);
}
