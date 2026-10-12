import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

const here = path.dirname(fileURLToPath(import.meta.url));
const toolRoot = path.resolve(here, '..');
const cli = path.join(toolRoot, 'scripts', 'twenty-relay.js');
const payload = path.join(toolRoot, 'payload');
const ttyRun = path.join(here, 'tty-run.py');
// The machine's /bin/sh is dash; run the scripts under it where it is installed.
const SH = existsSync('/bin/dash') ? '/bin/dash' : '/bin/sh';

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

function jsonOf(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

function codePoints(text) {
  let count = 0;
  for (const _ of text) count += 1;
  return count;
}

function binDir(root) {
  const dir = path.join(root, 'bin');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'mv'), `#!/bin/sh
set -eu
src=
dest=
for arg in "$@"; do
  case "$arg" in
    -*) ;;
    *)
      if [ -z "$src" ]; then src=$arg; else dest=$arg; fi
      ;;
  esac
done
/bin/mv -- "$src" "$dest"
`);
  writeFileSync(path.join(dir, 'chown'), `#!/bin/sh
printf '%s\\n' "$*" >> "$CHOWN_LOG"
exit 0
`);
  writeFileSync(path.join(dir, 'docker'), `#!/bin/sh
printf '%s\\n' "$*" >> "$DOCKER_LOG"
if [ "$1" = "logs" ]; then
  if [ "$DOCKER_MODE" = "hold" ]; then
    n=0
    if [ -f "$DOCKER_COUNT" ]; then n=$(cat "$DOCKER_COUNT"); fi
    n=$((n + 1))
    printf '%s' "$n" > "$DOCKER_COUNT"
    if [ "$n" -ge 2 ]; then printf '%s\\n' "inflight count=0"
    else printf '%s\\n' "inflight count=1"
    fi
  elif [ "$DOCKER_MODE" = "quiet" ]; then
    printf '%s\\n' "noise"
  else
    printf '%s\\n' "noise"
    printf '%s\\n' "inflight count=\${DOCKER_COUNT_VALUE:-0}"
  fi
fi
exit 0
`);
  for (const name of ['mv', 'chown', 'docker']) chmodSync(path.join(dir, name), 0o755);
  return dir;
}

function runHelper(helper, args, root) {
  const script = helper.replace('conf=/opt/$install/relay/conf', `conf=${root}/opt/$install/relay/conf`);
  assert.notEqual(script, helper);
  const dir = binDir(root);
  const chownLog = path.join(root, 'chown.log');
  const dockerLog = path.join(root, 'docker.log');
  writeFileSync(chownLog, '');
  writeFileSync(dockerLog, '');
  const scriptPath = path.join(root, 'helper.sh');
  writeFileSync(scriptPath, script);
  const run = spawnSync('python3', [ttyRun, '--', SH, scriptPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      CHOWN_LOG: chownLog,
      DOCKER_LOG: dockerLog,
      DOCKER_MODE: 'send',
      DOCKER_COUNT: path.join(root, 'docker.count')
    },
    timeout: 20000
  });
  assert.equal(run.status, 0, run.stderr);
  const body = JSON.parse(run.stdout);
  body.chownLog = readFileSync(chownLog, 'utf8');
  body.dockerLog = readFileSync(dockerLog, 'utf8');
  return body;
}

