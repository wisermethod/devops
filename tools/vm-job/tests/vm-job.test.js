import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENUM_LINE,
  RELEASE_CORE,
  SHIM_EXEC,
  STARTER,
  STARTER_LOCK_LINES,
  matchesVmJobEnumeration,
  runVmJob
} from '../scripts/vm-job-core.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'vm-job.js');
const FIXTURES = join(ROOT, 'tests', 'fixtures');
const UNIT_RE = /^vm-job-[a-z0-9]+(-[a-z0-9]+)*-[0-9]{8}t[0-9]{6}z-[0-9a-f]{6}$/;
const POLL = 'sleep "$2"; systemctl show -p LoadState,ActiveState,SubState,Result,ExecMainCode,ExecMainStatus,InvocationID,TasksCurrent,ExecMainStartTimestamp,ExecMainExitTimestamp "$1.service"';
const READBACK = 'journalctl --no-pager -o short-iso -n "$2" _SYSTEMD_INVOCATION_ID="$1" + INVOCATION_ID="$1"';
const JOURNAL = 'journalctl --no-pager -o short-iso -n "$2" -u "$1.service"';
const STARTER_SHA = 'f077696e413cd0f4fa10aebfb0338befad7472a9758f7a7cff3ea987ad8d477a';
const RELEASE_SHA = 'a6a0a011a1f7aebaf99f9fc2798e8d96aa14e6105903449830f0d48aa772855c';
const UNIT = 'vm-job-apt-install-20261005t120000z-abcdef';
const OTHER = 'vm-job-apt-remove-20261005t120001z-123456';
const ID = '0123456789abcdef0123456789abcdef';
const ID2 = 'fedcba9876543210fedcba9876543210';
const TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

function ok(args) {
  const result = run(args);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

function refused(args, pattern) {
  const result = run(args);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, pattern);
  return result.stderr;
}

function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'vm-job-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeScript(dir, text) {
  const path = join(dir, 'job.sh');
  writeFileSync(path, text);
  return path;
}

function writeAnswer(dir, value) {
  const path = join(dir, 'answer.json');
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value));
  return path;
}

function startArgs(dir, extra = [], script = 'set -eu\ntrue\n') {
  const path = writeScript(dir, script);
  return ['start', '--purpose', 'apt-install', '--limit', '1800', '--token', 'none', '--script', path, ...extra];
}

function show(fields) {
  const base = {
    LoadState: 'loaded',
    ActiveState: 'active',
    SubState: 'running',
    Result: 'success',
    ExecMainCode: '0',
    ExecMainStatus: '0',
    InvocationID: ID,
    TasksCurrent: '1',
    ExecMainStartTimestamp: 'Mon 2026-10-05 12:00:00 UTC',
    ExecMainExitTimestamp: ''
  };
  const merged = { ...base, ...fields };
  return Object.entries(merged).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
}

function pollAnswer(dir, fields, outcome = 'ok') {
  return writeAnswer(dir, {
    outcome,
    machine: 'machine-a',
    exit_code: 0,
    output: show(fields)
  });
}

describe('help', () => {
  it('prints usage for help, --help, and -h', () => {
    for (const args of [['help'], ['--help'], ['-h'], [], ['start', '--help'], ['poll', '-h']]) {
      const result = run(args);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, '');
      assert.match(result.stdout, /vm-job/);
      assert.match(result.stdout, /--purpose/);
      assert.match(result.stdout, /--limit/);
      assert.match(result.stdout, /--token/);
      assert.match(result.stdout, /--script/);
      assert.match(result.stdout, /--unit/);
      assert.match(result.stdout, /--wait/);
      assert.match(result.stdout, /--invocation/);
      assert.match(result.stdout, /--lines/);
      assert.match(result.stdout, /--step/);
      assert.match(result.stdout, /--answer/);
      assert.match(result.stdout, /--recorded/);
      assert.match(result.stdout, /--install/);
      assert.match(result.stdout, /--env/);
      assert.match(result.stdout, /--stop-post/);
      assert.match(result.stdout, /--stop-post-timeout/);
      assert.match(result.stdout, /--script-path/);
      assert.match(result.stdout, /--wrapper-path/);
      assert.match(result.stdout, /--on-calendar/);
      assert.match(result.stdout, /scheduled-record/);
    }
  });
});

describe('argv builders', () => {
  it('builds start argv and a fresh unit name', () => {
    withDir((dir) => {
      const first = ok(startArgs(dir, ['--', 'install', 'tree=2.1.1']));
      const second = ok(startArgs(dir, ['--', 'install', 'tree=2.1.1']));
      assert.equal(first.command, 'start');
      assert.match(first.unit, UNIT_RE);
      assert.match(second.unit, UNIT_RE);
      assert.notEqual(first.unit, second.unit);
      assert.match(first.unit, /^vm-job-apt-install-/);
      const starter = readFileSync(join(FIXTURES, 'starter.sh'));
      assert.equal(createHash('sha256').update(starter).digest('hex'), STARTER_SHA);
      assert.deepEqual(Buffer.from(first.argv[2], 'utf8'), starter);
      assert.deepEqual(first.argv.slice(0, 2), ['/bin/sh', '-c']);
      assert.equal(first.argv[3], 'sh');
      assert.equal(first.argv[4], first.unit);
      assert.equal(first.argv[5], '1800');
      assert.equal(first.argv[6], 'none');
      assert.equal(first.argv[7], 'set -eu\ntrue\n');
      assert.deepEqual(first.argv.slice(8), ['install', 'tree=2.1.1']);
      const stamp = first.unit.match(/-(\d{8}t\d{6}z)-[0-9a-f]{6}$/)[1];
      const when = Date.UTC(
        Number(stamp.slice(0, 4)),
        Number(stamp.slice(4, 6)) - 1,
        Number(stamp.slice(6, 8)),
        Number(stamp.slice(9, 11)),
        Number(stamp.slice(11, 13)),
        Number(stamp.slice(13, 15))
      );
      assert.ok(Math.abs(Date.now() - when) < 5000);
    });
  });

  it('keeps an empty operand and a leading-dash operand', () => {
    withDir((dir) => {
      const empty = ok(startArgs(dir, ['--', '']));
      assert.deepEqual(empty.argv.slice(8), ['']);
      const dashed = ok(startArgs(dir, ['--', '-n', '--purge']));
      assert.deepEqual(dashed.argv.slice(8), ['-n', '--purge']);
    });
  });

  it('builds poll, readback, journal, and release argv', () => {
    const poll = ok(['poll', '--unit', UNIT, '--wait', '0']);
    assert.equal(poll.command, 'poll');
    assert.deepEqual(poll.argv, ['/bin/sh', '-c', POLL, 'sh', UNIT, '0']);
    assert.equal(readFileSync(join(ROOT, 'scripts', 'texts', 'poll.sh'), 'utf8'), POLL);

    const readback = ok(['readback', '--invocation', ID, '--lines', '80']);
    assert.equal(readback.command, 'readback');
    assert.deepEqual(readback.argv, ['/bin/sh', '-c', READBACK, 'sh', ID, '80']);

    const journal = ok(['journal', '--unit', UNIT, '--lines', '40']);
    assert.equal(journal.command, 'journal');
    assert.deepEqual(journal.argv, ['/bin/sh', '-c', JOURNAL, 'sh', UNIT, '40']);

    const release = ok(['release', '--unit', UNIT, '--invocation', ID]);
    assert.equal(release.command, 'release');
    const releaseText = readFileSync(join(FIXTURES, 'release.sh'));
    assert.equal(createHash('sha256').update(releaseText).digest('hex'), RELEASE_SHA);
    assert.deepEqual(Buffer.from(release.argv[2], 'utf8'), releaseText);
    assert.deepEqual(release.argv.slice(0, 2), ['/bin/sh', '-c']);
    assert.deepEqual(release.argv.slice(3), ['sh', UNIT, ID]);
  });

  it('accepts 56 operands and refuses 57', () => {
    withDir((dir) => {
      const fiftySix = Array.from({ length: 56 }, (_, index) => `p${index}`);
      const built = ok(startArgs(dir, ['--', ...fiftySix]));
      assert.equal(built.argv.length, 64);
      assert.deepEqual(built.argv.slice(8), fiftySix);
      refused(startArgs(dir, ['--', ...fiftySix, 'one-more']), /57 operands is more than 56/);
    });
  });
});

