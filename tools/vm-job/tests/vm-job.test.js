import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runVmJob } from '../scripts/vm-job-core.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'vm-job.js');
const FIXTURES = join(ROOT, 'tests', 'fixtures');
const UNIT_RE = /^vm-job-[a-z0-9]+(-[a-z0-9]+)*-[0-9]{8}t[0-9]{6}z-[0-9a-f]{6}$/;
const POLL = 'sleep "$2"; systemctl show -p LoadState,ActiveState,SubState,Result,ExecMainCode,ExecMainStatus,InvocationID,TasksCurrent,ExecMainStartTimestamp,ExecMainExitTimestamp "$1.service"';
const READBACK = 'journalctl --no-pager -o short-iso -n "$2" _SYSTEMD_INVOCATION_ID="$1" + INVOCATION_ID="$1"';
const JOURNAL = 'journalctl --no-pager -o short-iso -n "$2" -u "$1.service"';
const STARTER_SHA = 'f077696e413cd0f4fa10aebfb0338befad7472a9758f7a7cff3ea987ad8d477a';
const RELEASE_SHA = '76560f94be28d5cd41aef6f3858340797aa62a1186efbece9c2f769aaeeb21b2';
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
      refused(['poll', '--unit', UNIT, '--wait', '41'], /--wait must be a whole number from 0 to 40/);
      refused(['poll', '--unit', UNIT, '--wait', '00'], /--wait must be a whole number from 0 to 40/);
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
      ok(['poll', '--unit', UNIT, '--wait', '40']);
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