describe('twenty-relay cli', { concurrency: 1 }, () => {
  test('help prints usage and writes nothing else', () => {
    const result = runCli(['help']);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /writers --install-name/);
    assert.match(result.stdout, /login-helper/);
    assert.match(result.stdout, /state --install-name/);
  });

  test('unknown flags and a repeated flag are refused before any work', () => {
    for (const args of [
      ['writers', '--nope'],
      ['writers', '--install-name=ab'],
      ['writers', '--install-name', 'ab', '--install-name', 'cd'],
      ['writers', '--install-name', '-ab'],
      ['writers', '--install'],
      ['login-helper', '--install-name', 'ab'],
      ['writers', '--install', 'ab'],
      ['state', '--install-name', 'ab', '--to', 'drop'],
      ['nope']
    ]) {
      const result = runCli(args);
      assert.equal(result.status, 1, args.join(' '));
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /^Error: /);
    }
  });

  test('writers print ordered scripts of at most 4096 code points', () => {
    const body = jsonOf(runCli(['writers', '--install-name', 'ab']));
    assert.equal(body.command, 'writers');
    assert.equal(body.install, 'ab');
    assert.equal(body.directory, '/opt/ab/relay/app');
    assert.equal(body.directoryMode, '0750');
    assert.equal(body.directoryOwner, '0:1000');
    assert.equal(body.fileMode, '0640');
    assert.equal(body.fileOwner, '0:1000');
    assert.deepEqual(Object.keys(body.sha256), ['headers.js', 'relay.js', 'package.json', 'package-lock.json']);
    assert.equal(body.writers[0][0], '/bin/sh');
    assert.equal(body.writers[0][1], '-c');
    assert.match(body.writers[0][2], /mkdir -p/);
    assert.match(body.writers[0][2], /chmod 0750/);
    assert.match(body.writers[0][2], /chown 0:1000/);
    assert.match(body.writers[0][2], /installed:\/opt\/ab\/relay\/app/);
    const seen = [];
    for (const writer of body.writers) {
      assert.deepEqual(writer.slice(0, 2), ['/bin/sh', '-c']);
      assert.ok(codePoints(writer[2]) <= 4096, String(codePoints(writer[2])));
      assert.equal(writer[2].includes('root:root'), false);
      assert.equal(writer[2].includes('chown root'), false);
      const installed = /installed:(\/opt\/ab\/relay\/app(?:\/[A-Za-z0-9.-]+)?)/.exec(writer[2]);
      if (installed) seen.push(installed[1]);
    }
    assert.deepEqual(seen, [
      '/opt/ab/relay/app',
      '/opt/ab/relay/app/headers.js',
      '/opt/ab/relay/app/relay.js',
      '/opt/ab/relay/app/package.json',
      '/opt/ab/relay/app/package-lock.json'
    ]);
    for (const name of Object.keys(body.sha256)) {
      const text = readFileSync(path.join(payload, name), 'utf8');
      const digest = createHash('sha256').update(text, 'utf8').digest('hex');
      assert.equal(body.sha256[name], digest);
      assert.equal(text.endsWith('\n'), true, name);
      assert.equal(text.includes('VMJOB_EOF'), false, name);
    }
  });

  test('the writer scripts install the payload bytes', () => {
    const body = jsonOf(runCli(['writers', '--install-name', 'ab']));
    const root = mkdtempSync(path.join(tmpdir(), 'twenty-relay-writers-'));
    const dir = binDir(root);
    const chownLog = path.join(root, 'chown.log');
    writeFileSync(chownLog, '');
    const app = path.join(root, 'opt', 'ab', 'relay', 'app');
    const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, CHOWN_LOG: chownLog };
    for (const writer of body.writers) {
      const script = writer[2].split('/opt/ab/relay/app').join(app);
      const result = spawnSync(SH, ['-c', script], { encoding: 'utf8', env, timeout: 10000 });
      assert.equal(result.status, 0, result.stderr || result.stdout);
    }
    for (const name of ['headers.js', 'relay.js', 'package.json', 'package-lock.json']) {
      const installed = readFileSync(path.join(app, name));
      const source = readFileSync(path.join(payload, name));
      assert.equal(installed.equals(source), true, name);
      assert.equal(statSync(path.join(app, name)).mode & 0o777, 0o640);
    }
    assert.equal(statSync(app).mode & 0o777, 0o750);
    assert.match(readFileSync(chownLog, 'utf8'), /0:1000/);
    rmSync(root, { recursive: true, force: true });
  });

  test('a writer refuses a symlink part and a bad sha256', () => {
    const body = jsonOf(runCli(['writers', '--install-name', 'ab']));
    const fileWriters = body.writers.filter((writer) => writer[2].startsWith("p='/opt/ab/relay/app/headers.js.part'\n"));
    assert.ok(fileWriters.length >= 2);
    const root = mkdtempSync(path.join(tmpdir(), 'twenty-relay-part-'));
    const app = path.join(root, 'app');
    mkdirSync(app, { recursive: true });
    const part = path.join(app, 'headers.js.part');
    symlinkSync('/tmp', part);
    const script = fileWriters[0][2].split('/opt/ab/relay/app').join(app);
    const refused = spawnSync(SH, ['-c', script], { encoding: 'utf8' });
    assert.equal(refused.status, 1);
    assert.match(refused.stdout, /writer:part-refused:/);
    unlinkSync(part);
    for (const writer of fileWriters.slice(0, -1)) {
      const step = spawnSync(SH, ['-c', writer[2].split('/opt/ab/relay/app').join(app)], { encoding: 'utf8' });
      assert.equal(step.status, 0, step.stdout);
    }
    const lastText = fileWriters[fileWriters.length - 1][2];
    const last = lastText.replace(/\[ "\$got" = '[0-9a-f]{64}' \]/, `[ "$got" = '${'0'.repeat(64)}' ]`);
    assert.notEqual(last, lastText);
    const mismatch = spawnSync(SH, ['-c', last.split('/opt/ab/relay/app').join(app)], { encoding: 'utf8' });
    assert.equal(mismatch.status, 1);
    assert.match(`${mismatch.stdout}\n${mismatch.stderr}`, /writer:sha-mismatch:/);
    rmSync(root, { recursive: true, force: true });
  });

  test('login-helper prints a script that validates its arguments', () => {
    const bad = runCli(['login-helper', '--install-name', 'ab', '--login', 'User', '--domain', 'example.com', '--upstream', 'main', '--action', 'add']);
    assert.equal(bad.status, 1);
    assert.equal(bad.stdout, '');
    const body = jsonOf(runCli([
      'login-helper', '--install-name', 'ab', '--login', 'ada', '--domain', 'Example.COM',
      '--upstream', 'main', '--action', 'add'
    ]));
    assert.equal(body.domain, 'example.com');
    assert.deepEqual(body.argv.slice(0, 3), ['sh', '-c', body.helper]);
    assert.deepEqual(body.argv.slice(3), ['sh', 'ab', 'ada', 'example.com', 'main', 'add']);
    assert.match(body.helper, /\/dev\/tty/);
    assert.match(body.helper, /\/dev\/urandom/);
    assert.match(body.helper, /mv -T --/);
    assert.match(body.helper, /chmod 0640/);
    assert.match(body.helper, /chown 0:1000/);
    assert.match(body.helper, /docker kill --signal=HUP --/);
    assert.match(body.helper, /conf=\/opt\/\$install\/relay\/conf/);
    assert.equal(body.helper.includes('[0-9a-f]{64}'), false);
    assert.equal(/[0-9a-f]{64}/.test(JSON.stringify({ ...body, helper: '' })), false);
  });

  test('the login helper prints the password only on the terminal', () => {
    const body = jsonOf(runCli([
      'login-helper', '--install-name', 'ab', '--login', 'ada', '--domain', 'Example.COM',
      '--upstream', 'main', '--action', 'add'
    ]));
    const root = mkdtempSync(path.join(tmpdir(), 'twenty-relay-helper-'));
    const confDir = path.join(root, 'opt', 'ab', 'relay', 'conf');
    mkdirSync(confDir, { recursive: true });
    const noUpstream = runHelper(body.helper, ['ab', 'ada', 'example.com', 'main', 'add'], root);
    assert.notEqual(noUpstream.code, 0);
    assert.match(noUpstream.stderr, /upstream is not configured/);
    writeFileSync(path.join(confDir, 'upstreams.json'), `${JSON.stringify([{
      name: 'main', host: 'smtp.example.net', port: 465, user: 'api_token', token_file: '/secrets/main.token'
    }])}\n`);
    const ran = runHelper(body.helper, ['ab', 'ada', 'Example.COM', 'main', 'add'], root);
    assert.equal(ran.code, 0, ran.stderr);
    const password = ran.tty.trim();
    assert.match(password, /^[0-9a-f]{64}$/);
    assert.equal(ran.stdout.includes(password), false);
    assert.equal(ran.stderr.includes(password), false);
    assert.match(ran.stdout, /login=ada/);
    assert.match(ran.stdout, /domain=example.com/);
    const dest = path.join(root, 'opt', 'ab', 'relay', 'conf', 'logins.json');
    const rows = JSON.parse(readFileSync(dest, 'utf8'));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].login, 'ada');
    assert.equal(rows[0].domain, 'example.com');
    assert.equal(rows[0].upstream, 'main');
    assert.equal(JSON.stringify(rows).includes(password), false);
    const digest = createHash('sha256').update(rows[0].salt).update(password, 'utf8').digest('hex');
    assert.equal(rows[0].sha256, digest);
    assert.match(ran.stdout, new RegExp(`hash=${digest.slice(0, 8)}`));
    assert.equal(statSync(dest).mode & 0o777, 0o640);
    assert.match(ran.chownLog, /0:1000/);
    assert.match(ran.dockerLog, /kill --signal=HUP -- ab-relay/);

    const before = readFileSync(dest, 'utf8');
    const again = runHelper(body.helper, ['ab', 'ada', 'example.com', 'main', 'add'], root);
    assert.notEqual(again.code, 0);
    assert.match(again.stderr, /already present/);
    assert.equal(readFileSync(dest, 'utf8'), before);
    const second = runHelper(body.helper, ['ab', 'bob', 'example.com', 'main', 'add'], root);
    assert.notEqual(second.code, 0);
    assert.match(second.stderr, /domain is already bound to login ada/);
    assert.equal(readFileSync(dest, 'utf8'), before);
    const otherUp = runHelper(body.helper, ['ab', 'bob', 'other.example', 'spare', 'add'], root);
    assert.notEqual(otherUp.code, 0);
    assert.match(otherUp.stderr, /upstream is not configured/);
    const moved = runHelper(body.helper, ['ab', 'ada', 'other.example', 'main', 'rotate'], root);
    assert.notEqual(moved.code, 0);
    assert.match(moved.stderr, /bound to another domain/);
    assert.equal(readFileSync(dest, 'utf8'), before);
    const wrongRemove = runHelper(body.helper, ['ab', 'ada', 'other.example', 'main', 'remove'], root);
    assert.notEqual(wrongRemove.code, 0);
    assert.match(wrongRemove.stderr, /bound to another domain/);
    assert.equal(readFileSync(dest, 'utf8'), before);

    const rotated = jsonOf(runCli([
      'login-helper', '--install-name', 'ab', '--login', 'ada', '--domain', 'example.com',
      '--upstream', 'main', '--action', 'rotate'
    ]));
    const turned = runHelper(rotated.helper, ['ab', 'ada', 'example.com', 'main', 'rotate'], root);
    assert.equal(turned.code, 0, turned.stderr);
    const nextPassword = turned.tty.trim();
    assert.match(nextPassword, /^[0-9a-f]{64}$/);
    assert.notEqual(nextPassword, password);
    const nextRows = JSON.parse(readFileSync(dest, 'utf8'));
    const nextDigest = createHash('sha256').update(nextRows[0].salt).update(nextPassword, 'utf8').digest('hex');
    assert.equal(nextRows[0].sha256, nextDigest);
    assert.notEqual(nextRows[0].sha256, digest);

    const removed = jsonOf(runCli([
      'login-helper', '--install-name', 'ab', '--login', 'ada', '--domain', 'example.com',
      '--upstream', 'main', '--action', 'remove'
    ]));
    const gone = runHelper(removed.helper, ['ab', 'ada', 'example.com', 'main', 'remove'], root);
    assert.equal(gone.code, 0, gone.stderr);
    assert.equal(gone.tty.trim(), '');
    assert.match(gone.stdout, new RegExp(`hash=${nextDigest.slice(0, 8)}`));
    assert.equal(JSON.parse(readFileSync(dest, 'utf8')).length, 0);
    const invalid = runHelper(body.helper, ['ab', 'ada', 'not_a_domain', 'main', 'add'], root);
    assert.notEqual(invalid.code, 0);
    assert.equal(/[0-9a-f]{64}/.test(invalid.tty), false);
    rmSync(root, { recursive: true, force: true });
  });

  test('state prints one argv that writes send or hold and reads the in-flight count', () => {
    const refused = runCli(['state', '--install-name', 'a', '--to', 'send']);
    assert.equal(refused.status, 1);
    const body = jsonOf(runCli(['state', '--install-name', 'ab', '--to', 'hold']));
    assert.equal(body.command, 'state');
    assert.equal(body.to, 'hold');
    assert.deepEqual(body.argv.slice(0, 2), ['/bin/sh', '-c']);
    assert.equal(body.argv[3], 'sh');
    assert.ok(codePoints(body.argv[2]) <= 4096);
    assert.match(body.argv[2], /\/opt\/\$install\/relay\/conf/);
    assert.match(body.argv[2], /printf '%s' "\$to"/);
    assert.match(body.argv[2], /mv -T --/);
    assert.match(body.argv[2], /chmod 0640/);
    assert.match(body.argv[2], /chown 0:1000/);
    assert.match(body.argv[2], /inflight count=/);
    assert.match(body.argv[2], /\+ 130\)/);
    const root = mkdtempSync(path.join(tmpdir(), 'twenty-relay-state-'));
    const dir = binDir(root);
    const conf = path.join(root, 'opt', 'ab', 'relay', 'conf');
    mkdirSync(conf, { recursive: true });
    const script = body.argv[2].replace('conf=/opt/$install/relay/conf', `conf=${root}/opt/$install/relay/conf`);
    const env = {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      CHOWN_LOG: path.join(root, 'chown.log'),
      DOCKER_LOG: path.join(root, 'docker.log'),
      DOCKER_MODE: 'hold',
      DOCKER_COUNT: path.join(root, 'docker.count')
    };
    writeFileSync(env.CHOWN_LOG, '');
    writeFileSync(env.DOCKER_LOG, '');
    const started = Date.now();
    const held = spawnSync(SH, ['-c', script], { encoding: 'utf8', env, timeout: 8000 });
    const elapsed = Date.now() - started;
    assert.equal(held.status, 0, held.stderr);
    assert.match(held.stdout, /state=hold/);
    assert.match(held.stdout, /inflight=0/);
    assert.ok(elapsed >= 800, String(elapsed));
    assert.ok(elapsed < 8000, String(elapsed));
    assert.equal(readFileSync(path.join(conf, 'state'), 'utf8'), 'hold');
    assert.match(readFileSync(env.CHOWN_LOG, 'utf8'), /0:1000/);

    const sendBody = jsonOf(runCli(['state', '--install-name', 'ab', '--to', 'send']));
    const sendScript = sendBody.argv[2].replace('conf=/opt/$install/relay/conf', `conf=${root}/opt/$install/relay/conf`);
    const sendEnv = { ...env, DOCKER_MODE: 'send', DOCKER_COUNT_VALUE: '2' };
    const sendStarted = Date.now();
    const sent = spawnSync(SH, ['-c', sendScript], { encoding: 'utf8', env: sendEnv, timeout: 3000 });
    assert.equal(sent.status, 0, sent.stderr);
    assert.match(sent.stdout, /state=send/);
    assert.match(sent.stdout, /inflight=2/);
    assert.ok(Date.now() - sendStarted < 1000);
    assert.equal(readFileSync(path.join(conf, 'state'), 'utf8'), 'send');
    assert.equal(readFileSync(path.join(conf, 'state')).equals(Buffer.from('send')), true);
    const silent = spawnSync(SH, ['-c', sendScript], {
      encoding: 'utf8', env: { ...sendEnv, DOCKER_MODE: 'quiet' }, timeout: 3000
    });
    assert.equal(silent.status, 0, silent.stderr);
    assert.match(silent.stdout, /inflight=unknown/);
    rmSync(root, { recursive: true, force: true });
  });

  test('the payload lockfile pins smtp-server 3.19.17', () => {
    const lock = JSON.parse(readFileSync(path.join(payload, 'package-lock.json'), 'utf8'));
    const pkg = JSON.parse(readFileSync(path.join(payload, 'package.json'), 'utf8'));
    const rootPkg = JSON.parse(readFileSync(path.join(toolRoot, 'package.json'), 'utf8'));
    assert.equal(lock.lockfileVersion, 3);
    assert.equal(pkg.dependencies['smtp-server'], '3.19.17');
    assert.equal(lock.packages['node_modules/smtp-server'].version, '3.19.17');
    assert.match(lock.packages['node_modules/smtp-server'].integrity, /^sha512-/);
    assert.equal(rootPkg.scripts.test, 'node --test');
    assert.equal(rootPkg.type, 'module');
    assert.equal(rootPkg.dependencies, undefined);
    assert.equal(rootPkg.engines.node, '>=18.0.0');
  });

  test('shipped text keeps the tool description and leaves out build labels', () => {
    const tool = readFileSync(path.join(toolRoot, 'TOOL.md'), 'utf8');
    const index = readFileSync(path.join(toolRoot, '..', 'AGENTS.md'), 'utf8');
    const description = 'Build the writers that install the mail relay, the login helper a person runs, and the argv that sets the relay to send or hold, as one JSON object';
    assert.match(tool, new RegExp(`description: ${description}`));
    assert.match(index, /`twenty-relay\/TOOL\.md` \| Build the writers that install the mail relay/);
    const shipped = [
      tool,
      readFileSync(cli, 'utf8'),
      readFileSync(path.join(payload, 'relay.js'), 'utf8'),
      readFileSync(path.join(payload, 'headers.js'), 'utf8')
    ].join('\n');
    assert.equal(shipped.includes('zBuilds'), false);
    assert.equal(shipped.includes('RLY-'), false);
    assert.equal(shipped.includes('PB4-'), false);
    assert.equal(shipped.includes('effectivesc'), false);
    assert.match(tool, /^Classifier seam: none\.$/m);
    assert.match(tool, /sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1/);
    assert.match(tool, /3\.19\.17/);
  });
});