describe('refusals', () => {
  it('refuses an unknown command and an unknown flag by name, before any file is read', () => {
    refused(['nope'], /unknown command "nope"/);
    refused(['--install'], /unknown option "--install"/);
    refused(['start', '--install'], /unknown option "--install"/);
    refused(['start', '--env', '/tmp/x'], /unknown option "--env"/);
    refused(['help', '--install'], /unknown option "--install"/);
    refused(['start', '--purpose=apt'], /unknown option "--purpose=apt"/);
    withDir((dir) => {
      const missing = join(dir, 'missing.sh');
      refused(['start', '--purpose', 'apt', '--limit', '1', '--token', 'none', '--script', missing, '--install'], /unknown option "--install"/);
    });
  });

  it('refuses a repeated flag, a missing flag, a bare argument, and a value that starts with a dash', () => {
    refused(['start', '--purpose', 'apt', '--purpose', 'apt2'], /--purpose was given more than once/);
    refused(['start'], /--purpose is required/);
    refused(['poll', '--unit', UNIT], /--wait is required/);
    refused(['poll', '--unit', UNIT, '--wait', '1', 'extra'], /unexpected argument "extra"/);
    refused(['start', '--purpose', '-apt'], /--purpose needs a value/);
    refused(['poll', '--wait'], /--wait needs a value/);
  });

  it('refuses a bad purpose, token, limit, wait, lines, invocation, and unit', () => {
    withDir((dir) => {
      const path = writeScript(dir, 'set -eu\n');
      const base = ['start', '--limit', '1', '--token', 'none', '--script', path];
      refused([...base, '--purpose', 'Apt'], /--purpose must match/);
      refused([...base, '--purpose', '-apt'], /--purpose needs a value/);
      refused([...base, '--purpose', 'apt-'], /--purpose must match/);
      refused([...base, '--purpose', 'apt--install'], /--purpose must match/);
      refused(['start', '--purpose', 'apt', '--limit', '1', '--token', 'NONE', '--script', path], /--token must be none or a lowercase UUID/);
      refused(['start', '--purpose', 'apt', '--limit', '1', '--token', 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE', '--script', path], /--token must be none or a lowercase UUID/);
      refused(['start', '--purpose', 'apt', '--limit', '1', '--token', 'not-a-uuid', '--script', path], /--token must be none or a lowercase UUID/);
      refused(['start', '--purpose', 'apt', '--limit', '0', '--token', 'none', '--script', path], /--limit must be a whole number from 1 to 86400/);
      refused(['start', '--purpose', 'apt', '--limit', '86401', '--token', 'none', '--script', path], /--limit must be a whole number from 1 to 86400/);
      refused(['start', '--purpose', 'apt', '--limit', '01', '--token', 'none', '--script', path], /--limit must be a whole number from 1 to 86400/);
      refused(['start', '--purpose', 'apt', '--limit', '1.5', '--token', 'none', '--script', path], /--limit must be a whole number from 1 to 86400/);
      refused(['start', '--purpose', 'apt', '--limit', '+1', '--token', 'none', '--script', path], /--limit must be a whole number from 1 to 86400/);
      refused(['poll', '--unit', UNIT, '--wait', '-1'], /--wait needs a value/);
      refused(['poll', '--unit', UNIT, '--wait', '11'], /--wait must be a whole number from 0 to 10/);
      refused(['poll', '--unit', UNIT, '--wait', '00'], /--wait must be a whole number from 0 to 10/);
      refused(['journal', '--unit', UNIT, '--lines', '0'], /--lines must be a whole number from 1 to 2000/);
      refused(['journal', '--unit', UNIT, '--lines', '2001'], /--lines must be a whole number from 1 to 2000/);
      refused(['readback', '--invocation', ID.slice(1), '--lines', '1'], /--invocation must be 32 lowercase hex/);
      refused(['readback', '--invocation', ID.toUpperCase(), '--lines', '1'], /--invocation must be 32 lowercase hex/);
      refused(['release', '--unit', 'apt.service', '--invocation', ID], /--unit must match/);
      refused(['release', '--unit', `${'a'.repeat(90)}`, '--invocation', ID], /--unit must match/);
      const longPurpose = 'a'.repeat(90);
      const longUnit = `vm-job-${longPurpose}-20261005t120000z-abcdef`;
      assert.equal(longUnit.length, 121);
      assert.match(longUnit, UNIT_RE);
      refused(['poll', '--unit', longUnit, '--wait', '0'], /the unit name is 121 characters/);
    });
  });

  it('accepts the boundary numbers, a lowercase UUID, and a 120-character unit', () => {
    withDir((dir) => {
      const path = writeScript(dir, 'set -eu\n');
      const built = ok(['start', '--purpose', 'apt', '--limit', '86400', '--token', TOKEN, '--script', path]);
      assert.equal(built.argv[5], '86400');
      assert.equal(built.argv[6], TOKEN);
      ok(['start', '--purpose', 'apt', '--limit', '1', '--token', 'none', '--script', path]);
      ok(['poll', '--unit', UNIT, '--wait', '0']);
      ok(['poll', '--unit', UNIT, '--wait', '10']);
      ok(['journal', '--unit', UNIT, '--lines', '1']);
      ok(['journal', '--unit', UNIT, '--lines', '2000']);
      const purpose = 'a'.repeat(89);
      const unit = `vm-job-${purpose}-20261005t120000z-abcdef`;
      assert.equal(unit.length, 120);
      const polled = ok(['poll', '--unit', unit, '--wait', '1']);
      assert.equal(polled.argv[4], unit);
      const started = ok(['start', '--purpose', purpose, '--limit', '1', '--token', 'none', '--script', path]);
      assert.equal(started.unit.length, 120);
      refused(['start', '--purpose', 'a'.repeat(90), '--limit', '1', '--token', 'none', '--script', path], /the unit name is 121 characters/);
    });
  });

  it('refuses a relative path by name, and a missing, non-file, unreadable, or bad script', () => {
    refused(['poll', '--unit', UNIT, '--wait', '0', '--script', 'job.sh'], /unknown option "--script"/);
    withDir((dir) => {
      refused(['start', '--purpose', 'apt', '--limit', '1', '--token', 'none', '--script', 'job.sh'], /--script must be an absolute path/);
      refused(['start', '--purpose', 'apt', '--limit', '1', '--token', 'none', '--script', join(dir, 'missing.sh')], /no file at/);
      refused(['start', '--purpose', 'apt', '--limit', '1', '--token', 'none', '--script', dir], /is not a file/);
      const path = writeScript(dir, 'set -eu\n');
      chmodSync(path, 0);
      try {
        const result = run(['start', '--purpose', 'apt', '--limit', '1', '--token', 'none', '--script', path]);
        if (typeof process.getuid === 'function' && process.getuid() === 0) {
          assert.equal(result.status, 0);
        } else {
          assert.equal(result.status, 1);
          assert.equal(result.stdout, '');
          assert.match(result.stderr, /could not be read/);
        }
      } finally {
        chmodSync(path, 0o644);
      }
      refused(startArgs(dir, [], 'set -e\n'), /first line must be exactly "set -eu"/);
      refused(startArgs(dir, [], 'set -eu \n'), /first line must be exactly "set -eu"/);
      refused(startArgs(dir, [], 'set -euo pipefail\n'), /first line must be exactly "set -eu"/);
      refused(startArgs(dir, [], '#!/bin/sh\nset -eu\n'), /first line must be exactly "set -eu"/);
      const nul = join(dir, 'nul.sh');
      writeFileSync(nul, Buffer.from('set -eu\n\0', 'utf8'));
      refused(['start', '--purpose', 'apt', '--limit', '1', '--token', 'none', '--script', nul], /contains a NUL/);
      const bad = join(dir, 'bad.sh');
      writeFileSync(bad, Buffer.from([0xff, 0xfe, 0xfd]));
      refused(['start', '--purpose', 'apt', '--limit', '1', '--token', 'none', '--script', bad], /not valid UTF-8/);
      const exact = `set -eu\n${'a'.repeat(4087)}${String.fromCodePoint(0x1f600)}`;
      assert.equal(Array.from(exact).length, 4096);
      assert.equal(exact.length, 4097);
      const accepted = ok(startArgs(dir, [], exact));
      assert.equal(accepted.argv[7], exact);
      const over = `${exact}b`;
      refused(startArgs(dir, [], over), /the script is 4097 code points/);
      const longOperand = 'x'.repeat(4097);
      refused(startArgs(dir, ['--', longOperand]), /operand 1 is 4097 code points/);
      const maxOperand = 'x'.repeat(4096);
      const held = ok(startArgs(dir, ['--', maxOperand]));
      assert.equal(held.argv[8], maxOperand);
    });
  });

  it('refuses an operand that contains a NUL when the function is called with one', () => {
    withDir((dir) => {
      const path = writeScript(dir, 'set -eu\n');
      assert.throws(
        () => runVmJob(['start', '--purpose', 'apt', '--limit', '1', '--token', 'none', '--script', path, '--', 'a\0b']),
        /operand 1 contains a NUL/
      );
    });
  });

  it('refuses a bad classify answer', () => {
    withDir((dir) => {
      refused(['classify', '--step', 'poll', '--answer', 'answer.json'], /--answer must be an absolute path/);
      refused(['classify', '--step', 'poll', '--answer', join(dir, 'missing.json')], /no file at/);
      refused(['classify', '--step', 'poll', '--answer', dir], /is not a file/);
      const text = writeAnswer(dir, 'not json');
      refused(['classify', '--step', 'poll', '--answer', text], /is not JSON/);
      for (const value of ['[]', 'null', '"ok"', '4']) {
        const path = writeAnswer(dir, value);
        refused(['classify', '--step', 'poll', '--answer', path], /must be one JSON object/);
      }
      const bytes = join(dir, 'bytes.json');
      writeFileSync(bytes, Buffer.from([0xff, 0xfe]));
      refused(['classify', '--step', 'poll', '--answer', bytes], /not valid UTF-8/);
      const answer = writeAnswer(dir, { outcome: 'ok', output: '' });
      refused(['classify', '--step', 'nope', '--answer', answer], /--step must be/);
      refused(['classify', '--step', 'start', '--answer', answer], /--unit is required for step start/);
      refused(['classify', '--step', 'poll', '--answer', answer, '--unit', UNIT], /--unit applies to step start/);
      refused(['classify', '--step', 'start', '--unit', UNIT, '--answer', answer, '--recorded', ID], /--recorded applies to step poll/);
      refused(['classify', '--answer', answer], /--step is required/);
    });
  });
});

describe('classify start', () => {
  function classify(dir, answer, unit = UNIT) {
    const path = writeAnswer(dir, answer);
    return ok(['classify', '--step', 'start', '--unit', unit, '--answer', path]);
  }

  it('covers every start class', () => {
    withDir((dir) => {
      const started = classify(dir, {
        outcome: 'ok',
        machine: 'machine-a',
        exit_code: 0,
        output: `token:${TOKEN}\nRunning as unit: ${UNIT}.service; invocation ID: ${ID}\nstart-exit:0\n`
      });
      assert.equal(started.class, 'started');
      assert.equal(started.finished, undefined);
      assert.deepEqual(started.facts, { invocationId: ID, token: TOKEN });
      assert.equal(Object.hasOwn(started, 'finished'), false);

      const startedBeside = classify(dir, {
        outcome: 'ok',
        exit_code: 0,
        output: `token-changed:${TOKEN}\ntoken:real-token\nRunning as unit: ${UNIT}.service; invocation ID: ${ID}\nstart-exit:0\n`
      });
      assert.equal(startedBeside.class, 'started');
      assert.equal(startedBeside.facts.token, 'real-token');

      const existing = classify(dir, {
        outcome: 'remote_failure',
        exit_code: 10,
        output: 'existing-job\nvm-job-apt-update-20261005t120000z-abc123.service loaded active running\n'
      });
      assert.equal(existing.class, 'existing-job');
      assert.deepEqual(existing.facts.units, ['vm-job-apt-update-20261005t120000z-abc123.service loaded active running']);

      assert.equal(classify(dir, { outcome: 'remote_failure', exit_code: 11, output: 'lock-busy\n' }).class, 'lock-busy');
      assert.equal(classify(dir, { outcome: 'remote_failure', exit_code: 12, output: 'enumeration-failed\n' }).class, 'enumeration-failed');
      const changed = classify(dir, { outcome: 'remote_failure', exit_code: 15, output: `token-changed:${TOKEN}\n` });
      assert.equal(changed.class, 'token-changed');
      assert.equal(changed.facts.token, TOKEN);
      assert.equal(classify(dir, { outcome: 'remote_failure', exit_code: 16, output: 'token-write-failed\n' }).class, 'token-write-failed');

      const refusedRun = classify(dir, {
        outcome: 'remote_failure',
        exit_code: 1,
        output: 'Failed to find executable /bin/missing\nstart-exit:1\n'
      });
      assert.equal(refusedRun.class, 'refused-before-submission');
      const fragment = classify(dir, {
        outcome: 'remote_failure',
        exit_code: 1,
        output: 'Unit is already loaded or has a fragment file.\nstart-exit:1\n'
      });
      assert.equal(fragment.class, 'refused-before-submission');

      for (const status of ['needs_confirmation', 'denied', 'invalid_arguments', 'needs_connect', 'needs_provider_capability']) {
        const gateway = classify(dir, { status });
        assert.equal(gateway.class, 'gateway-status');
        assert.deepEqual(gateway.facts, { status });
      }

      const cases = [
        [{ outcome: 'timeout' }, 'timeout'],
        [{ outcome: 'killed', machine: 'machine-a' }, 'killed'],
        [{ outcome: 'request_timeout' }, 'request_timeout'],
        [{ outcome: 'connect_timeout' }, 'connect_timeout'],
        [{ outcome: 'busy' }, 'busy'],
        [{ status: 'vendor_error' }, 'vendor_error'],
        [{ outcome: 'remote_failure', exit_code: 1, output: 'boom\n' }, 'remote_failure'],
        [{ outcome: 'remote_failure', exit_code: 9, output: 'start-exit:9\n', machine: 'machine-a' }, 'remote_failure'],
        [{ outcome: 'ok', exit_code: 0, output: 'start-exit:0\n', machine: 'machine-a' }, 'ok']
      ];
      for (const [answer, outcome] of cases) {
        const result = classify(dir, answer);
        assert.equal(result.class, 'unknown', outcome);
        assert.equal(result.command, 'classify');
        assert.equal(result.step, 'start');
      }
    });
  });

  it('requires the marker and the exit code together, and the named unit', () => {
    withDir((dir) => {
      assert.equal(classify(dir, { outcome: 'remote_failure', exit_code: 10, output: 'nope\n' }).class, 'unknown');
      assert.equal(classify(dir, { outcome: 'ok', exit_code: 0, output: 'existing-job\nunit.service\n' }).class, 'unknown');
      assert.equal(classify(dir, { outcome: 'remote_failure', exit_code: 11, output: 'lock busy\n' }).class, 'unknown');
      assert.equal(classify(dir, { outcome: 'remote_failure', exit_code: 1, output: 'start-exit:1\n' }).class, 'unknown');
      const otherUnit = classify(dir, {
        outcome: 'ok',
        exit_code: 0,
        output: `Running as unit: ${OTHER}.service; invocation ID: ${ID}\nstart-exit:0\n`
      });
      assert.equal(otherUnit.class, 'unknown');
    });
  });
});

describe('classify poll', () => {
  function classify(dir, answer, recorded) {
    const path = typeof answer === 'string' ? answer : writeAnswer(dir, answer);
    const args = ['classify', '--step', 'poll', '--answer', path];
    if (recorded) args.push('--recorded', recorded);
    return ok(args);
  }

  it('covers every poll class', () => {
    withDir((dir) => {
      const notRead = classify(dir, { outcome: 'timeout', machine: 'machine-a' });
      assert.equal(notRead.class, 'not-read');
      assert.equal(notRead.finished, false);
      assert.equal(notRead.facts.invocationId, null);
      assert.equal(notRead.facts.LoadState, null);

      const missing = classify(dir, pollAnswer(dir, { InvocationID: undefined }));
      // undefined still spreads; build a file with one field removed instead
      assert.equal(missing.class, 'running');
      const dropped = { ...Object.fromEntries(show({}).trim().split('\n').map((line) => line.split('='))), ExecMainExitTimestamp: '' };
      delete dropped.TasksCurrent;
      const text = Object.entries(dropped).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
      const missingFile = writeAnswer(dir, { outcome: 'ok', output: text, exit_code: 0 });
      const missingClass = classify(dir, missingFile);
      assert.equal(missingClass.class, 'not-read');
      assert.equal(missingClass.facts.TasksCurrent, null);
      assert.equal(missingClass.facts.LoadState, 'loaded');

      const other = classify(dir, { outcome: 'ok', output: show({}), exit_code: 0 }, ID2);
      assert.equal(other.class, 'other-invocation');
      assert.equal(other.finished, false);
      assert.equal(other.facts.recorded, ID2);
      assert.equal(other.facts.InvocationID, ID);
      assert.equal(Object.hasOwn(other.facts, 'invocationId'), false);

      const same = classify(dir, { outcome: 'ok', output: show({}), exit_code: 0 }, ID);
      assert.equal(same.class, 'running');
      assert.equal(same.facts.recorded, ID);

      const adopted = classify(dir, { outcome: 'ok', output: show({}), exit_code: 0 });
      assert.equal(adopted.class, 'running');
      assert.equal(adopted.facts.invocationId, ID);
      assert.equal(adopted.finished, false);

      const activating = classify(dir, { outcome: 'ok', output: show({ ActiveState: 'activating', SubState: 'start' }), exit_code: 0 });
      assert.equal(activating.class, 'running');

      const deactivating = classify(dir, {
        outcome: 'ok',
        output: show({ ActiveState: 'deactivating', SubState: 'stop', Result: 'timeout' }),
        exit_code: 0
      });
      assert.equal(deactivating.class, 'deactivating');
      assert.equal(deactivating.finished, false);

      const succeeded = classify(dir, {
        outcome: 'ok',
        output: show({ ActiveState: 'active', SubState: 'exited', ExecMainCode: '1', ExecMainStatus: '0', TasksCurrent: '0' }),
        exit_code: 0
      });
      assert.equal(succeeded.class, 'succeeded');
      assert.equal(succeeded.finished, true);

      const signal = classify(dir, {
        outcome: 'ok',
        output: show({ ActiveState: 'active', SubState: 'exited', ExecMainCode: '2', ExecMainStatus: '15', TasksCurrent: '0' }),
        exit_code: 0
      });
      assert.equal(signal.class, 'signal');
      assert.equal(signal.finished, true);

      const stuck = classify(dir, {
        outcome: 'ok',
        output: show({ ActiveState: 'failed', Result: 'exit-code', TasksCurrent: '3' }),
        exit_code: 0
      });
      assert.equal(stuck.class, 'stuck');
      assert.equal(stuck.finished, false);

      const failedExit = classify(dir, {
        outcome: 'ok',
        output: show({ ActiveState: 'failed', Result: 'exit-code', TasksCurrent: '0', ExecMainStatus: '2' }),
        exit_code: 0
      });
      assert.equal(failedExit.class, 'failed-exit');
      assert.equal(failedExit.finished, true);

      const failedTimeout = classify(dir, {
        outcome: 'ok',
        output: show({ ActiveState: 'failed', Result: 'timeout', TasksCurrent: '[not set]' }),
        exit_code: 0
      });
      assert.equal(failedTimeout.class, 'failed-timeout');
      assert.equal(failedTimeout.finished, true);

      const failedEmpty = classify(dir, {
        outcome: 'ok',
        output: show({ ActiveState: 'failed', Result: 'resources', TasksCurrent: '' }),
        exit_code: 0
      });
      assert.equal(failedEmpty.class, 'failed-other');
      assert.equal(failedEmpty.finished, true);

      const notFound = classify(dir, {
        outcome: 'ok',
        output: show({ LoadState: 'not-found', ActiveState: 'inactive', SubState: 'dead', TasksCurrent: '[not set]' }),
        exit_code: 0
      });
      assert.equal(notFound.class, 'not-loaded');
      assert.equal(notFound.finished, false);

      const inactive = classify(dir, {
        outcome: 'ok',
        output: show({ LoadState: 'loaded', ActiveState: 'inactive', SubState: 'dead', TasksCurrent: '0' }),
        exit_code: 0
      });
      assert.equal(inactive.class, 'not-loaded');

      const unrecognized = classify(dir, {
        outcome: 'ok',
        output: show({ ActiveState: 'active', SubState: 'listening' }),
        exit_code: 0
      });
      assert.equal(unrecognized.class, 'unrecognized');
      assert.equal(unrecognized.finished, false);

      const unsetId = classify(dir, {
        outcome: 'ok',
        output: show({ InvocationID: '' }),
        exit_code: 0
      }, ID2);
      assert.equal(unsetId.class, 'running');

      for (const outcome of ['busy', 'vendor_error', 'truncated', 'connect_timeout', 'remote_failure']) {
        const body = outcome === 'vendor_error' ? { status: 'vendor_error' } : { outcome, output: show({}) };
        assert.equal(classify(dir, body).class, 'not-read', outcome);
      }
    });
  });
});

describe('classify readback, journal, and release', () => {
  it('covers every readback and journal class', () => {
    withDir((dir) => {
      const read = ok(['classify', '--step', 'readback', '--answer', writeAnswer(dir, { outcome: 'ok', output: 'a\nb\n' })]);
      assert.equal(read.class, 'read');
      assert.deepEqual(read.facts, { lines: 2 });
      assert.equal(Object.hasOwn(read, 'finished'), false);

      const truncated = ok(['classify', '--step', 'readback', '--answer', writeAnswer(dir, { outcome: 'truncated', output: 'a\n' })]);
      assert.equal(truncated.class, 'truncated');
      assert.deepEqual(truncated.facts, { lines: 1 });

      const notRead = ok(['classify', '--step', 'readback', '--answer', writeAnswer(dir, { outcome: 'timeout' })]);
      assert.equal(notRead.class, 'not-read');
      assert.deepEqual(notRead.facts, { lines: null });

      const empty = ok(['classify', '--step', 'journal', '--answer', writeAnswer(dir, { outcome: 'ok', output: '' })]);
      assert.equal(empty.class, 'no-entries');
      assert.deepEqual(empty.facts, { lines: 0 });

      const marker = ok(['classify', '--step', 'journal', '--answer', writeAnswer(dir, { outcome: 'ok', output: '-- No entries --\n' })]);
      assert.equal(marker.class, 'no-entries');

      const whitespace = ok(['classify', '--step', 'journal', '--answer', writeAnswer(dir, { outcome: 'ok', output: '\n  \n' })]);
      assert.equal(whitespace.class, 'no-entries');

      const entries = ok(['classify', '--step', 'journal', '--answer', writeAnswer(dir, { outcome: 'ok', output: '2026-10-05T12:00:00+0000 host unit[1]: hi\n' })]);
      assert.equal(entries.class, 'read');
      assert.equal(entries.facts.lines, 1);

      const journalCut = ok(['classify', '--step', 'journal', '--answer', writeAnswer(dir, { outcome: 'truncated', output: '' })]);
      assert.equal(journalCut.class, 'truncated');

      const journalMiss = ok(['classify', '--step', 'journal', '--answer', writeAnswer(dir, { outcome: 'busy' })]);
      assert.equal(journalMiss.class, 'not-read');

      const readEmpty = ok(['classify', '--step', 'readback', '--answer', writeAnswer(dir, { outcome: 'ok', output: '-- No entries --\n' })]);
      assert.equal(readEmpty.class, 'read');
      assert.equal(readEmpty.facts.lines, 1);
    });
  });

  it('covers every release class', () => {
    withDir((dir) => {
      function classify(answer) {
        return ok(['classify', '--step', 'release', '--answer', writeAnswer(dir, answer)]);
      }
      const released = classify({
        outcome: 'ok',
        exit_code: 0,
        output: 'release-exit:0\nload-state:not-found\n'
      });
      assert.equal(released.class, 'released');
      assert.deepEqual(released.facts, {});

      assert.equal(classify({ outcome: 'remote_failure', exit_code: 11, output: 'lock-busy\n' }).class, 'lock-busy');
      const mismatch = classify({ outcome: 'remote_failure', exit_code: 13, output: `invocation-mismatch:${ID2}\n` });
      assert.equal(mismatch.class, 'invocation-mismatch');
      assert.equal(mismatch.facts.invocationId, ID2);
      const unfinished = classify({ outcome: 'remote_failure', exit_code: 14, output: 'not-finished:active/running\n' });
      assert.equal(unfinished.class, 'not-finished');
      assert.equal(unfinished.facts.state, 'active/running');
      const remain = classify({ outcome: 'remote_failure', exit_code: 17, output: 'processes-remain:4\n' });
      assert.equal(remain.class, 'processes-remain');
      assert.equal(remain.facts.tasks, '4');

      assert.equal(classify({ outcome: 'ok', exit_code: 0, output: 'release-exit:0\nload-state:loaded\n' }).class, 'unknown');
      assert.equal(classify({ outcome: 'remote_failure', exit_code: 11, output: 'nope\n' }).class, 'unknown');
      assert.equal(classify({ outcome: 'ok', exit_code: 0, output: 'lock-busy\n' }).class, 'unknown');
      assert.equal(classify({ outcome: 'remote_failure', exit_code: 1, output: 'release-exit:1\n' }).class, 'unknown');
      const stop = classify({ status: 'needs_confirmation' });
      assert.equal(stop.class, 'unknown');
      assert.equal(stop.facts.status, 'needs_confirmation');
    });
  });
});

describe('review round 1 boundaries', () => {
  function classifyPoll(dir, answer, recorded) {
    const args = ['classify', '--step', 'poll', '--answer', writeAnswer(dir, answer)];
    if (recorded) args.push('--recorded', recorded);
    return ok(args);
  }

  it('reads the ten fields from a remote_failure that names a machine, and not from one that does not', () => {
    withDir((dir) => {
      const output = show({ ActiveState: 'failed', SubState: 'failed', Result: 'exit-code', ExecMainCode: '1', ExecMainStatus: '3', TasksCurrent: '0' });
      const withMachine = classifyPoll(dir, { outcome: 'remote_failure', machine: 'machine-a', exit_code: 1, output }, ID);
      assert.equal(withMachine.class, 'failed-exit');
      assert.equal(withMachine.finished, true);
      const noMachine = classifyPoll(dir, { outcome: 'remote_failure', exit_code: 1, output }, ID);
      assert.equal(noMachine.class, 'not-read');
      const gateway = classifyPoll(dir, { status: 'vendor_error', outcome: 'ok', machine: 'machine-a', output }, ID);
      assert.equal(gateway.class, 'not-read');
    });
  });

  it('does not choose between repeated fields', () => {
    withDir((dir) => {
      const base = show({ ActiveState: 'failed', SubState: 'failed', Result: 'exit-code', ExecMainCode: '1', ExecMainStatus: '3', TasksCurrent: '0' });
      const tasks = classifyPoll(dir, { outcome: 'ok', machine: 'machine-a', exit_code: 0, output: base + 'TasksCurrent=3\n' }, ID);
      assert.equal(tasks.class, 'unrecognized');
      assert.equal(tasks.finished, false);
      assert.deepEqual(tasks.facts.repeated, ['TasksCurrent']);
      const ids = classifyPoll(dir, { outcome: 'ok', machine: 'machine-a', exit_code: 0, output: show({}) + `InvocationID=${ID2}\n` });
      assert.equal(ids.class, 'unrecognized');
      assert.deepEqual(ids.facts.repeated, ['InvocationID']);
    });
  });

  it('keeps a byte-order mark, so the first-line check refuses it', () => {
    withDir((dir) => {
      const path = join(dir, 'bom.sh');
      writeFileSync(path, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('set -eu\ntrue\n')]));
      refused(['start', '--purpose', 'apt-install', '--limit', '1800', '--token', 'none', '--script', path], /set -eu/);
    });
  });

  it('refuses a trailing newline on a validated value', () => {
    withDir(() => {
      refused(['release', '--unit', UNIT, '--invocation', `${ID}\n`], /invocation/);
      refused(['poll', '--unit', `${UNIT}\n`, '--wait', '0'], /unit/);
    });
  });
});

