---
name: vm-job
type: tool
category: operations
description: Build the argument vectors that start, poll, read back and release a tracked background job on one machine a router maps, and classify each answer, as one JSON object
version: 0.1.0
---

# vm-job

One JSON object that builds the `argv` for one tracked background job, or classifies the answer a call returned. It does not run the job.

## Context

Use it when a skill starts, polls, reads back, reads the journal of, or releases one tracked background job on one machine a router maps, or classifies the JSON answer that call returned.

Do not use it to call the gateway, to reach a machine, or to write a file. It reads only the files it is given. A skill sends the `argv` it prints, unchanged, as one `vm.command.run`. The answer file is the JSON object the gateway's `execute` returned, unchanged.

Classifier seam: none.

## Quick Start

```bash
node scripts/vm-job.js help
```

Usage text, with nothing installed and nothing configured. The tool needs Node 18 or later, the same runtime the local gateway that reaches the `vm` connector already needs.

```bash
node scripts/vm-job.js start --purpose apt-install --limit 1800 --token none --script /path/to/job.sh -- install pkg=1.0
node scripts/vm-job.js poll --unit vm-job-apt-install-20261005t120000z-abcdef --wait 0
node scripts/vm-job.js readback --invocation 0123456789abcdef0123456789abcdef --lines 200
node scripts/vm-job.js journal --unit vm-job-apt-install-20261005t120000z-abcdef --lines 200
node scripts/vm-job.js release --unit vm-job-apt-install-20261005t120000z-abcdef --invocation 0123456789abcdef0123456789abcdef
node scripts/vm-job.js classify --step start --unit vm-job-apt-install-20261005t120000z-abcdef --answer /path/to/answer.json
```

One JSON object on stdout. Nothing is written. Anything else, see Troubleshooting.

## Usage

| Command | Purpose | Writes a file |
|---------|---------|---------------|
| `node scripts/vm-job.js help` | Print usage and exit | No |
| `node scripts/vm-job.js start --purpose <purpose> --limit <seconds> --token <token> --script <file> [-- <operand>...]` | Print `{ command, unit, argv }` for the starter | No |
| `node scripts/vm-job.js poll --unit <unit> --wait <seconds>` | Print `{ command, argv }` for one poll | No |
| `node scripts/vm-job.js readback --invocation <id> --lines <count>` | Print `{ command, argv }` for one read-back by invocation ID | No |
| `node scripts/vm-job.js journal --unit <unit> --lines <count>` | Print `{ command, argv }` for one journal read by unit | No |
| `node scripts/vm-job.js release --unit <unit> --invocation <id>` | Print `{ command, argv }` for the release script | No |
| `node scripts/vm-job.js classify --step <step> --answer <file> [--unit <unit>] [--recorded <id>]` | Print the class of one saved answer | No |

`start` options:

| Option | Effect | Default |
|--------|--------|---------|
| `--purpose <purpose>` | Lowercase letters, digits, and single hyphens: `^[a-z0-9]+(-[a-z0-9]+)*$` | None; required |
| `--limit <seconds>` | A whole number from 1 to 86400, written in digits | None; required |
| `--token <token>` | `none`, or a lowercase UUID | None; required |
| `--script <file>` | The job script. Absolute path. UTF-8, at most 4096 code points, no NUL, first line exactly `set -eu` | None; required |
| `-- <operand>` | Each operand, after `--`. At most 56. Empty is allowed. A leading dash is allowed. Without `--`, a dash is a flag | None |
| `--help`, `-h` | Print usage and exit | Off |

`poll` options:

| Option | Effect | Default |
|--------|--------|---------|
| `--unit <unit>` | The unit name `start` printed | None; required |
| `--wait <seconds>` | A whole number from 0 to 40, written in digits | None; required |
| `--help`, `-h` | Print usage and exit | Off |

`readback` options:

| Option | Effect | Default |
|--------|--------|---------|
| `--invocation <id>` | 32 lowercase hex characters | None; required |
| `--lines <count>` | A whole number from 1 to 2000, written in digits | None; required |
| `--help`, `-h` | Print usage and exit | Off |

`journal` options:

| Option | Effect | Default |
|--------|--------|---------|
| `--unit <unit>` | The unit name | None; required |
| `--lines <count>` | A whole number from 1 to 2000, written in digits | None; required |
| `--help`, `-h` | Print usage and exit | Off |

`release` options:

| Option | Effect | Default |
|--------|--------|---------|
| `--unit <unit>` | The unit name | None; required |
| `--invocation <id>` | 32 lowercase hex characters | None; required |
| `--help`, `-h` | Print usage and exit | Off |

`classify` options:

| Option | Effect | Default |
|--------|--------|---------|
| `--step <step>` | `start`, `poll`, `readback`, `journal`, or `release` | None; required |
| `--answer <file>` | The gateway answer, one JSON object. Absolute path | None; required |
| `--unit <unit>` | Required when `--step` is `start`. Refused on the other steps | None |
| `--recorded <id>` | Optional when `--step` is `poll`: the invocation ID already recorded. Refused on the other steps | Omitted |
| `--help`, `-h` | Print usage and exit | Off |

No command takes `--env`. This tool installs nothing, and `--install` is refused by name like any other unknown flag. An unknown flag is refused by name before any file is read, including when it sits beside `help`. `--flag=value` is an unknown option. A repeated flag is refused. A flag that needs a value, given none or given a value that starts with `-`, is refused. An argument that belongs to no flag is refused. `--` ends flags on `start` only. On the other commands it is an unexpected argument. An unknown command is refused by name.

A whole number is written in digits with no sign and no leading zero, except `0` itself. `01`, `+1`, and `1.0` are refused. The digit string is passed through into `argv` unchanged.

A unit name matches `^vm-job-[a-z0-9]+(-[a-z0-9]+)*-[0-9]{8}t[0-9]{6}z-[0-9a-f]{6}$` and is at most 120 characters. `start` builds `vm-job-<purpose>-<yyyymmddthhmmssz>-<six lowercase hex>`. The stamp is the current UTC time to the second. The six hex characters are fresh from `node:crypto` on every run, so a name is never used twice. A purpose that would make the name longer than 120 characters is refused.