describe('review round 2 boundaries', () => {
  it('offers no ID to adopt when InvocationID repeats', () => {
    withDir((dir) => {
      const output = show({ InvocationID: '1'.repeat(32) }) + `InvocationID=${'2'.repeat(32)}\n`;
      const result = ok(['classify', '--step', 'poll', '--answer', writeAnswer(dir, { outcome: 'ok', machine: 'machine-a', exit_code: 0, output })]);
      assert.equal(result.class, 'unrecognized');
      assert.equal(result.facts.invocationId, null);
      assert.equal(result.facts.InvocationID, null);
    });
  });

  it('classifies status uncertain on every step', () => {
    const uncertain = {
      status: 'uncertain',
      action: 'vm.command.run',
      reason: 'The outcome of this action could not be confirmed. It will not be retried.'
    };
    withDir((dir) => {
      const start = ok(['classify', '--step', 'start', '--unit', UNIT, '--answer', writeAnswer(dir, {
        ...uncertain,
        exit_code: 0,
        output: `Running as unit: ${UNIT}.service; invocation ID: ${ID}\nstart-exit:0\n`
      })]);
      assert.equal(start.class, 'unknown');
      assert.deepEqual(start.facts, { status: 'uncertain', action: 'vm.command.run' });
      assert.equal(Object.hasOwn(start, 'finished'), false);

      const poll = ok(['classify', '--step', 'poll', '--answer', writeAnswer(dir, uncertain)]);
      assert.equal(poll.class, 'not-read');
      assert.equal(poll.finished, false);
      assert.equal(poll.facts.invocationId, null);
      for (const field of ['LoadState', 'ActiveState', 'SubState', 'Result', 'ExecMainCode', 'ExecMainStatus', 'InvocationID', 'TasksCurrent', 'ExecMainStartTimestamp', 'ExecMainExitTimestamp']) {
        assert.equal(poll.facts[field], null, field);
      }

      const recorded = ok(['classify', '--step', 'poll', '--recorded', ID, '--answer', writeAnswer(dir, uncertain)]);
      assert.equal(recorded.class, 'not-read');
      assert.equal(recorded.finished, false);
      assert.equal(recorded.facts.recorded, ID);
      assert.equal(Object.hasOwn(recorded.facts, 'invocationId'), false);

      for (const step of ['readback', 'journal']) {
        const result = ok(['classify', '--step', step, '--answer', writeAnswer(dir, uncertain)]);
        assert.equal(result.class, 'not-read', step);
        assert.deepEqual(result.facts, { lines: null });
        assert.equal(Object.hasOwn(result, 'finished'), false);
      }

      const release = ok(['classify', '--step', 'release', '--answer', writeAnswer(dir, uncertain)]);
      assert.equal(release.class, 'unknown');
      assert.deepEqual(release.facts, { status: 'uncertain', action: 'vm.command.run' });
      assert.equal(Object.hasOwn(release, 'finished'), false);
    });
  });

  it('reads an answer file that begins with a byte-order mark', () => {
    withDir((dir) => {
      const path = join(dir, 'bom.json');
      writeFileSync(path, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"outcome":"timeout","machine":"machine-a"}')]));
      const result = ok(['classify', '--step', 'poll', '--answer', path]);
      assert.equal(result.class, 'not-read');
    });
  });
});

const SCHEDULED = [
  'scheduled', '--purpose', 'twenty-backup', '--limit', '3600',
  '--script-path', '/opt/twenty/backup/job.sh',
  '--wrapper-path', '/opt/twenty/backup/wrapper',
  '--on-calendar', '*-*-* 03:00:00',
  '--stop-post', '/opt/twenty/backup/recover',
  '--stop-post-timeout', '1200',
  '--', 'dump'
];
const SCHEDULED_UNIT = 'vm-job-twenty-backup-20261010t000000z-012345';
const SCHEDULED_UNIT_2 = 'vm-job-twenty-backup-20261010t000001z-012345';
const OLD_UNIT = 'vm-job-twenty-backup-20261009t000000z-abcdef';
const OTHER_UNIT = 'vm-job-apt-install-20261005t120000z-abcdef';
const RUN_ID = 'abcdef0123456789abcdef0123456789';
const RUN_ID_2 = 'fedcba9876543210fedcba9876543210';
const JOB = 'set -eu\necho backup\n';

function codePoints(text) {
  return Array.from(text).length;
}

function scheduledArgs(extra = []) {
  return [
    'scheduled', '--purpose', 'twenty-backup', '--limit', '3600',
    '--script-path', '/opt/twenty/backup/job.sh',
    '--wrapper-path', '/opt/twenty/backup/wrapper',
    '--on-calendar', '*-*-* 03:00:00',
    ...extra
  ];
}

// The shipped wrapper names /var/lib/vm-job, /run/lock/vm-job.lock,
// /run/vm-job.token and /run/vm-job-stop.*. The test rewrites only those
// prefixes, plus the fixture script path, into a temporary directory.
// A bare /run replacement would corrupt a path such as /opt/twenty/backup/run.
function rewriteWrapper(text, root, scriptPath) {
  return text
    .replaceAll('/var/lib/vm-job', join(root, 'var/lib/vm-job'))
    .replaceAll('/run/lock/vm-job.lock', join(root, 'run/lock/vm-job.lock'))
    .replaceAll('/run/vm-job.token', join(root, 'run/vm-job.token'))
    .replaceAll('/run/vm-job-stop.', join(root, 'run/vm-job-stop.'))
    .replaceAll('/opt/twenty/backup/job.sh', scriptPath);
}