`--token` is `none` or a lowercase UUID, `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. An uppercase UUID is refused. `--invocation` and `--recorded` are 32 lowercase hex characters.

Every path is absolute. A relative path is refused by name. The screen is the one `wiser/standards/script-contract.md` requires, and the resolved path is the one opened. `--script` and `--answer` must be files. A missing path, or the wrong kind, is refused by name. There is no credential file to refuse, because no command takes `--env`, and there is no destination to refuse, because nothing is written. A source that happens to sit inside this tool directory is read; the tool still writes nothing there.

The job script is counted in code points. A file of 4096 code points is accepted when one of them is above the basic multilingual plane. The first line is the text before the first newline, and it must be exactly `set -eu`. A carriage return on that line does not match. A file that is only `set -eu`, with no newline, does.

`argv` for `start` is `/bin/sh`, `-c`, the starter, `sh`, the unit, the limit, the token, the script's text, then each operand. That prefix is 8 strings. The connector bounds one `argv` at 64 strings, so `start` admits at most 56 operands. One more is refused by name.

## The job

A job is a transient systemd service on the target machine, started, polled, read back and released through `vm.command.run`, each call inside the router's limit. It belongs to PID 1, not to the call that started it. One job is loaded per machine at a time.

The outcome names are the ones `connectors/vm/CONNECTOR.md` in `wiser` publishes. A gateway status is `status`. A router result is `outcome`.

**Its name** is `vm-job-<purpose>-<yyyymmddthhmmssz>-<six lowercase hex characters>`, the purpose in lowercase letters, digits and hyphens, the stamp in UTC to the second, the six characters chosen afresh for each run. It matches the unit pattern `connectors/vm/CONNECTOR.md` in `wiser` publishes. **A name is never used twice**, loaded or not, so a later read of that name cannot meet another run.

**The lock** is `flock` on `/run/lock/vm-job.lock`, held by the starter and by release for the length of one call, never across calls. It is writable from inside the router's sandbox.

**The generation token** is `/run/vm-job.token`, a fresh random UUID written under the lock by every start and every release. **The inspection a job's plan rests on reads it in the same call as the rest of that inspection**, printing the file's text, or `none` when there is no file, which is what the starter reads too, and the starter refuses unless the token is still that value. So a plan made before another job started, or while one ran, or before one was released, never starts. `/run` is cleared at a reboot, after which the token reads `none` until the next start. **It sees jobs only**: a change made any other way, by hand or by a direct `vm.command.run`, does not renew it, which is why a skill that runs its changes as jobs should run all of them that way.

**Starting it** is one `vm.command.run` whose `argv` is the array `start` prints: `/bin/sh`, `-c`, the starter below, `sh`, the unit name, the limit in seconds, the token the inspection read, the job's script, and then any operands the job takes, which reach the job's script as `$1` onward. The script and its operands are never spliced into the starter's text, so a package name stays an operand all the way to the command that uses it.

**Polling it** is one `vm.command.run` whose `argv` is the array `poll` prints. The wait is at most 40 seconds so the whole call stays well inside the router's 60 seconds.

**Reading it back** is one `vm.command.run` whose `argv` is the array `readback` prints. It reads by the recorded invocation ID, not by the name's current one. A `truncated` answer is read again with fewer lines; the report says how many it shows. **The journal outlives release**, so the read-back can come before or after it.

**Reading the journal by unit** is one `vm.command.run` whose `argv` is the array `journal` prints. The poll class `not-loaded` is the row that asks for it.

**Releasing it** is one `vm.command.run` whose `argv` is the array `release` prints, with the unit and the recorded ID, after a poll that read the job finished. Under `ExitType=cgroup`, `active/exited` means every process has ended, so the stop kills nothing. Stopping a running job is a cancel, a change of its own, and not release.

**A second run that finds a job loaded** does not start another, and does not carry on with what it planned before it looked. A running job is reported as running, and the run stops. A finished one is an earlier run's result: it is polled once at wait 0, classified with no `--recorded`, and the invocation ID that poll reads is the one adopted. It is read back and released with that ID, and reported as that run's. **This run then starts over from its own inspection and gate**, which the renewed token enforces: its old token is refused. That start-over happens at most once. A loaded unit carrying this run's own name is this run's, after a start whose answer was lost: poll it.

**What a job's script must be.** It begins `set -eu`. Every step runs in the foreground: no `&`, no daemonizing. The script's exit status is the last command's, so a step whose failure matters is not followed by one that can succeed regardless. Apt changes carry the skill's own pins, `--no-remove` and keep-old-config options, and the starter sets `DEBIAN_FRONTEND=noninteractive` and `NEEDRESTART_SUSPEND=1`. A job has no home directory; a tool that wants one, `gpg` among them, gets a temporary one. On the router host a job runs outside the router's sandbox, which is why it can install a package there, and also why every path rule the skill applies to a direct call applies to a job unchanged.

## The scripts it emits

The starter and the release below are the bytes `argv` carries, including the trailing newline. The poll command, the read-back command, and the journal command have no trailing newline. Do not reflow them. A skill does not write these scripts. It runs the command and sends the `argv`.

The starter:

```
unit=$1; limit=$2; expect=$3; job=$4; shift 4
exec 9>/run/lock/vm-job.lock
flock -w 20 9 || { echo lock-busy; exit 11; }
existing=$(systemctl list-units --all --plain --no-legend 'vm-job-*') || { echo enumeration-failed; exit 12; }
if [ -n "$existing" ]; then printf 'existing-job\n%s\n' "$existing"; exit 10; fi
cur=$(cat /run/vm-job.token 2>/dev/null || echo none)
if [ "$cur" != "$expect" ]; then echo "token-changed:$cur"; exit 15; fi
cat /proc/sys/kernel/random/uuid > /run/vm-job.token || { echo token-write-failed; exit 16; }
echo "token:$(cat /run/vm-job.token)"
systemd-run --unit="$unit" --description="background job $unit" --expand-environment=no -p Type=exec -p ExitType=cgroup -p RemainAfterExit=yes -p RuntimeMaxSec="$limit" -E DEBIAN_FRONTEND=noninteractive -E NEEDRESTART_SUSPEND=1 -- /bin/sh -c "$job" sh "$@" 2>&1
rc=$?
echo "start-exit:$rc"
exit "$rc"
```

The release:

```
unit=$1; id=$2
exec 9>/run/lock/vm-job.lock
flock -w 20 9 || { echo lock-busy; exit 11; }
cur=$(systemctl show -p InvocationID --value "$unit.service")
st=$(systemctl show -p ActiveState --value "$unit.service")
sub=$(systemctl show -p SubState --value "$unit.service")
tasks=$(systemctl show -p TasksCurrent --value "$unit.service")
if [ "$cur" != "$id" ]; then echo "invocation-mismatch:$cur"; exit 13; fi
case "$st/$sub" in
  active/exited) ;;
  failed/*) case "$tasks" in ''|'[not set]'|0) ;; *) echo "processes-remain:$tasks"; exit 17 ;; esac ;;
  *) echo "not-finished:$st/$sub"; exit 14 ;;
esac
if [ "$st" = active ]; then systemctl stop "$unit.service"; else systemctl reset-failed "$unit.service"; fi
rc=$?
cat /proc/sys/kernel/random/uuid > /run/vm-job.token
echo "release-exit:$rc"
echo "load-state:$(systemctl show -p LoadState --value "$unit.service")"
exit "$rc"
```

The poll command, with no trailing newline, is `sleep "$2"; systemctl show -p LoadState,ActiveState,SubState,Result,ExecMainCode,ExecMainStatus,InvocationID,TasksCurrent,ExecMainStartTimestamp,ExecMainExitTimestamp "$1.service"`.

The read-back command, with no trailing newline, is `journalctl --no-pager -o short-iso -n "$2" _SYSTEMD_INVOCATION_ID="$1" + INVOCATION_ID="$1"`.

The journal command, with no trailing newline, is `journalctl --no-pager -o short-iso -n "$2" -u "$1.service"`.

`release-exit:0` with `load-state:not-found` is released, and the token renewed. Exit 11, 13, 14 or 17 released nothing and left the token alone.

## Classification

`classify` reads the answer file. A missing file, a file that is not valid UTF-8, a file that contains a NUL, a file that is not JSON, or a JSON value that is not an object, is refused, exit 1. An array, `null`, a string, or a number is not an object. Otherwise `classify` exits 0 and the class is in the JSON, including `unknown` and `not-read`. Extra keys on the answer are ignored and are not listed. `exit_code` matches only as a number: the string `"10"` is not exit 10. `finished` is present only for step `poll`.

Take the first match in the step. A marker class needs its marker line and its exit code together. A code without its marker, or a marker without its code, is not that class.

On `start`, a non-empty `status` other than `vendor_error` is `gateway-status` before any line is read, because a gateway stop is not a router result. `vendor_error` is `unknown`, and its output is not read as a start. On `release`, any non-empty `status` is `unknown`, and its output is not read. On `poll`, `readback`, and `journal`, an answer whose `outcome` is not `ok` is `not-read` (and `truncated` is its own class on a read-back or a journal). A `needs_confirmation` answer is the caller's approval question. Classifying it does not say what the job did.

### start

Requires `--unit`, the unit this run's `start` printed. The started line has to name that unit.

| Class | Means | Caller does next |
|-------|-------|------------------|
| `gateway-status` | `status` is a non-empty string other than `vendor_error`. Facts are `{ status }`. Not a router result | The caller's approval question when the status is `needs_confirmation`. Any other status is the caller's gateway handling. Do not poll it as a start |
| `unknown` from `vendor_error` | `status` is `vendor_error`. The output is not read. Facts carry `outcome` and `status` when those values are strings | Unknown whether it started. The `unknown` row below |
| `started` | The line `Running as unit: <unit>.service; invocation ID: <32 hex>` and the line `start-exit:0`. Facts are `invocationId`, and `token` from the first line that begins `token:` and does not begin `token-changed:`. No such line leaves `token` null | Record the invocation ID. Poll |
| `existing-job` | A line `existing-job` and `exit_code` 10. Facts `units` are the non-empty lines after that marker | Nothing was started. The second-run rule |
| `lock-busy` | A line `lock-busy` and `exit_code` 11 | Nothing was started. Start again later with the same token. A token that moved is `token-changed` |
| `enumeration-failed` | A line `enumeration-failed` and `exit_code` 12 | Nothing was started |
| `token-changed` | A line beginning `token-changed:` and `exit_code` 15. Facts `token` is the text after the colon | Nothing was started. The plan is stale. Inspect again and gate again before any start |
| `token-write-failed` | A line `token-write-failed` and `exit_code` 16 | Nothing was started. The token may have changed. Inspect again |
| `refused-before-submission` | A line `start-exit:1` and a line containing `Failed to find executable` or `already loaded or has a fragment file` | Nothing was started. The token was renewed. Inspect again |
| `unknown` | Any other answer: any other `start-exit`, `timeout`, `killed`, `request_timeout`, `connect_timeout`, `busy`, a failure with no `machine`, a `remote_failure` with no `start-exit:` line. Facts carry `outcome` and `status` when those values are strings, and otherwise `{}` | Unknown whether it started. `systemd-run` can fail after systemd has accepted the job. Poll by this run's name. A loaded class means it started, and the invocation ID that poll reads is the one to record. `not-loaded` is the history question. Never send the start again without a new inspection and a new approval |

### poll

`--recorded` is optional. The ten fields, in order, are `LoadState`, `ActiveState`, `SubState`, `Result`, `ExecMainCode`, `ExecMainStatus`, `InvocationID`, `TasksCurrent`, `ExecMainStartTimestamp`, `ExecMainExitTimestamp`. Facts carry all ten. A field that was absent is null. When `outcome` is not `ok`, all ten are null, so a failed call does not claim a job state. "No processes" means `TasksCurrent` is `[not set]`, empty, or `0`. An invocation ID is set when it is a non-empty string other than `[not set]`.

Without `--recorded`, facts also carry `invocationId`, the ID when it is set and null when it is not, for the caller to adopt. With `--recorded`, facts also carry `recorded`, that ID. `finished` is true for `succeeded`, `signal`, `failed-exit`, `failed-timeout`, and `failed-other`. It is false for every other poll class.

| Class | Means | Caller does next |
|-------|-------|------------------|
| `not-read` | `outcome` is not `ok`, or any of the ten fields is missing. Says nothing about the job | Poll again |
| `other-invocation` | `--recorded` was given, and `InvocationID` is set and differs. Without `--recorded` this class does not apply | Stop. Change nothing. Report both IDs |
| `running` | `ActiveState` is `activating`, or `active` and `SubState` is `running` | Still running. Poll again |
| `deactivating` | `ActiveState` is `deactivating`, any `SubState`. Not finished, whatever `Result` reads | Being stopped, by its limit or by someone else. Poll again |
| `succeeded` | `active`, `exited`, `ExecMainCode` `1`, `ExecMainStatus` `0`. Finished, exit 0, every process ended | The job succeeded. The change is not yet known to have succeeded: the caller's re-inspection decides that |
| `signal` | `active`, `exited`, `ExecMainCode` other than `1` | Killed by signal `ExecMainStatus`, which systemd counted clean. Failed |
| `stuck` | `ActiveState` is `failed` and `TasksCurrent` is not "no processes". This row is before the `failed-` rows, so a failed result with processes remaining is `stuck` | Not finished. Stop. Change nothing. Release refuses it. It is the person's, over the provider's console |
| `failed-exit` | `ActiveState` is `failed` and `Result` is `exit-code` | Failed with exit `ExecMainStatus` |
| `failed-timeout` | `ActiveState` is `failed` and `Result` is `timeout` | A limit stopped it. The journal says which. The work may be partial. For apt, the re-inspection's `dpkg --audit` decides what was left |
| `failed-other` | `ActiveState` is `failed` and `Result` is anything else | Failed. Name the `Result` verbatim |
| `not-loaded` | `LoadState` is `not-found` or `inactive`, or `ActiveState` is `inactive` | Not loaded: released, stopped by someone, never started, or the machine rebooted. Read the journal by unit. Entries are what it shows. `no-entries` is execution history unknown, never proof it did not run: a journal can be volatile or vacuumed. Either way the caller re-inspects and never repeats a change on this alone |
| `unrecognized` | The ten fields were read and no row above matched. A normal exit with `ExecMainCode` `1` and `ExecMainStatus` other than `0` lands here | Name the fields. Do not treat it as finished |

### readback and journal

| Class | Means | Caller does next |
|-------|-------|------------------|
| `truncated` | `outcome` is `truncated`. Facts `lines` is the line count of the output that came back. This row is before `no-entries` | Read again with fewer lines. The report names that count |
| `not-read` | `outcome` is not `ok`. Facts `lines` is null | Says nothing about the journal |
| `no-entries` | Journal only. `outcome` is `ok`, and the output is empty or only `-- No entries --`, ignoring blank lines. Facts `lines` is 0 | Execution history unknown. Never proof the job did not run |
| `read` | `outcome` is `ok`, and the journal row did not apply. Facts `lines` is the line count | The lines are the read. A read-back of `-- No entries --` is `read`, not `no-entries` |

### release

| Class | Means | Caller does next |
|-------|-------|------------------|
| `unknown` from `status` | `status` is a non-empty string. The output is not read. Release has no gateway-status class | Name the status. Do not treat it as released. A `needs_confirmation` answer is the approval question, taken before classify |
| `released` | The lines `release-exit:0` and `load-state:not-found` | Released. The token was renewed |
| `lock-busy` | A line `lock-busy` and `exit_code` 11 | Released nothing. The token was left alone |
| `invocation-mismatch` | A line beginning `invocation-mismatch:` and `exit_code` 13. Facts `invocationId` is the text after the colon | Released nothing. The token was left alone. Stop |
| `not-finished` | A line beginning `not-finished:` and `exit_code` 14. Facts `state` is the text after the colon | Released nothing. The token was left alone |
| `processes-remain` | A line beginning `processes-remain:` and `exit_code` 17. Facts `tasks` is the text after the colon | Released nothing. The token was left alone. Stuck: the person's, over the provider's console |
| `unknown` | Any other answer. Facts carry `outcome` and `status` when those values are strings | Name it. Do not treat it as released |

## Script Contract

Every script in this tool follows `wiser/standards/script-contract.md`. What a user meets when running it is `wiser/tools/RUNNING.md`. Node 18 or later covers the whole tool, the same runtime the local gateway that reaches the `vm` connector already needs. Node built-ins cover it, so the contract's dependency-install, `--env`, and system-dependency clauses have nothing to bind here and the tool carries no Dependencies section. No command checks for a package or runs an install. No command takes `--env`, and `--install` is refused by name. Nothing is written, anywhere. The sections above state what each command does; the contract states how the script behaves getting there.

## Output

`help` prints usage text to stdout and exits 0.

`start` prints one JSON object, exit 0:

| Field | Carries |
|-------|---------|
| `command` | `start` |
| `unit` | The unit name built for this run |
| `argv` | `/bin/sh`, `-c`, the starter, `sh`, the unit, the limit, the token, the script text, then each operand |

`poll`, `readback`, `journal`, and `release` print one JSON object, exit 0:

| Field | Carries |
|-------|---------|
| `command` | `poll`, `readback`, `journal`, or `release` |
| `argv` | `/bin/sh`, `-c`, that command's script, `sh`, then the command's own strings, in the order the command takes them |

`classify` prints one JSON object, exit 0:

| Field | Carries |
|-------|---------|
| `command` | `classify` |
| `step` | The `--step` value |
| `class` | The class, kebab-case |
| `finished` | Present only for `poll`. True for `succeeded`, `signal`, and the three `failed-` classes |
| `facts` | The object the class section names. A class with nothing to add carries `{}` |

A refusal prints to stderr, leaves stdout empty, and exits 1. The message names the cause.

## Troubleshooting

| What you see | What to do |
|--------------|------------|
| `unknown option "--install"` or `unknown option "--env"` | Drop the flag. No command takes `--env`, and the tool installs nothing |
| `unknown option` or `unknown command` | Run `node scripts/vm-job.js help`. `--flag=value` is an unknown option. Pass the value as the next argument |
| `was given more than once` | Pass that flag once |
| `needs a value` | The next argument is missing, or it starts with `-`. On `start`, put operands after `--` |
| `is required` | Pass the flag the message names |
| `must be an absolute path` | Pass an absolute path. A relative one is refused by name |
| `no file at` or `is not a file` | `--script` and `--answer` are readable files |
| `could not be read` or `could not be resolved` | The path is unreadable, or a directory on the way is |
| `--purpose must match` | Use lowercase letters, digits, and single hyphens |
| `the unit name is` and `the maximum is 120` | Shorten `--purpose`. The stamp and the six hex characters are part of the 120 |
| `--unit must match` | Pass the unit `start` printed |
| `must be a whole number` | Digits only, in range. No sign, no leading zero, except `0` for `--wait` |
| `--token must be none or a lowercase UUID` | Pass `none` or a lowercase UUID |
| `must be 32 lowercase hex characters` | Pass the invocation ID in lowercase hex |
| `operands is more than 56` | `argv` holds at most 64 strings, and the starter prefix is 8 |
| `contains a NUL` or `is not valid UTF-8` | The script or the answer is not the text this tool reads |
| `the script is` and `code points` | Shorten the script to 4096 code points or fewer |
| `first line must be exactly "set -eu"` | Make that the first line, with no trailing carriage return |
| `operand` and `code points` | Shorten that operand to 4096 code points or fewer |
| `--step must be` | Pass `start`, `poll`, `readback`, `journal`, or `release` |
| `--unit is required for step start` | Pass `--unit` when classifying a start |
| `--unit applies to step start` | Drop `--unit`, or pass `--step start` |
| `--recorded applies to step poll` | Drop `--recorded`, or pass `--step poll` |
| `is not JSON` or `must be one JSON object` | Save the gateway object unchanged. An array, a string, a number, or `null` is refused |
| `class` is `unknown` or `not-read` and the process exited 0 | That is a successful classification. Read `class` and `facts`. Exit 1 means the file was not classified |

## Success

- `node scripts/vm-job.js help` exits 0 and names every flag, including `--install` and `--env`.
- `start`, `poll`, `readback`, `journal`, and `release` each exit 0 with one JSON object, and `argv[2]` is that command's script.
- Two `start` runs print different unit names.
- `classify` exits 0 with one JSON object for every class, `unknown` and `not-read` included, and `finished` is present only for `poll`.
- A bad flag, a bad path, a bad script, a bad operand, or an answer that is not one JSON object exits 1 with stdout empty, and the message names the cause.
- Nothing is written, and no command contacts a gateway or a machine.