function openBox(wrapperText) {
  const root = mkdtempSync(join(tmpdir(), 'vm-job-sched-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  mkdirSync(join(root, 'run/lock'), { recursive: true });
  mkdirSync(join(root, 'var/lib/vm-job/scheduled'), { recursive: true });
  const scriptPath = join(root, 'job.sh');
  writeFileSync(scriptPath, JOB);
  const q = (value) => JSON.stringify(value);
  const logger = `
log() {
  n=0
  if [ -f ${q(join(root, 'seq'))} ]; then n=$(/bin/cat ${q(join(root, 'seq'))}); fi
  n=$((n + 1))
  printf '%s\\n' "$n" > ${q(join(root, 'seq'))}
  dir=${q(join(root, 'calls'))}/$n
  mkdir -p "$dir"
  i=0
  for a do
    printf '%s' "$a" > "$dir/$i"
    i=$((i + 1))
  done
}
`;
  const writeBin = (name, body) => {
    const path = join(bin, name);
    writeFileSync(path, body);
    chmodSync(path, 0o755);
  };
  writeBin('flock', `#!/bin/sh\n${logger}\nlog flock "$@"\nif [ -f ${q(join(root, 'busy'))} ]; then exit 1; fi\nexit 0\n`);
  writeBin('systemctl', `#!/bin/sh
${logger}
log systemctl "$@"
case "$1" in
  list-units)
    if [ -f ${q(join(root, 'units'))} ]; then /bin/cat ${q(join(root, 'units'))}; fi
    exit 0 ;;
  show)
    prop=
    while [ $# -gt 0 ]; do
      case "$1" in
        -p) prop=$2; shift 2 ;;
        *) shift ;;
      esac
    done
    if [ "$prop" = LoadState ] && [ -f ${q(join(root, 'slow-load'))} ]; then
      exec /bin/sleep 60
    fi
    if [ -f ${q(join(root, 'state'))}/$prop ]; then /bin/cat ${q(join(root, 'state'))}/$prop; fi
    exit 0 ;;
  stop|reset-failed)
    if [ ! -f ${q(join(root, 'stay-loaded'))} ]; then
      : > ${q(join(root, 'units'))}
      mkdir -p ${q(join(root, 'state'))}
      printf 'not-found\\n' > ${q(join(root, 'state'))}/LoadState
    fi
    exit 0 ;;
esac
exit 0
`);
  writeBin('systemd-run', `#!/bin/sh
${logger}
log systemd-run "$@"
unit=
for a do
  case "$a" in
    --version)
      if [ -f ${q(join(root, 'probe-fail'))} ]; then exit 1; fi
      exit 0 ;;
    --unit=*) unit=\${a#--unit=} ;;
  esac
done
if [ -f ${q(join(root, 'bad-id'))} ]; then
  printf 'Running as unit: %s.service; invocation ID: not-an-id\\n' "$unit"
  exit 0
fi
id=$(/bin/cat ${q(join(root, 'invocation'))})
printf 'Running as unit: %s.service; invocation ID: %s\\n' "$unit" "$id"
exit 0
`);
  writeBin('sleep', `#!/bin/sh\n${logger}\nlog sleep "$@"\nexit 0\n`);
  // Polls, because this Mac has no timeout(1). A finished child is not a zombie
  // kill -0 can see, which the probe below relies on.
  writeBin('timeout', `#!/bin/sh
dur=$1
shift
"$@" &
child=$!
ticks=$((dur * 10))
i=0
while [ "$i" -lt "$ticks" ]; do
  if ! kill -0 "$child" 2>/dev/null; then
    wait "$child"
    exit $?
  fi
  /bin/sleep 0.1
  i=$((i + 1))
done
kill -TERM "$child" 2>/dev/null
wait "$child"
exit 124
`);
  writeBin('cat', `#!/bin/sh
for arg do
  case "$arg" in
    /proc/sys/kernel/random/uuid)
      printf '%s\\n' '01234567-89ab-cdef-0123-456789abcdef'
      exit 0 ;;
  esac
done
for arg do
  case "$arg" in
    */vm-job.token)
      if [ -f ${q(join(root, 'flip'))} ] && [ ! -e "$arg" ]; then
        printf '%s\\n' 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' > "$arg"
        exit 1
      fi
      ;;
  esac
done
exec /bin/cat "$@"
`);
  writeBin('date', `#!/bin/sh
if [ "$1" = -u ] && [ "$2" = '+%Y%m%dT%H%M%SZ' ]; then
  n=0
  if [ -f ${q(join(root, 'date-n'))} ]; then n=$(/bin/cat ${q(join(root, 'date-n'))}); fi
  printf '%s\\n' "$((n + 1))" > ${q(join(root, 'date-n'))}
  printf '20261010T00000%dZ\\n' "$n"
  exit 0
fi
if [ "$1" = '+%s' ] && [ -f ${q(join(root, 'clock'))} ]; then
  n=$(/bin/cat ${q(join(root, 'clock'))})
  printf '%s\\n' "$n"
  printf '%s\\n' "$((n + 10))" > ${q(join(root, 'clock'))}
  exit 0
fi
exec /bin/date "$@"
`);
  writeFileSync(join(root, 'invocation'), `${RUN_ID}\n`);
  const wrapperPath = join(root, 'wrapper');
  writeFileSync(wrapperPath, rewriteWrapper(wrapperText, root, scriptPath));
  chmodSync(wrapperPath, 0o755);
  const recordPath = join(root, 'var/lib/vm-job/scheduled/twenty-backup');
  return {
    root,
    fire() {
      return spawnSync('/bin/dash', [wrapperPath], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${bin}:/bin:/usr/bin` }
      });
    },
    calls() {
      const dir = join(root, 'calls');
      let names;
      try {
        names = readdirSync(dir);
      } catch {
        return [];
      }
      return names.sort((left, right) => Number(left) - Number(right)).map((name) => {
        const slot = join(dir, name);
        return readdirSync(slot)
          .filter((entry) => /^\d+$/.test(entry))
          .sort((left, right) => Number(left) - Number(right))
          .map((entry) => readFileSync(join(slot, entry), 'utf8'));
      });
    },
    resetCalls() {
      rmSync(join(root, 'calls'), { recursive: true, force: true });
      rmSync(join(root, 'seq'), { force: true });
    },
    record() {
      try {
        return readFileSync(recordPath, 'utf8');
      } catch {
        return null;
      }
    },
    seed(text) {
      writeFileSync(recordPath, text);
    },
    setUnits(text) {
      writeFileSync(join(root, 'units'), text);
    },
    setState(fields) {
      mkdirSync(join(root, 'state'), { recursive: true });
      for (const [key, value] of Object.entries(fields)) {
        writeFileSync(join(root, 'state', key), `${value}\n`);
      }
    },
    setInvocation(id) {
      writeFileSync(join(root, 'invocation'), `${id}\n`);
    },
    leftovers() {
      const scheduled = readdirSync(join(root, 'var/lib/vm-job/scheduled')).filter((name) => name.includes('.tmp.'));
      const shims = readdirSync(join(root, 'run')).filter((name) => name.startsWith('vm-job-stop'));
      return { scheduled, shims };
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    }
  };
}

function runBox(wrapperText, prepare) {
  const box = openBox(wrapperText);
  try {
    if (prepare) prepare(box);
    const result = box.fire();
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      record: box.record(),
      calls: box.calls(),
      leftovers: box.leftovers()
    };
  } finally {
    box.cleanup();
  }
}

function listCall() {
  return ['systemctl', 'list-units', '--all', '--plain', '--no-legend', 'vm-job-*'];
}

function showCall(prop, unit = SCHEDULED_UNIT) {
  return ['systemctl', 'show', '-p', prop, '--value', `${unit}.service`];
}

function shows(unit = SCHEDULED_UNIT) {
  return ['InvocationID', 'ActiveState', 'SubState', 'TasksCurrent'].map((prop) => showCall(prop, unit));
}

function loadStateCall(unit = SCHEDULED_UNIT) {
  return showCall('LoadState', unit);
}

function probeCall() {
  return [
    'systemd-run', '-p', 'ExecStopPost=/bin/sh /opt/twenty/backup/recover', '-p', 'TimeoutStopSec=1200', '--version'
  ];
}

// job=$(cat file) drops trailing newlines, so the -c text has none.
function systemdRun(unit) {
  return [
    'systemd-run', '-p', 'ExecStopPost=/bin/sh /opt/twenty/backup/recover', '-p', 'TimeoutStopSec=1200',
    `--unit=${unit}`, `--description=background job ${unit}`, '--expand-environment=no',
    '-p', 'Type=exec', '-p', 'ExitType=cgroup', '-p', 'RemainAfterExit=yes', '-p', `RuntimeMaxSec=3600`,
    '-E', 'DEBIAN_FRONTEND=noninteractive', '-E', 'NEEDRESTART_SUSPEND=1',
    '--', '/bin/sh', '-c', JOB.replace(/\n+$/, ''), 'sh', 'dump'
  ];
}

describe('vm-job 0.3.2', () => {
  it('pins a start without stop-post to the 0.2.0 argv', () => {
    withDir((dir) => {
      const built = ok(startArgs(dir, ['--', 'install', 'tree=2.1.1']));
      const pinned = JSON.parse(readFileSync(join(FIXTURES, 'start-0.2.0.argv.json'), 'utf8'));
      const actual = built.argv.slice();
      actual[4] = 'UNIT';
      assert.deepEqual(actual, pinned);
      assert.equal(built.argv[2], STARTER);
    });
  });

  it('adds the stop-post properties as operands and keeps the starter text', () => {
    withDir((dir) => {
      const built = ok(startArgs(dir, ['--stop-post', '/opt/twenty/backup/recover', '--stop-post-timeout', '1200', '--', 'dump']));
      const stopPost = readFileSync(join(ROOT, 'scripts/texts/stop-post.sh'), 'utf8');
      assert.equal(built.argv[2], stopPost);
      assert.deepEqual(built.argv.slice(0, 4), ['/bin/sh', '-c', stopPost, 'sh']);
      assert.equal(built.argv[4], '-p');
      assert.equal(built.argv[5], 'ExecStopPost=/bin/sh /opt/twenty/backup/recover');
      assert.equal(built.argv[6], '-p');
      assert.equal(built.argv[7], 'TimeoutStopSec=1200');
      assert.equal(built.argv[8], STARTER);
      assert.equal(built.argv.at(-1), 'dump');
      const fiftyOne = Array.from({ length: 51 }, (_, index) => `p${index}`);
      const full = ok(startArgs(dir, ['--stop-post', '/opt/recover', '--stop-post-timeout', '30', '--', ...fiftyOne]));
      assert.equal(full.argv.length, 64);
      refused(startArgs(dir, ['--stop-post', '/opt/recover', '--stop-post-timeout', '30', '--', ...fiftyOne, 'more']), /52 operands is more than 51/);
    });
  });

  it('refuses a bad stop-post path or timeout by name', () => {
    withDir((dir) => {
      const base = startArgs(dir);
      refused([...base, '--stop-post', '/opt/../recover', '--stop-post-timeout', '30'], /must not contain a "\.\." segment/);
      refused([...base, '--stop-post', '/opt//recover', '--stop-post-timeout', '30'], /must not contain "\/\/"/);
      refused([...base, '--stop-post', 'opt/recover', '--stop-post-timeout', '30'], /must be an absolute path/);
      refused([...base, '--stop-post', `/${'a'.repeat(201)}`, '--stop-post-timeout', '30'], /must match \^\/\[A-Za-z0-9\._\/-\]\{1,200\}\$/);
      refused([...base, '--stop-post', '/opt/recover', '--stop-post-timeout', '29'], /from 30 to 3600/);
      refused([...base, '--stop-post', '/opt/recover', '--stop-post-timeout', '3601'], /from 30 to 3600/);
      refused([...base, '--stop-post', '/opt/recover', '--stop-post-timeout', '30s'], /from 30 to 3600/);
      refused([...base, '--stop-post', '/opt/recover', '--stop-post-timeout', '030'], /from 30 to 3600/);
      refused([...base, '--stop-post', '/opt/recover'], /required together/);
      refused([...base, '--stop-post-timeout', '30'], /required together/);
      ok([...base, '--stop-post', `/${'a'.repeat(200)}`, '--stop-post-timeout', '30']);
      ok([...base, '--stop-post', '/opt/recover', '--stop-post-timeout', '3600']);
    });
  });

  it('prints the three scheduled texts for the fixture input', () => {
    const built = ok(SCHEDULED);
    assert.equal(built.command, 'scheduled');
    assert.equal(built.purpose, 'twenty-backup');
    assert.equal(built.serviceName, 'vmjob-scheduled-twenty-backup.service');
    assert.equal(built.timerName, 'vmjob-scheduled-twenty-backup.timer');
    assert.equal(built.wrapper, readFileSync(join(FIXTURES, 'scheduled-wrapper.sh'), 'utf8'));
    assert.equal(built.service, readFileSync(join(FIXTURES, 'scheduled-service.service'), 'utf8'));
    assert.equal(built.timer, readFileSync(join(FIXTURES, 'scheduled-timer.timer'), 'utf8'));
    assert.match(built.service, /Type=oneshot\nExecStart=\/bin\/sh \/opt\/twenty\/backup\/wrapper\n/);
    assert.match(built.timer, /OnCalendar=\*-\*-\* 03:00:00\nPersistent=true\nRandomizedDelaySec=0\nUnit=vmjob-scheduled-twenty-backup\.service\n/);
    assert.equal(matchesVmJobEnumeration(built.serviceName), false);
    assert.equal(matchesVmJobEnumeration(built.timerName), false);
    assert.equal(matchesVmJobEnumeration('vm-job-scheduled-twenty-backup.service'), true);
    const glob = spawnSync('/bin/dash', ['-c', [
      'case vmjob-scheduled-twenty-backup.service in vm-job-*) echo service ;; *) echo service-no ;; esac',
      'case vmjob-scheduled-twenty-backup.timer in vm-job-*) echo timer ;; *) echo timer-no ;; esac',
      'case vm-job-twenty-backup-20261010t000000z-abcdef.service in vm-job-*) echo job ;; *) echo job-no ;; esac'
    ].join('\n')], { encoding: 'utf8' });
    assert.equal(glob.status, 0, glob.stderr);
    assert.equal(glob.stdout, 'service-no\ntimer-no\njob\n');
  });

  it('composes the release checks and the starter from the shipped texts', () => {
    const built = ok(SCHEDULED);
    const releaseText = readFileSync(join(ROOT, 'scripts/texts/release.sh'), 'utf8');
    const startMark = 'cur=$(systemctl show -p InvocationID --value "$unit.service")';
    const slice = releaseText.slice(releaseText.indexOf(startMark), releaseText.indexOf('echo "release-exit:$rc"')).trimEnd();
    assert.equal(slice, RELEASE_CORE.trimEnd());
    assert.equal(built.wrapper.includes(slice), true);
    assert.equal(built.wrapper.split(startMark).length - 1, 1);
    const body = built.wrapper.split("<< 'E'\n")[1].split('\nE\n')[0];
    const expected = STARTER.split('\n').filter((line) => !STARTER_LOCK_LINES.includes(line)).join('\n').replace(/\n+$/, '');
    assert.equal(body, expected);
    assert.equal(body.includes(STARTER_LOCK_LINES[1]), false);
    assert.equal(built.wrapper.split(ENUM_LINE).length - 1, 2);
    const stopPost = readFileSync(join(ROOT, 'scripts/texts/stop-post.sh'), 'utf8');
    assert.equal(stopPost.includes(SHIM_EXEC), true);
    assert.equal(built.wrapper.includes(SHIM_EXEC), true);
    assert.equal(built.wrapper.includes('release.sh'), false);
    const bare = ok(scheduledArgs());
    assert.equal(bare.wrapper.includes('ExecStopPost'), false);
    assert.equal(bare.wrapper.includes(SHIM_EXEC), false);
    assert.equal(bare.wrapper.includes(slice), true);
    const quoted = ok(scheduledArgs(['--', "a'b"]));
    assert.equal(quoted.wrapper.includes(`set -- 'a'\\''b'`), true);
  });

  it('refuses a bad calendar, purpose, or scheduled path by name', () => {
    const args = (overrides = {}) => {
      const values = {
        '--purpose': 'twenty-backup',
        '--limit': '3600',
        '--script-path': '/opt/twenty/backup/job.sh',
        '--wrapper-path': '/opt/twenty/backup/wrapper',
        '--on-calendar': '*-*-* 03:00:00',
        ...overrides
      };
      const argv = ['scheduled'];
      for (const [flag, value] of Object.entries(values)) argv.push(flag, value);
      return argv;
    };
    refused(args({ '--on-calendar': '*~' }), /--on-calendar must match/);
    refused(args({ '--on-calendar': 'a'.repeat(65) }), /--on-calendar must match/);
    refused(args({ '--purpose': 'Twenty' }), /--purpose must match/);
    refused(args({ '--purpose': 'twenty--backup' }), /--purpose must match/);
    refused(args({ '--purpose': 'a'.repeat(90) }), /the unit name is 121 characters/);
    refused(args({ '--script-path': '/opt/../job.sh' }), /must not contain a "\.\." segment/);
    refused(args({ '--script-path': '/opt//job.sh' }), /must not contain "\/\/"/);
    refused(args({ '--script-path': 'opt/job.sh' }), /must be an absolute path/);
    refused(args({ '--wrapper-path': `/${'w'.repeat(201)}` }), /must match/);
    refused(scheduledArgs(['--stop-post', '/opt/recover']), /required together/);
    refused(scheduledArgs(['--stop-post-timeout', '29']), /required together/);
    refused(scheduledArgs(['--stop-post', '/opt/recover', '--stop-post-timeout', '29']), /from 30 to 3600/);
    refused(scheduledArgs(['--', ...Array.from({ length: 57 }, (_, index) => `p${index}`)]), /57 operands is more than 56/);
    refused(['scheduled', '--install'], /unknown option "--install"/);
  });

  it('checks every shipped text and the fixture wrapper with dash', () => {
    const names = ['starter.sh', 'release.sh', 'poll.sh', 'readback.sh', 'journal.sh', 'stop-post.sh'];
    for (const name of names) {
      const text = readFileSync(join(ROOT, 'scripts/texts', name), 'utf8');
      assert.ok(codePoints(text) <= 4096, name);
      const checked = spawnSync('/bin/dash', ['-n', join(ROOT, 'scripts/texts', name)], { encoding: 'utf8' });
      assert.equal(checked.status, 0, `${name}\n${checked.stderr}`);
    }
    const wrapper = readFileSync(join(FIXTURES, 'scheduled-wrapper.sh'), 'utf8');
    const copy = join(tmpdir(), 'vm-job-fixture-wrapper.sh');
    writeFileSync(copy, wrapper);
    const checked = spawnSync('/bin/dash', ['-n', copy], { encoding: 'utf8' });
    rmSync(copy, { force: true });
    assert.equal(checked.status, 0, checked.stderr);
    for (const extra of [SCHEDULED, scheduledArgs(['--', 'dump'])]) {
      const built = ok(extra);
      const generated = join(tmpdir(), `vm-job-gen-${built.sha256.wrapper.slice(0, 8)}.sh`);
      writeFileSync(generated, built.wrapper);
      const generatedChecked = spawnSync('/bin/dash', ['-n', generated], { encoding: 'utf8' });
      rmSync(generated, { force: true });
      assert.equal(generatedChecked.status, 0, generatedChecked.stderr);
    }
  });

  it('adopts a finished scheduled unit with the existing poll and release classes', () => {
    withDir((dir) => {
      const polled = ok(['classify', '--step', 'poll', '--answer', pollAnswer(dir, {
        ActiveState: 'active',
        SubState: 'exited',
        ExecMainCode: '1',
        ExecMainStatus: '0',
        TasksCurrent: '0',
        InvocationID: RUN_ID
      })]);
      assert.equal(polled.class, 'succeeded');
      assert.equal(polled.finished, true);
      const unit = 'vm-job-twenty-backup-20261010t030000z-abcdef';
      const release = ok(['release', '--unit', unit, '--invocation', RUN_ID]);
      assert.equal(release.argv[2], readFileSync(join(ROOT, 'scripts/texts/release.sh'), 'utf8'));
      assert.deepEqual(release.argv.slice(3), ['sh', unit, RUN_ID]);
    });
  });

  it('classifies a scheduled record', () => {
    withDir((dir) => {
      const recorded = ok(['classify', '--step', 'scheduled-record', '--answer', writeAnswer(dir, {
        outcome: 'ok',
        output: `${SCHEDULED_UNIT}\n${RUN_ID}\n2\n`
      })]);
      assert.equal(recorded.command, 'classify');
      assert.equal(recorded.step, 'scheduled-record');
      assert.equal(recorded.class, 'recorded');
      assert.equal(Object.hasOwn(recorded, 'finished'), false);
      assert.deepEqual(recorded.facts, { unit: SCHEDULED_UNIT, invocationId: RUN_ID, skips: 2 });
      const zero = ok(['classify', '--step', 'scheduled-record', '--answer', writeAnswer(dir, {
        outcome: 'ok',
        output: `${SCHEDULED_UNIT}\n${RUN_ID}\n0\n`
      })]);
      assert.equal(zero.facts.skips, 0);
      const none = ok(['classify', '--step', 'scheduled-record', '--answer', writeAnswer(dir, { outcome: 'ok', output: 'none\n' })]);
      assert.equal(none.class, 'none');
      assert.deepEqual(none.facts, {});
      const skipsOnly = ok(['classify', '--step', 'scheduled-record', '--answer', writeAnswer(dir, { outcome: 'ok', output: 'none\nnone\n4\n' })]);
      assert.equal(skipsOnly.class, 'skips-only');
      assert.equal(Object.hasOwn(skipsOnly, 'finished'), false);
      assert.deepEqual(skipsOnly.facts, { skips: 4 });
      const pending = ok(['classify', '--step', 'scheduled-record', '--answer', writeAnswer(dir, { outcome: 'ok', output: `${SCHEDULED_UNIT}\npending\n3\n` })]);
      assert.equal(pending.class, 'pending');
      assert.deepEqual(pending.facts, { unit: SCHEDULED_UNIT, skips: 3 });
      for (const answer of [
        { status: 'needs_confirmation', outcome: 'ok', output: 'none\n' },
        { outcome: 'timeout', output: 'none\n' },
        { outcome: 'ok', output: 'none\nextra\n' },
        { outcome: 'ok', output: `not-a-unit\n${RUN_ID}\n0\n` },
        { outcome: 'ok', output: `${SCHEDULED_UNIT}\n${RUN_ID.slice(1)}x\n0\n` },
        { outcome: 'ok', output: `${SCHEDULED_UNIT}\n${RUN_ID}\n01\n` },
        { outcome: 'ok', output: '' },
        { outcome: 'ok', output: '\n\n1\n' },
        { outcome: 'ok', output: 'none\nnone\n01\n' },
        { outcome: 'ok', output: `none\n${RUN_ID}\n0\n` },
        { outcome: 'ok', output: `${SCHEDULED_UNIT}\npending\n\n` }
      ]) {
        const result = ok(['classify', '--step', 'scheduled-record', '--answer', writeAnswer(dir, answer)]);
        assert.equal(result.class, 'not-read');
        assert.deepEqual(result.facts, {});
      }
      const answer = writeAnswer(dir, { outcome: 'ok', output: 'none\n' });
      refused(['classify', '--step', 'scheduled-record', '--answer', answer, '--unit', SCHEDULED_UNIT], /--unit applies to step start/);
      refused(['classify', '--step', 'scheduled-record', '--answer', answer, '--recorded', RUN_ID], /--recorded applies to step poll/);
    });
  });

  it('runs the wrapper: no loaded unit, then the recorded unit finished', () => {
    const box = openBox(ok(SCHEDULED).wrapper);
    try {
      const first = box.fire();
      assert.equal(first.status, 0, first.stderr);
      assert.equal(first.stderr, '');
      assert.equal(first.stdout, '');
      assert.equal(box.record(), `${SCHEDULED_UNIT}\n${RUN_ID}\n0\n`);
      assert.deepEqual(box.calls(), [
        ['flock', '-w', '20', '9'],
        listCall(),
        probeCall(),
        listCall(),
        systemdRun(SCHEDULED_UNIT)
      ]);
      assert.deepEqual(box.leftovers(), { scheduled: [], shims: [] });
      box.resetCalls();
      box.setUnits(`${SCHEDULED_UNIT}.service loaded active exited\n`);
      box.setState({ InvocationID: RUN_ID, ActiveState: 'active', SubState: 'exited', TasksCurrent: '0' });
      box.setInvocation(RUN_ID_2);
      const second = box.fire();
      assert.equal(second.status, 0, second.stderr);
      assert.equal(second.stdout, `scheduled:released:${SCHEDULED_UNIT}\n`);
      assert.equal(box.record(), `${SCHEDULED_UNIT_2}\n${RUN_ID_2}\n0\n`);
      assert.deepEqual(box.calls(), [
        ['flock', '-w', '20', '9'],
        listCall(),
        ...shows(),
        ['systemctl', 'stop', `${SCHEDULED_UNIT}.service`],
        loadStateCall(),
        probeCall(),
        listCall(),
        systemdRun(SCHEDULED_UNIT_2)
      ]);
      assert.deepEqual(box.leftovers(), { scheduled: [], shims: [] });
    } finally {
      box.cleanup();
    }
  });

  it('reset-fails a recorded unit that failed with no tasks, then starts', () => {
    const seen = runBox(ok(SCHEDULED).wrapper, (box) => {
      box.seed(`${SCHEDULED_UNIT}\n${RUN_ID}\n0\n`);
      box.setUnits(`${SCHEDULED_UNIT}.service loaded failed failed\n`);
      box.setState({ InvocationID: RUN_ID, ActiveState: 'failed', SubState: 'failed', TasksCurrent: '0' });
    });
    assert.equal(seen.status, 0, seen.stderr);
    assert.equal(seen.stdout, `scheduled:released:${SCHEDULED_UNIT}\n`);
    assert.equal(seen.record, `${SCHEDULED_UNIT}\n${RUN_ID}\n0\n`);
    assert.deepEqual(seen.calls, [
      ['flock', '-w', '20', '9'],
      listCall(),
      ...shows(),
      ['systemctl', 'reset-failed', `${SCHEDULED_UNIT}.service`],
      loadStateCall(),
      probeCall(),
      listCall(),
      systemdRun(SCHEDULED_UNIT)
    ]);
  });

  it('skips a recorded unit that is still running', () => {
    const seen = runBox(ok(SCHEDULED).wrapper, (box) => {
      box.seed(`${SCHEDULED_UNIT}\n${RUN_ID}\n0\n`);
      box.setUnits(`${SCHEDULED_UNIT}.service loaded active running\n`);
      box.setState({ InvocationID: RUN_ID, ActiveState: 'active', SubState: 'running', TasksCurrent: '1' });
    });
    assert.equal(seen.status, 0, seen.stderr);
    assert.equal(seen.stdout, `scheduled:release-refused:not-finished:active/running\nscheduled:skipped:${SCHEDULED_UNIT}\n`);
    assert.equal(seen.record, `${SCHEDULED_UNIT}\n${RUN_ID}\n1\n`);
    assert.deepEqual(seen.calls, [
      ['flock', '-w', '20', '9'],
      listCall(),
      ...shows()
    ]);
  });

  it('skips a different loaded unit and counts a second firing', () => {
    const box = openBox(ok(SCHEDULED).wrapper);
    try {
      box.seed(`${SCHEDULED_UNIT}\n${RUN_ID}\n0\n`);
      box.setUnits(`${OTHER_UNIT}.service loaded active exited\n`);
      const first = box.fire();
      assert.equal(first.status, 0, first.stderr);
      assert.equal(first.stdout, `scheduled:skipped:${OTHER_UNIT}\n`);
      assert.equal(box.record(), `${SCHEDULED_UNIT}\n${RUN_ID}\n1\n`);
      assert.deepEqual(box.calls(), [
        ['flock', '-w', '20', '9'],
        listCall()
      ]);
      box.resetCalls();
      const second = box.fire();
      assert.equal(second.status, 0, second.stderr);
      assert.equal(second.stdout, `scheduled:skipped:${OTHER_UNIT}\n`);
      assert.equal(box.record(), `${SCHEDULED_UNIT}\n${RUN_ID}\n2\n`);
      assert.deepEqual(box.calls(), [
        ['flock', '-w', '20', '9'],
        listCall()
      ]);
    } finally {
      box.cleanup();
    }
  });

  it('skips when the recorded invocation differs', () => {
    const seen = runBox(ok(SCHEDULED).wrapper, (box) => {
      box.seed(`${SCHEDULED_UNIT}\n${RUN_ID}\n0\n`);
      box.setUnits(`${SCHEDULED_UNIT}.service loaded active exited\n`);
      box.setState({ InvocationID: RUN_ID_2, ActiveState: 'active', SubState: 'exited', TasksCurrent: '0' });
    });
    assert.equal(seen.status, 0, seen.stderr);
    assert.equal(seen.stdout, `scheduled:release-refused:invocation-mismatch:${RUN_ID_2}\nscheduled:skipped:${SCHEDULED_UNIT}\n`);
    assert.equal(seen.record, `${SCHEDULED_UNIT}\n${RUN_ID}\n1\n`);
    assert.deepEqual(seen.calls, [
      ['flock', '-w', '20', '9'],
      listCall(),
      ...shows()
    ]);
    assert.equal(seen.calls.some((call) => call[1] === 'stop' || call[1] === 'reset-failed'), false);
  });

  it('exits 0 when the lock is busy and does not touch the record', () => {
    const seen = runBox(ok(SCHEDULED).wrapper, (box) => {
      box.seed(`${SCHEDULED_UNIT}\n${RUN_ID}\n3\n`);
      writeFileSync(join(box.root, 'busy'), '1');
      box.setUnits(`${SCHEDULED_UNIT}.service loaded active running\n`);
    });
    assert.equal(seen.status, 0, seen.stderr);
    assert.equal(seen.stdout, 'scheduled:lock-busy\n');
    assert.equal(seen.record, `${SCHEDULED_UNIT}\n${RUN_ID}\n3\n`);
    assert.deepEqual(seen.calls, [['flock', '-w', '20', '9']]);
  });

  it('leaves a pending record when the starter reports token-changed', () => {
    const seen = runBox(ok(SCHEDULED).wrapper, (box) => {
      box.seed(`${SCHEDULED_UNIT}\n${RUN_ID}\n4\n`);
      writeFileSync(join(box.root, 'flip'), '1');
    });
    assert.equal(seen.status, 15, seen.stderr);
    assert.equal(seen.stdout, 'token-changed:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb\n');
    assert.equal(seen.record, `${SCHEDULED_UNIT}\npending\n4\n`);
    assert.deepEqual(seen.calls, [
      ['flock', '-w', '20', '9'],
      listCall(),
      probeCall(),
      listCall()
    ]);
  });

  it('starts without stop-post properties when the option is absent', () => {
    const seen = runBox(ok(scheduledArgs(['--', 'dump'])).wrapper);
    assert.equal(seen.status, 0, seen.stderr);
    assert.equal(seen.stdout, '');
    assert.equal(seen.record, `${SCHEDULED_UNIT}\n${RUN_ID}\n0\n`);
    const run = seen.calls.at(-1);
    assert.equal(run[0], 'systemd-run');
    assert.equal(run.includes('ExecStopPost=/bin/sh /opt/twenty/backup/recover'), false);
    assert.equal(run[1], `--unit=${SCHEDULED_UNIT}`);
    assert.equal(run.at(-1), 'dump');
  });

  it('does not start when the shim probe fails, and leaves nothing behind', () => {
    const box = openBox(ok(SCHEDULED).wrapper);
    try {
      writeFileSync(join(box.root, 'probe-fail'), '1');
      const seen = box.fire();
      assert.equal(seen.status, 1, seen.stderr);
      assert.equal(seen.stdout, 'stop-post-setup-failed\n');
      assert.equal(seen.stderr, '');
      assert.equal(box.record(), null);
      assert.deepEqual(box.leftovers(), { scheduled: [], shims: [] });
      assert.deepEqual(box.calls(), [
        ['flock', '-w', '20', '9'],
        listCall(),
        probeCall()
      ]);
      assert.equal(box.calls().some((call) => call.some((arg) => String(arg).startsWith('--unit='))), false);
    } finally {
      box.cleanup();
    }
  });

  it('reports a release that leaves the unit loaded, and does not start', () => {
    const seen = runBox(ok(SCHEDULED).wrapper, (box) => {
      box.seed(`${SCHEDULED_UNIT}\n${RUN_ID}\n0\n`);
      box.setUnits(`${SCHEDULED_UNIT}.service loaded failed failed\n`);
      box.setState({
        InvocationID: RUN_ID,
        ActiveState: 'failed',
        SubState: 'failed',
        TasksCurrent: '0',
        LoadState: 'loaded'
      });
      writeFileSync(join(box.root, 'stay-loaded'), '1');
      // Each date +%s advances 10 seconds, so the 30-second deadline ends the wait
      // after two reads. A counted loop of 30 would still call LoadState 30 times.
      writeFileSync(join(box.root, 'clock'), '1000');
    });
    assert.equal(seen.status, 0, seen.stderr);
    assert.equal(seen.stdout, `scheduled:release-incomplete:${SCHEDULED_UNIT}:failed\n`);
    assert.equal(seen.record, `${SCHEDULED_UNIT}\n${RUN_ID}\n1\n`);
    assert.match(ok(SCHEDULED).wrapper, /now=\$\(date \+%s\)/);
    assert.match(ok(SCHEDULED).wrapper, /end=\$\(\(now \+ 30\)\)/);
    assert.match(ok(SCHEDULED).wrapper, /timeout "\$left" systemctl show -p LoadState/);
    assert.equal(ok(SCHEDULED).wrapper.includes('[ "$tries" -lt 30 ]'), false);
    assert.deepEqual(seen.calls, [
      ['flock', '-w', '20', '9'],
      listCall(),
      ...shows(),
      ['systemctl', 'reset-failed', `${SCHEDULED_UNIT}.service`],
      loadStateCall(),
      ['sleep', '1'],
      loadStateCall(),
      showCall('ActiveState')
    ]);
    assert.equal(seen.calls.some((call) => call[0] === 'systemd-run'), false);
  });

  it('bounds a sleeping LoadState read and reports release-incomplete', { timeout: 90000 }, () => {
    const started = Date.now();
    const seen = runBox(ok(SCHEDULED).wrapper, (box) => {
      box.seed(`${SCHEDULED_UNIT}\n${RUN_ID}\n0\n`);
      box.setUnits(`${SCHEDULED_UNIT}.service loaded failed failed\n`);
      box.setState({
        InvocationID: RUN_ID,
        ActiveState: 'failed',
        SubState: 'failed',
        TasksCurrent: '0',
        LoadState: 'loaded'
      });
      writeFileSync(join(box.root, 'stay-loaded'), '1');
      writeFileSync(join(box.root, 'slow-load'), '1');
    });
    const elapsed = Date.now() - started;
    assert.equal(seen.status, 0, seen.stderr);
    assert.equal(seen.stdout, `scheduled:release-incomplete:${SCHEDULED_UNIT}:failed\n`);
    assert.equal(seen.record, `${SCHEDULED_UNIT}\n${RUN_ID}\n1\n`);
    assert.ok(elapsed >= 20000, `elapsed ${elapsed}`);
    assert.ok(elapsed < 45000, `elapsed ${elapsed}`);
    const loads = seen.calls.filter((call) => call[0] === 'systemctl' && call[3] === 'LoadState');
    assert.ok(loads.length >= 2 && loads.length <= 12, `load reads ${loads.length} in ${elapsed}ms`);
    assert.equal(seen.calls.some((call) => call[0] === 'systemd-run'), false);
  });

  it('reconciles a pending record when that unit finished, then releases and starts', () => {
    const box = openBox(ok(SCHEDULED).wrapper);
    try {
      box.seed(`${OLD_UNIT}\npending\n3\n`);
      box.setUnits(`${OLD_UNIT}.service loaded active exited\n`);
      box.setState({ InvocationID: RUN_ID, ActiveState: 'active', SubState: 'exited', TasksCurrent: '0' });
      box.setInvocation(RUN_ID_2);
      const seen = box.fire();
      assert.equal(seen.status, 0, seen.stderr);
      assert.equal(seen.stdout, `scheduled:released:${OLD_UNIT}\n`);
      assert.equal(box.record(), `${SCHEDULED_UNIT}\n${RUN_ID_2}\n0\n`);
      assert.deepEqual(box.calls(), [
        ['flock', '-w', '20', '9'],
        listCall(),
        showCall('InvocationID', OLD_UNIT),
        ...shows(OLD_UNIT),
        ['systemctl', 'stop', `${OLD_UNIT}.service`],
        loadStateCall(OLD_UNIT),
        probeCall(),
        listCall(),
        systemdRun(SCHEDULED_UNIT)
      ]);
    } finally {
      box.cleanup();
    }
  });

  it('starts a new unit when a pending record names one that never loaded', () => {
    const seen = runBox(ok(SCHEDULED).wrapper, (box) => {
      box.seed(`${OLD_UNIT}\npending\n2\n`);
    });
    assert.equal(seen.status, 0, seen.stderr);
    assert.equal(seen.stdout, '');
    assert.equal(seen.record, `${SCHEDULED_UNIT}\n${RUN_ID}\n0\n`);
    assert.deepEqual(seen.calls, [
      ['flock', '-w', '20', '9'],
      listCall(),
      probeCall(),
      listCall(),
      systemdRun(SCHEDULED_UNIT)
    ]);
  });

  it('skips a pending record when the loaded unit has a different name', () => {
    const seen = runBox(ok(SCHEDULED).wrapper, (box) => {
      box.seed(`${OLD_UNIT}\npending\n0\n`);
      box.setUnits(`${OTHER_UNIT}.service loaded active exited\n`);
    });
    assert.equal(seen.status, 0, seen.stderr);
    assert.equal(seen.stdout, `scheduled:skipped:${OTHER_UNIT}\n`);
    assert.equal(seen.record, `${OLD_UNIT}\npending\n1\n`);
    assert.deepEqual(seen.calls, [
      ['flock', '-w', '20', '9'],
      listCall()
    ]);
  });

  it('leaves the pending record when a successful start cannot be parsed', () => {
    const seen = runBox(ok(SCHEDULED).wrapper, (box) => {
      writeFileSync(join(box.root, 'bad-id'), '1');
    });
    assert.equal(seen.status, 0, seen.stderr);
    assert.match(seen.stdout, new RegExp(`^scheduled:start-unparsed:${SCHEDULED_UNIT}\\n`));
    assert.match(seen.stdout, /start-exit:0\n$/);
    assert.match(seen.stdout, /invocation ID: not-an-id/);
    assert.equal(seen.record, `${SCHEDULED_UNIT}\npending\n0\n`);
    assert.equal(seen.calls.some((call) => call.includes(`--unit=${SCHEDULED_UNIT}`)), true);
  });

  it('records a first skip as none and classifies skips-only', () => {
    const box = openBox(ok(SCHEDULED).wrapper);
    try {
      box.setUnits(`${OTHER_UNIT}.service loaded active running\n`);
      const seen = box.fire();
      assert.equal(seen.status, 0, seen.stderr);
      assert.equal(seen.stdout, `scheduled:skipped:${OTHER_UNIT}\n`);
      assert.equal(box.record(), 'none\nnone\n1\n');
      assert.deepEqual(box.calls(), [
        ['flock', '-w', '20', '9'],
        listCall()
      ]);
      withDir((dir) => {
        const classified = ok(['classify', '--step', 'scheduled-record', '--answer', writeAnswer(dir, {
          outcome: 'ok',
          output: box.record()
        })]);
        assert.equal(classified.class, 'skips-only');
        assert.deepEqual(classified.facts, { skips: 1 });
      });
    } finally {
      box.cleanup();
    }
  });
});

function assertNoSlashStar(label, text) {
  assert.equal(text.includes('/*'), false, `${label} contains /*`);
  assert.equal(text.includes('*/'), false, `${label} contains */`);
}

function largestWriter(writers) {
  return writers.reduce((largest, argv) => Math.max(largest, codePoints(argv[2])), 0);
}

// Rewrites only the install destinations in a copy of each writer. The heredoc
// bodies stay the bytes scheduled printed, so the installed files can be compared
// to those bytes. chown is a PATH double: this account cannot give a file to root.
function retargetWriter(script, pairs) {
  let next = script;
  for (const [from, to] of pairs) {
    next = next.replaceAll(`'${from}.part'`, `'${to}.part'`);
    next = next.replaceAll(`writer:sha-mismatch:${from}`, `writer:sha-mismatch:${to}`);
    next = next.replaceAll(`writer:part-refused:${from}`, `writer:part-refused:${to}`);
    next = next.replaceAll(`writer:destination-refused:${from}`, `writer:destination-refused:${to}`);
    next = next.replaceAll(`installed:${from}`, `installed:${to}`);
    next = next.replaceAll(`'${from}'`, `'${to}'`);
  }
  return next;
}

function writerEnv(bin) {
  return { ...process.env, PATH: `${bin}:/bin:/usr/bin:/sbin` };
}

describe('vm-job 0.3.2 writers and stop-post', () => {
  it('fails closed when stop-post.sh cannot execute its shim', () => {
    const root = mkdtempSync(join(tmpdir(), 'vm-job-stop-'));
    try {
      const bin = join(root, 'bin');
      mkdirSync(bin);
      mkdirSync(join(root, 'run'));
      const text = readFileSync(join(ROOT, 'scripts/texts/stop-post.sh'), 'utf8');
      assert.match(text, /mktemp -d \/run\/vm-job-stop\.XXXXXX/);
      assert.match(text, /"\$d\/systemd-run" --version/);
      assert.match(text, /trap 'exit 143' TERM HUP INT/);
      assert.equal(text.includes('mkdir -p "$d"'), false);
      assert.equal(text.includes('/run/vm-job-stop.$$'), false);
      const script = text.replaceAll('/run/vm-job-stop.', `${join(root, 'run/vm-job-stop.')}`);
      const scriptPath = join(root, 'stop-post.sh');
      writeFileSync(scriptPath, script);
      writeFileSync(join(bin, 'systemd-run'), '#!/bin/sh\nfor a do\n  case "$a" in --version) exit 1 ;; esac\ndone\nprintf started > "$1"\nexit 0\n');
      chmodSync(join(bin, 'systemd-run'), 0o755);
      const started = join(root, 'started');
      const result = spawnSync('/bin/dash', [
        scriptPath, '-p', 'ExecStopPost=/bin/sh /opt/recover', '-p', 'TimeoutStopSec=30',
        `printf started > ${JSON.stringify(started)}`
      ], { encoding: 'utf8', env: writerEnv(bin) });
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.stdout, 'stop-post-setup-failed\n');
      assert.equal(existsSync(started), false);
      assert.deepEqual(readdirSync(join(root, 'run')).filter((name) => name.startsWith('vm-job-stop')), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('removes the stop-post directory when TERM exits 143', async () => {
    const root = mkdtempSync(join(tmpdir(), 'vm-job-stop-'));
    const bin = join(root, 'bin');
    mkdirSync(bin);
    mkdirSync(join(root, 'run'));
    const scriptPath = join(root, 'stop-post.sh');
    const ready = join(root, 'ready');
    writeFileSync(scriptPath, readFileSync(join(ROOT, 'scripts/texts/stop-post.sh'), 'utf8')
      .replaceAll('/run/vm-job-stop.', `${join(root, 'run/vm-job-stop.')}`));
    writeFileSync(join(bin, 'systemd-run'), '#!/bin/sh\nfor a do\n  case "$a" in --version) exit 0 ;; esac\ndone\nexit 0\n');
    chmodSync(join(bin, 'systemd-run'), 0o755);
    const child = spawn('/bin/dash', [
      scriptPath, '-p', 'ExecStopPost=/bin/sh /opt/recover', '-p', 'TimeoutStopSec=30',
      `printf ready > ${JSON.stringify(ready)}; sleep 30`
    ], { detached: true, env: writerEnv(bin) });
    const killGroup = (signal) => {
      try {
        process.kill(-child.pid, signal);
      } catch {
        try { child.kill(signal); } catch { /* already gone */ }
      }
    };
    try {
      const started = Date.now();
      while (!existsSync(ready)) {
        if (child.exitCode !== null) throw new Error(`stop-post exited ${child.exitCode} before it was ready`);
        if (Date.now() - started > 3000) throw new Error('stop-post did not reach the starter');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(readdirSync(join(root, 'run')).some((name) => name.startsWith('vm-job-stop')), true);
      killGroup('SIGTERM');
      const code = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('stop-post did not exit')), 3000);
        child.once('exit', (status) => {
          clearTimeout(timer);
          resolve(status);
        });
      });
      assert.equal(code, 143);
      assert.deepEqual(readdirSync(join(root, 'run')).filter((name) => name.startsWith('vm-job-stop')), []);
    } finally {
      killGroup('SIGKILL');
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('installs the fixture texts with writers under dash', () => {
    const built = ok(SCHEDULED);
    assert.ok(largestWriter(built.writers) <= 4096);
    for (const argv of built.writers) {
      assert.deepEqual(argv.slice(0, 2), ['/bin/sh', '-c']);
      assert.ok(codePoints(argv[2]) <= 4096);
      assert.equal(argv.slice(3).length, 0);
    }
    const root = mkdtempSync(join(tmpdir(), 'vm-job-writers-'));
    try {
      const bin = join(root, 'bin');
      mkdirSync(bin);
      writeFileSync(join(bin, 'chown'), '#!/bin/sh\n[ "$1" = root:root ] || exit 1\nexit 0\n');
      chmodSync(join(bin, 'chown'), 0o755);
      // The writer's sh -n is the target's sh. This Mac's /bin/sh is bash 3.2, which rejects a case inside $( ).
      writeFileSync(join(bin, 'sh'), '#!/bin/dash\nexec /bin/dash "$@"\n');
      chmodSync(join(bin, 'sh'), 0o755);
      // This Mac's mv rejects -T. The shim accepts the GNU form and calls /bin/mv.
      writeFileSync(join(bin, 'mv'), '#!/bin/sh\nwhile [ $# -gt 0 ]; do\n  case "$1" in\n    -T|-- ) shift ;;\n    *) break ;;\n  esac\ndone\nexec /bin/mv "$@"\n');
      chmodSync(join(bin, 'mv'), 0o755);
      const wrapperDest = join(root, 'opt/twenty/backup/wrapper');
      const serviceDest = join(root, 'etc/systemd/system', built.serviceName);
      const timerDest = join(root, 'etc/systemd/system', built.timerName);
      mkdirSync(dirname(wrapperDest), { recursive: true });
      mkdirSync(dirname(serviceDest), { recursive: true });
      const pairs = [
        ['/opt/twenty/backup/wrapper', wrapperDest],
        [`/etc/systemd/system/${built.serviceName}`, serviceDest],
        [`/etc/systemd/system/${built.timerName}`, timerDest]
      ];
      const installed = [];
      for (const argv of built.writers) {
        const script = retargetWriter(argv[2], pairs);
        const checked = spawnSync('/bin/dash', ['-n', '-c', script], { encoding: 'utf8' });
        assert.equal(checked.status, 0, checked.stderr);
        const result = spawnSync('/bin/dash', ['-c', script], { encoding: 'utf8', env: writerEnv(bin) });
        assert.equal(result.status, 0, result.stderr);
        if (result.stdout !== '') installed.push(result.stdout.trim());
      }
      assert.deepEqual(installed, [
        `installed:${wrapperDest}`,
        `installed:${serviceDest}`,
        `installed:${timerDest}`
      ]);
      assert.equal(readFileSync(wrapperDest, 'utf8'), built.wrapper);
      assert.equal(readFileSync(serviceDest, 'utf8'), built.service);
      assert.equal(readFileSync(timerDest, 'utf8'), built.timer);
      assert.equal(createHash('sha256').update(readFileSync(wrapperDest)).digest('hex'), built.sha256.wrapper);
      assert.equal(createHash('sha256').update(readFileSync(serviceDest)).digest('hex'), built.sha256.service);
      assert.equal(createHash('sha256').update(readFileSync(timerDest)).digest('hex'), built.sha256.timer);
      assert.equal(statSync(wrapperDest).mode & 0o777, 0o700);
      assert.equal(statSync(serviceDest).mode & 0o777, 0o644);
      assert.equal(statSync(timerDest).mode & 0o777, 0o644);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('prints writer:sha-mismatch when a chunk is tampered', () => {
    const built = ok(SCHEDULED);
    const root = mkdtempSync(join(tmpdir(), 'vm-job-writers-'));
    try {
      const bin = join(root, 'bin');
      mkdirSync(bin);
      writeFileSync(join(bin, 'chown'), '#!/bin/sh\nexit 0\n');
      chmodSync(join(bin, 'chown'), 0o755);
      writeFileSync(join(bin, 'mv'), '#!/bin/sh\nwhile [ $# -gt 0 ]; do\n  case "$1" in\n    -T|-- ) shift ;;\n    *) break ;;\n  esac\ndone\nexec /bin/mv "$@"\n');
      chmodSync(join(bin, 'mv'), 0o755);
      const wrapperDest = join(root, 'wrapper');
      const serviceDest = join(root, 'service');
      const timerDest = join(root, 'timer');
      const pairs = [
        ['/opt/twenty/backup/wrapper', wrapperDest],
        [`/etc/systemd/system/${built.serviceName}`, serviceDest],
        [`/etc/systemd/system/${built.timerName}`, timerDest]
      ];
      let failed = null;
      for (let index = 0; index < built.writers.length; index += 1) {
        let script = retargetWriter(built.writers[index][2], pairs);
        if (index === 0) {
          const marker = "<< 'VMJOB_EOF'\n";
          assert.equal(script.includes(marker), true);
          script = script.replace(marker, `${marker}X`);
        }
        const result = spawnSync('/bin/dash', ['-c', script], { encoding: 'utf8', env: writerEnv(bin) });
        if (result.status !== 0) {
          failed = result;
          break;
        }
      }
      assert.ok(failed);
      assert.equal(failed.status, 1);
      assert.equal(failed.stdout, `writer:sha-mismatch:${wrapperDest}\n`);
      assert.equal(existsSync(wrapperDest), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps writers within 4096 for the maximum paths and 56 operands', () => {
    const pathFor = (mark) => `/${mark.repeat(200)}`;
    const built = ok([
      'scheduled', '--purpose', 'twenty-backup', '--limit', '3600',
      '--script-path', pathFor('p'),
      '--wrapper-path', pathFor('w'),
      '--on-calendar', '*'.repeat(64),
      '--stop-post', pathFor('s'),
      '--stop-post-timeout', '3600',
      '--',
      ...Array.from({ length: 56 }, () => 'op')
    ]);
    assert.equal(built.writers.length > 0, true);
    for (const argv of built.writers) {
      for (const element of argv) assert.ok(codePoints(element) <= 4096);
      const copy = join(tmpdir(), `vm-job-max-writer-${createHash('sha256').update(argv[2]).digest('hex').slice(0, 8)}.sh`);
      writeFileSync(copy, argv[2]);
      const checked = spawnSync('/bin/dash', ['-n', copy], { encoding: 'utf8' });
      rmSync(copy, { force: true });
      assert.equal(checked.status, 0, checked.stderr);
    }
    const wrapperCopy = join(tmpdir(), 'vm-job-max-wrapper.sh');
    writeFileSync(wrapperCopy, built.wrapper);
    const wrapperChecked = spawnSync('/bin/dash', ['-n', wrapperCopy], { encoding: 'utf8' });
    rmSync(wrapperCopy, { force: true });
    assert.equal(wrapperChecked.status, 0, wrapperChecked.stderr);
    assert.ok(largestWriter(built.writers) <= 4096);
  });

  it('refuses a line that cannot fit in one writer', () => {
    refused(scheduledArgs(['--', 'x'.repeat(4096)]), /a wrapper writer is \d+ code points; the maximum is 4096/);
    refused(scheduledArgs(['--', 'VMJOB_EOF']), /the wrapper contains the writer delimiter "VMJOB_EOF"/);
  });

  it('contains no slash-star pair in shipped texts, wrappers, or writers', () => {
    const names = readdirSync(join(ROOT, 'scripts/texts'));
    for (const name of names) {
      assertNoSlashStar(name, readFileSync(join(ROOT, 'scripts/texts', name), 'utf8'));
    }
    for (const built of [ok(SCHEDULED), ok(scheduledArgs(['--', 'dump']))]) {
      assertNoSlashStar('wrapper', built.wrapper);
      assertNoSlashStar('service', built.service);
      assertNoSlashStar('timer', built.timer);
      built.writers.forEach((argv, index) => assertNoSlashStar(`writer ${index}`, argv[2]));
    }
    const pathFor = (mark) => `/${mark.repeat(200)}`;
    const max = ok([
      'scheduled', '--purpose', 'twenty-backup', '--limit', '3600',
      '--script-path', pathFor('p'),
      '--wrapper-path', pathFor('w'),
      '--on-calendar', '*-*-* 03:00:00',
      '--stop-post', pathFor('s'),
      '--stop-post-timeout', '30',
      '--',
      ...Array.from({ length: 56 }, () => 'op')
    ]);
    assertNoSlashStar('max wrapper', max.wrapper);
    max.writers.forEach((argv, index) => assertNoSlashStar(`max writer ${index}`, argv[2]));
  });

  it('replays the wrapper from its first writer after an interruption following writer 2', () => {
    const built = ok(SCHEDULED);
    const root = mkdtempSync(join(tmpdir(), 'vm-job-writers-'));
    try {
      const bin = armWriterBin(root);
      const laid = layDestinations(root, built);
      const scripts = writersFor(built.writers, '/opt/twenty/backup/wrapper')
        .map((argv) => retargetWriter(argv[2], laid.pairs));
      assert.ok(scripts.length >= 2, `wrapper writers: ${scripts.length}`);
      const run = (script) => spawnSync('/bin/dash', ['-c', script], { encoding: 'utf8', env: writerEnv(bin) });
      const first = run(scripts[0]);
      assert.equal(first.status, 0, first.stderr);
      let secondScript = scripts[1];
      // Writer 2 both appends and finalizes. Stop it after the append, which is
      // the interruption: the part holds the chunk, and the destination was not moved.
      if (secondScript.includes('sha256sum')) {
        const marker = '\nVMJOB_EOF\n';
        const at = secondScript.indexOf(marker);
        assert.ok(at > 0);
        secondScript = `${secondScript.slice(0, at + marker.length)}exit 0\n`;
      }
      const second = run(secondScript);
      assert.equal(second.status, 0, second.stderr);
      assert.equal(existsSync(laid.wrapperDest), false);
      assert.equal(statSync(`${laid.wrapperDest}.part`).isFile(), true);
      const installed = [];
      for (const script of scripts) {
        const result = run(script);
        assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
        if (result.stdout !== '') installed.push(result.stdout.trim());
      }
      assert.deepEqual(installed, [`installed:${laid.wrapperDest}`]);
      assert.equal(readFileSync(laid.wrapperDest, 'utf8'), built.wrapper);
      assert.equal(existsSync(`${laid.wrapperDest}.part`), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a symlinked part and leaves its target untouched', () => {
    const built = ok(SCHEDULED);
    const root = mkdtempSync(join(tmpdir(), 'vm-job-writers-'));
    try {
      const bin = armWriterBin(root);
      const laid = layDestinations(root, built);
      const script = retargetWriter(writersFor(built.writers, '/opt/twenty/backup/wrapper')[0][2], laid.pairs);
      const live = join(root, 'live-wrapper');
      const part = `${laid.wrapperDest}.part`;
      writeFileSync(live, 'keep-me\n');
      symlinkSync(live, part);
      const result = spawnSync('/bin/dash', ['-c', script], { encoding: 'utf8', env: writerEnv(bin) });
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.stdout, `writer:part-refused:${laid.wrapperDest}\n`);
      assert.equal(readFileSync(live, 'utf8'), 'keep-me\n');
      assert.equal(lstatSync(part).isSymbolicLink(), true);
      assert.equal(existsSync(laid.wrapperDest), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a directory standing in for the part and writes nothing there', () => {
    const built = ok(SCHEDULED);
    const root = mkdtempSync(join(tmpdir(), 'vm-job-writers-'));
    try {
      const bin = armWriterBin(root);
      const laid = layDestinations(root, built);
      const script = retargetWriter(writersFor(built.writers, '/opt/twenty/backup/wrapper')[0][2], laid.pairs);
      const part = `${laid.wrapperDest}.part`;
      mkdirSync(part);
      const result = spawnSync('/bin/dash', ['-c', script], { encoding: 'utf8', env: writerEnv(bin) });
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.stdout, `writer:part-refused:${laid.wrapperDest}\n`);
      assert.equal(lstatSync(part).isDirectory(), true);
      assert.deepEqual(readdirSync(part), []);
      assert.equal(existsSync(laid.wrapperDest), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a later writer unless the part is a regular file', () => {
    const built = ok(SCHEDULED);
    const root = mkdtempSync(join(tmpdir(), 'vm-job-writers-'));
    try {
      const bin = armWriterBin(root);
      const laid = layDestinations(root, built);
      const scripts = writersFor(built.writers, '/opt/twenty/backup/wrapper')
        .map((argv) => retargetWriter(argv[2], laid.pairs));
      assert.ok(scripts.length >= 2);
      const result = spawnSync('/bin/dash', ['-c', scripts[1]], { encoding: 'utf8', env: writerEnv(bin) });
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.stdout, `writer:part-refused:${laid.wrapperDest}\n`);
      assert.equal(existsSync(laid.wrapperDest), false);
      assert.equal(existsSync(`${laid.wrapperDest}.part`), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('refuses a directory at the destination and prints nothing installed', () => {
    const built = ok(SCHEDULED);
    const root = mkdtempSync(join(tmpdir(), 'vm-job-writers-'));
    try {
      const bin = armWriterBin(root);
      const laid = layDestinations(root, built);
      mkdirSync(laid.serviceDest);
      const scripts = writersFor(built.writers, `/etc/systemd/system/${built.serviceName}`)
        .map((argv) => retargetWriter(argv[2], laid.pairs));
      assert.ok(scripts.length >= 1);
      let stdout = '';
      let failed = null;
      for (const script of scripts) {
        const result = spawnSync('/bin/dash', ['-c', script], { encoding: 'utf8', env: writerEnv(bin) });
        stdout += result.stdout;
        if (result.status !== 0) {
          failed = result;
          break;
        }
      }
      assert.ok(failed);
      assert.equal(failed.status, 1, failed.stderr);
      assert.equal(failed.stdout, `writer:destination-refused:${laid.serviceDest}\n`);
      assert.equal(stdout.includes('installed:'), false);
      assert.equal(lstatSync(laid.serviceDest).isDirectory(), true);
      assert.deepEqual(readdirSync(laid.serviceDest), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function armWriterBin(root) {
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'chown'), '#!/bin/sh\n[ "$1" = root:root ] || exit 1\nexit 0\n');
  writeFileSync(join(bin, 'sh'), '#!/bin/dash\nexec /bin/dash "$@"\n');
  writeFileSync(join(bin, 'mv'), '#!/bin/sh\nwhile [ $# -gt 0 ]; do\n  case "$1" in\n    -T|-- ) shift ;;\n    *) break ;;\n  esac\ndone\nexec /bin/mv "$@"\n');
  for (const name of ['chown', 'sh', 'mv']) chmodSync(join(bin, name), 0o755);
  return bin;
}

function layDestinations(root, built) {
  const wrapperDest = join(root, 'opt/twenty/backup/wrapper');
  const serviceDest = join(root, 'etc/systemd/system', built.serviceName);
  const timerDest = join(root, 'etc/systemd/system', built.timerName);
  mkdirSync(dirname(wrapperDest), { recursive: true });
  mkdirSync(dirname(serviceDest), { recursive: true });
  return {
    wrapperDest,
    serviceDest,
    timerDest,
    pairs: [
      ['/opt/twenty/backup/wrapper', wrapperDest],
      [`/etc/systemd/system/${built.serviceName}`, serviceDest],
      [`/etc/systemd/system/${built.timerName}`, timerDest]
    ]
  };
}

function writersFor(writers, path) {
  const marker = `p='${path}.part'`;
  return writers.filter((argv) => argv[2].includes(marker));
}
