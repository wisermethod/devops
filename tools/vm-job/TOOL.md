---
name: vm-job
type: tool
category: operations
description: Build the argument vectors that start, poll, read back and release a tracked background job on one machine a router maps, build the texts for a scheduled job, and classify each answer, as one JSON object
version: 0.3.2
---

# vm-job

One JSON object that builds the `argv` for one tracked background job, or classifies the answer a call returned. It does not run the job.

## Context

Use it when a skill starts, polls, reads back, reads the journal of, or releases one tracked background job on one machine a router maps, installs a scheduled job, or classifies the JSON answer that call returned.

Do not use it to call the gateway, to reach a machine, or to write a file. It reads only the files it is given. A skill sends the `argv` it prints, unchanged, as one `vm.command.run`. The answer file is the JSON object the gateway's `execute` returned, unchanged.

Classifier seam: none.

## Quick Start

```bash
node scripts/vm-job.js help
```

Usage text, with nothing installed and nothing configured. The tool needs Node 18 or later, the same runtime the local gateway that reaches the `vm` connector already needs.

```bash
node scripts/vm-job.js start --purpose apt-install --limit 1800 --token none --script /path/to/job.sh -- install pkg=1.0
node scripts/vm-job.js start --purpose twenty-backup --limit 3600 --token none --script /path/to/job.sh --stop-post /opt/twenty/backup/recover --stop-post-timeout 1200
node scripts/vm-job.js scheduled --purpose twenty-backup --limit 3600 --script-path /opt/twenty/backup/job.sh --wrapper-path /opt/twenty/backup/wrapper --on-calendar '*-*-* 03:00:00' --stop-post /opt/twenty/backup/recover --stop-post-timeout 1200 -- dump
node scripts/vm-job.js poll --unit vm-job-apt-install-20261005t120000z-abcdef --wait 0
node scripts/vm-job.js readback --invocation 0123456789abcdef0123456789abcdef --lines 200
node scripts/vm-job.js journal --unit vm-job-apt-install-20261005t120000z-abcdef --lines 200
node scripts/vm-job.js release --unit vm-job-apt-install-20261005t120000z-abcdef --invocation 0123456789abcdef0123456789abcdef
node scripts/vm-job.js classify --step start --unit vm-job-apt-install-20261005t120000z-abcdef --answer /path/to/answer.json
node scripts/vm-job.js classify --step scheduled-record --answer /path/to/answer.json
```

One JSON object on stdout. Nothing is written. Anything else, see Troubleshooting.

## Usage

| Command | Purpose | Writes a file |
|---------|---------|---------------|
| `node scripts/vm-job.js help` | Print usage and exit | No |
| `node scripts/vm-job.js start --purpose <purpose> --limit <seconds> --token <token> --script <file> [--stop-post <path> --stop-post-timeout <seconds>] [-- <operand>...]` | Print `{ command, unit, argv }` for the starter | No |
| `node scripts/vm-job.js poll --unit <unit> --wait <seconds>` | Print `{ command, argv }` for one poll | No |
| `node scripts/vm-job.js readback --invocation <id> --lines <count>` | Print `{ command, argv }` for one read-back by invocation ID | No |
| `node scripts/vm-job.js journal --unit <unit> --lines <count>` | Print `{ command, argv }` for one journal read by unit | No |
| `node scripts/vm-job.js release --unit <unit> --invocation <id>` | Print `{ command, argv }` for the release script | No |
| `node scripts/vm-job.js scheduled --purpose <purpose> --limit <seconds> --script-path <path> --wrapper-path <path> --on-calendar <spec> [--stop-post <path> --stop-post-timeout <seconds>] [-- <operand>...]` | Print the wrapper, the service, the timer, their sha256, and the writers that install them | No |
| `node scripts/vm-job.js classify --step <step> --answer <file> [--unit <unit>] [--recorded <id>]` | Print the class of one saved answer | No |

`start` options:

| Option | Effect | Default |
|--------|--------|---------|
| `--purpose <purpose>` | Lowercase letters, digits, and single hyphens: `^[a-z0-9]+(-[a-z0-9]+)*$` | None; required |
| `--limit <seconds>` | A whole number from 1 to 86400, written in digits | None; required |
| `--token <token>` | `none`, or a lowercase UUID | None; required |
| `--script <file>` | The job script. Absolute path. UTF-8, at most 4096 code points, no NUL, first line exactly `set -eu` | None; required |
| `--stop-post <path>` | Absolute path of the stop-post script on the machine. Only with `--stop-post-timeout` | Omitted |
| `--stop-post-timeout <seconds>` | A whole number from 30 to 3600, written in digits. Only with `--stop-post` | Omitted |
| `-- <operand>` | Each operand, after `--`. At most 56, or 51 when `--stop-post` is set. Empty is allowed. A leading dash is allowed. Without `--`, a dash is a flag | None |
| `--help`, `-h` | Print usage and exit | Off |

`poll` options:

| Option | Effect | Default |
|--------|--------|---------|
| `--unit <unit>` | The unit name `start` printed | None; required |
| `--wait <seconds>` | A whole number from 0 to 10, written in digits | None; required |
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

`scheduled` options:

| Option | Effect | Default |
|--------|--------|---------|
| `--purpose <purpose>` | Lowercase letters, digits, and single hyphens: `^[a-z0-9]+(-[a-z0-9]+)*$`. The resulting unit name must fit in 120 characters | None; required |
| `--limit <seconds>` | A whole number from 1 to 86400, written in digits | None; required |
| `--script-path <path>` | Absolute path where the skill installs the job script on the machine. The wrapper reads that file at each firing. The script is not embedded | None; required |
| `--wrapper-path <path>` | Absolute path where the skill installs the wrapper. The service runs it | None; required |
| `--on-calendar <spec>` | A systemd calendar expression, checked by pattern only: `^[A-Za-z0-9*:,./ -]{1,64}$`. The skill's re-inspection proves systemd accepted it | None; required |
| `--stop-post <path>` | Absolute path of the stop-post script on the machine. Only with `--stop-post-timeout` | Omitted |
| `--stop-post-timeout <seconds>` | A whole number from 30 to 3600, written in digits. Only with `--stop-post` | Omitted |
| `-- <operand>` | Each operand, after `--`. At most 56. Passed to the job on each firing. Empty is allowed. A leading dash is allowed | None |
| `--help`, `-h` | Print usage and exit | Off |

`--script-path`, `--wrapper-path` and `--stop-post` match `^/[A-Za-z0-9._/-]{1,200}$`, with no `..` segment and no `//`. The tool does not open a machine path. It checks the pattern.

`classify` options:

| Option | Effect | Default |
|--------|--------|---------|
| `--step <step>` | `start`, `poll`, `readback`, `journal`, `release`, or `scheduled-record` | None; required |
| `--answer <file>` | The gateway answer, one JSON object. Absolute path | None; required |
| `--unit <unit>` | Required when `--step` is `start`. Refused on the other steps | None |
| `--recorded <id>` | Optional when `--step` is `poll`: the invocation ID already recorded. Refused on the other steps | Omitted |
| `--help`, `-h` | Print usage and exit | Off |

No command takes `--env`. This tool installs nothing, and `--install` is refused by name like any other unknown flag. An unknown flag is refused by name before any file is read, including when it sits beside `help`. `--flag=value` is an unknown option. A repeated flag is refused. A flag that needs a value, given none or given a value that starts with `-`, is refused. An argument that belongs to no flag is refused. `--` ends flags on `start` and on `scheduled`. On the other commands it is an unexpected argument. An unknown command is refused by name.

A whole number is written in digits with no sign and no leading zero, except `0` itself. `01`, `+1`, and `1.0` are refused. The digit string is passed through into `argv` unchanged.

A unit name matches `^vm-job-[a-z0-9]+(-[a-z0-9]+)*-[0-9]{8}t[0-9]{6}z-[0-9a-f]{6}$` and is at most 120 characters. `start` builds `vm-job-<purpose>-<yyyymmddthhmmssz>-<six lowercase hex>`. The stamp is the current UTC time to the second. The six hex characters are fresh from `node:crypto` on every run, so a name is never used twice. A purpose that would make the name longer than 120 characters is refused.

`--token` is `none` or a lowercase UUID, `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. An uppercase UUID is refused. `--invocation` and `--recorded` are 32 lowercase hex characters.

Every path is absolute. A relative path is refused by name. The screen is the one `wiser/standards/script-contract.md` requires, and the resolved path is the one opened. `--script` and `--answer` must be files. A missing path, or the wrong kind, is refused by name. There is no credential file to refuse, because no command takes `--env`, and there is no destination to refuse, because nothing is written. A source that happens to sit inside this tool directory is read; the tool still writes nothing there.

The job script is counted in code points. A file of 4096 code points is accepted when one of them is above the basic multilingual plane. The first line is the text before the first newline, and it must be exactly `set -eu`. A carriage return on that line does not match. A file that is only `set -eu`, with no newline, does. A byte-order mark is kept as text, not removed, so a file that begins with one fails the first-line check rather than reaching `argv` changed.

`argv` for `start` without `--stop-post` is `/bin/sh`, `-c`, the starter, `sh`, the unit, the limit, the token, the script's text, then each operand. That prefix is 8 strings, and it is the argv 0.2.0 prints for the same inputs. The connector bounds one `argv` at 64 strings, so that form admits at most 56 operands.

With `--stop-post` and `--stop-post-timeout`, both required together, the prefix is 13 strings: `/bin/sh`, `-c`, the stop-post driver, `sh`, `-p`, `ExecStopPost=/bin/sh <path>`, `-p`, `TimeoutStopSec=<seconds>`, the starter, then the unit, the limit, the token, the script's text, and the operands. That form admits at most 51 operands. The two properties are operands of the driver. They are not spliced into the starter, so the starter stays the one shipped file. One more operand is refused by name.

`scheduled` admits at most 56 operands, the same cap as a plain `start`, whether or not `--stop-post` is set. Each operand is at most 4096 code points. Those caps stand. The wrapper those operands produce may be longer than 4096 code points. Each writer script is at most 4096 code points, and one line that cannot fit in a writer is refused by name.

## The job

A job is a transient systemd service on the target machine, started, polled, read back and released through `vm.command.run`, each call inside the router's limit. It belongs to PID 1, not to the call that started it. One job is loaded per machine at a time.

The outcome names are the ones `connectors/vm/CONNECTOR.md` in `wiser` publishes. A gateway status is `status`. A router result is `outcome`.

**Its name** is `vm-job-<purpose>-<yyyymmddthhmmssz>-<six lowercase hex characters>`, the purpose in lowercase letters, digits and hyphens, the stamp in UTC to the second, the six characters chosen afresh for each run. It matches the unit pattern `connectors/vm/CONNECTOR.md` in `wiser` publishes. **A name is never used twice**, loaded or not, so a later read of that name cannot meet another run.

**The lock** is `flock` on `/run/lock/vm-job.lock`, held by the starter and by release for the length of one call, never across calls. It is writable from inside the router's sandbox.

**The generation token** is `/run/vm-job.token`, a fresh random UUID written under the lock by every start and every release. **The inspection a job's plan rests on reads it in the same call as the rest of that inspection**, printing the file's text, or `none` when there is no file, which is what the starter reads too, and the starter refuses unless the token is still that value. So a plan made before another job started, or while one ran, or before one was released, never starts. `/run` is cleared at a reboot, after which the token reads `none` until the next start. **It sees jobs only**: a change made any other way, by hand or by a direct `vm.command.run`, does not renew it, which is why a skill that runs its changes as jobs should run all of them that way.

**Starting it** is one `vm.command.run` whose `argv` is the array `start` prints. Without `--stop-post` that is `/bin/sh`, `-c`, the starter below, `sh`, the unit name, the limit in seconds, the token the inspection read, the job's script, and then any operands the job takes, which reach the job's script as `$1` onward. With `--stop-post` the same starter is an operand of the stop-post driver, after `-p`, `ExecStopPost=/bin/sh <path>`, `-p` and `TimeoutStopSec=<seconds>`. The script and its operands are never spliced into the starter's text, so a package name stays an operand all the way to the command that uses it.

**Polling it** is one `vm.command.run` whose `argv` is the array `poll` prints. The wait is at most 10 seconds, which leaves the call headroom inside the Wiser endpoint's bound of 20 seconds without guaranteeing it: an SSH connection slower than usual can still carry a poll past it. That poll is `not-read`, and the next poll reads again. A call that outlasts that bound answers `status` `uncertain`, and the endpoint does not retry it. The router's own limit of 60 seconds is the looser bound.

**Reading it back** is one `vm.command.run` whose `argv` is the array `readback` prints. It reads by the recorded invocation ID, not by the name's current one. A `truncated` answer is read again with fewer lines; the report says how many it shows. **The journal outlives release**, so the read-back can come before or after it.

**Reading the journal by unit** is one `vm.command.run` whose `argv` is the array `journal` prints. The poll class `not-loaded` is the row that asks for it.

**Releasing it** is one `vm.command.run` whose `argv` is the array `release` prints, with the unit and the recorded ID, after a poll that read the job finished. Under `ExitType=cgroup`, `active/exited` means every process has ended, so the stop kills nothing. Stopping a running job is a cancel, a change of its own, and not release.

**A second run that finds a job loaded** does not start another, and does not carry on with what it planned before it looked. A running job is reported as running, and the run stops. A finished one is an earlier run's result: it is polled once at wait 0, classified with no `--recorded`, and the invocation ID that poll reads is the one adopted. It is read back and released with that ID, and reported as that run's. **This run then starts over from its own inspection and gate**, which the renewed token enforces: its old token is refused. That start-over happens at most once. A loaded unit carrying this run's own name is this run's, after a start whose answer was lost: poll it.

**What a job's script must be.** It begins `set -eu`. Every step runs in the foreground: no `&`, no daemonizing. The script's exit status is the last command's, so a step whose failure matters is not followed by one that can succeed regardless. Apt changes carry the skill's own pins, `--no-remove` and keep-old-config options, and the starter sets `DEBIAN_FRONTEND=noninteractive` and `NEEDRESTART_SUSPEND=1`. A job has no home directory; a tool that wants one, `gpg` among them, gets a temporary one. On the router host a job runs outside the router's sandbox, which is why it can install a package there, and also why every path rule the skill applies to a direct call applies to a job unchanged.

**Stop-post.** The started unit is `Type=exec` with `RemainAfterExit=yes`. A unit whose main process exits 0 stays `active/exited`, and `ExecStopPost` runs when release stops it. A unit whose process fails, or is killed at `RuntimeMaxSec`, runs `ExecStopPost` as it deactivates. The driver does not edit the starter. It puts a short-lived `systemd-run` ahead of the real one on `PATH` that prepends `-p ExecStopPost=/bin/sh <path>` and `-p TimeoutStopSec=<seconds>` and execs the real `systemd-run`. `systemd-run` takes `-p` anywhere before the command. The directory is allocated with `mktemp -d /run/vm-job-stop.XXXXXX`, and that directory is the only one removed. The shim is written there and made mode 700. Before anything is started, the driver probes the shim by its absolute path, `"$d/systemd-run" --version`. When that probe cannot execute, the directory is removed, the driver prints `stop-post-setup-failed`, and nothing is started. A `noexec` mount fails that probe, which is what makes the setup fail closed: the driver does not search `PATH` for another `systemd-run`. `EXIT` removes the directory `mktemp` returned. `TERM`, `HUP` and `INT` exit 143 so that removal runs. Without the two flags, the starter's argv is unchanged and no shim is installed.

**Cancelling it.** Under systemd, a job killed by a clean signal (`TERM`, `INT`, `HUP`, `PIPE`) that leaves no process can end `active/exited`. That looks like success, and its `ExecStopPost` waits until release stops the unit. A job script whose stop-post must run on a signal traps `TERM`, `INT`, `HUP` and `PIPE` and exits nonzero, so systemd records a failure and runs `ExecStopPost` as the unit deactivates. A job is cancelled with `systemctl stop <unit>`, which runs `ExecStopPost`. It is not cancelled with `systemctl kill`. The poll class `signal` is unchanged: `active/exited` with `ExecMainCode` other than `1` is still a signal, and it is still finished.

**A scheduled firing** is not a command the tool runs. `scheduled` prints three texts and the writers that install them: a wrapper, a service unit and a timer unit. The JSON is `{ command, purpose, serviceName, timerName, wrapper, service, timer, sha256, writers }`. `sha256` is `{ wrapper, service, timer }`, the hex sha256 of each text. `writers` is an ordered list of argv arrays, each `/bin/sh`, `-c`, and one script. The service is `vmjob-scheduled-<purpose>.service`, `Type=oneshot`, `ExecStart=/bin/sh <wrapper-path>`. The timer is `vmjob-scheduled-<purpose>.timer`, `OnCalendar=<spec>`, `Persistent=true`, `RandomizedDelaySec=0`, and `Unit=` names that service. Those names are outside the starter's enumeration pattern `vm-job-*`. A name that began `vm-job-scheduled-` would match that glob, and `systemctl list-units --all` shows the oneshot as loaded whenever its timer exists, so the service would count as a loaded job and every firing would skip.

The wrapper is `/bin/sh` text. It may be longer than 4096 code points. It holds `flock -w 20` on `/run/lock/vm-job.lock` for the whole decision and releases the lock by exiting.

1. The lock is not taken within 20 seconds: it prints `scheduled:lock-busy` and exits 0.
2. It reads `/var/lib/vm-job/scheduled/<purpose>` when that file exists: the unit, the invocation, and the skip count, three lines. The word `none` in the unit line or the invocation line means there is no previous unit. The record never holds an empty line. No previous unit is written as `none`, `none`, and the skip count.
3. It enumerates loaded `vm-job-*` units with the starter's own `systemctl list-units` line.
4. When the recorded invocation is the word `pending`, exactly one `vm-job-*` unit is loaded, and that unit's name is the recorded unit, the wrapper reads that unit's `InvocationID` and uses it as the recorded id. The unit name is unique, stamp plus six hex characters, which is what makes that reconciliation safe. A loaded unit whose name differs is the skip in step 6.
5. When the list is exactly the recorded unit and the unit passes the release script's finished checks (`active/exited`, or `failed/''*)` with no tasks remaining), the wrapper stops it or reset-fails it by those same checks and renews the token. It does not run `release.sh`. That script would take the same lock a second time and block. The checks in the wrapper are a slice of `release.sh`, so the two cannot drift. After that slice exits 0, the wrapper waits until `LoadState` is `not-found` or 30 seconds have elapsed, whichever comes first. It records `date +%s` at the start and adds 30. Each read is `timeout` of the seconds still remaining, and never more than 5, around `systemctl show -p LoadState --value <unit>.service`. A read still running at that limit is abandoned. When time remains and the read was not `not-found`, it sleeps 1 second, unless less than a second remains. Only a read of `not-found` prints `scheduled:released:<unit>` and continues to step 7. If the 30 seconds pass without `not-found`, it prints `scheduled:release-incomplete:<unit>:<ActiveState>`, writes the record with the skip count plus one, and exits 0 without starting. If the slice exits nonzero, it prints `scheduled:release-refused:` and the slice's first output line, then takes the skip in step 6.
6. Any other loaded `vm-job-*` unit, or the recorded unit not released: it prints `scheduled:skipped:<unit list>`, writes the record back with the skip count plus one, and exits 0. The unit list is the loaded names, the `.service` suffix removed, joined with commas. A unit or invocation that is empty is written as the word `none`.
7. Otherwise it builds the unit name `vm-job-<purpose>-<stamp>-<6 hex>`, the stamp and the six hex characters made the way the tool makes them. When stop-post properties were given, it allocates the shim with `mktemp`, writes it, and probes `"$d/systemd-run" --version` by that absolute path. A probe that cannot execute prints `stop-post-setup-failed` and exits nonzero before a record write and before a start. It then writes the record as that new unit, the word `pending`, and the current skip count, and runs the starter's own text with the two lock lines left out because the wrapper already holds that lock. The expected token is the current token. The job script is the file at `--script-path`, read at that firing, so the script is not embedded. `$(cat)` drops trailing newlines from that file. Operands are the ones given to `scheduled` after `--`. On `start-exit:0` and a 32-hex invocation id, the wrapper rewrites the record with that id and skip count 0, by a temporary file and then `mv`. When the starter's output contains `start-exit:0` and the invocation id does not parse, it prints `scheduled:start-unparsed:<unit>` and the starter's output, and leaves the `pending` record for the next firing to reconcile. On any other starter result it prints the starter's output and leaves that `pending` record.
8. Exiting closes the lock. When a shim directory was allocated, `EXIT` removes it, and `TERM`, `HUP` and `INT` exit 143 so that removal runs.

A scheduled unit is an ordinary `vm-job-*` unit with `RemainAfterExit=yes`. Poll, read-back and release need no new class. A session that adopts a finished one uses the invocation id that poll reads. A session that adopted and released it first leaves the wrapper with nothing to release, and the firing starts. An unrelated loaded job is the skip in step 6. It is reported, and it is not forced.

## The scripts it emits

The starter, the release, and the stop-post driver below are the bytes `argv` carries, including the trailing newline. The poll command, the read-back command, and the journal command have no trailing newline. Do not reflow them. A skill does not write these scripts. It runs the command and sends the `argv`. The wrapper, the service and the timer are the exception: `scheduled` prints them, and it prints the writers that install them. A skill runs each writer, in order, as one `vm.command.run`.

Each file is split at line boundaries into chunks. Every writer script is at most 4096 code points, so no `argv` element exceeds that. The delimiter of each chunk's quoted heredoc is `VMJOB_EOF`. If that delimiter appears in a text, `scheduled` refuses by name. The first writer of a file removes `<path>.part` when that path is a regular file, then writes its chunk with `>`. When `<path>.part` exists as a symlink, a directory, or anything other than a regular file, that writer prints `writer:part-refused:<path>` and writes nothing. Each later writer prints `writer:part-refused:<path>` and writes nothing unless `<path>.part` is a regular file, then appends its chunk with `>>`. A writer whose call was uncertain or failed is never re-sent alone. The file's whole writer sequence is sent again from its first writer, once the earlier call has ended. The wrapper's path is `--wrapper-path`, mode 700. The service's path is `/etc/systemd/system/<serviceName>`, mode 644. The timer's path is `/etc/systemd/system/<timerName>`, mode 644. The last writer of each file checks `sha256sum` of the part against the sha256 in the JSON. A difference prints `writer:sha-mismatch:<path>` and exits 1. The wrapper's last writer also runs `sh -n` on the part. It then sets the mode and `root:root`. When the destination exists as a directory, the last writer prints `writer:destination-refused:<path>` and does not move the part. Otherwise it moves the part onto that exact path with `mv -T --` and prints `installed:<path>`. A single line that cannot fit in a writer is refused by name. The operand caps above are unchanged by that check.

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
  failed/''*) case "$tasks" in ''|'[not set]'|0) ;; *) echo "processes-remain:$tasks"; exit 17 ;; esac ;;
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

The stop-post driver, with its trailing newline, is `argv[2]` only when `start` was given `--stop-post`. It is `scripts/texts/stop-post.sh`. The shim line it installs is the same line the scheduled wrapper installs:

```
# Arm ExecStopPost for one starter run. p1, v1, p2 and v2 are the two
# systemd-run properties (-p and the value, twice). The starter text is not
# modified: a short-lived systemd-run prepends them and execs the real one.
# systemd-run takes -p anywhere before the command. mktemp allocates the
# directory, and that directory is the only one removed. EXIT removes it.
# TERM, HUP and INT exit 143 so that removal runs. The shim is probed by its
# absolute path before anything starts. If the probe cannot execute it,
# including on a noexec mount, the directory is removed, the driver prints
# stop-post-setup-failed, and nothing is started.
vm_job_arm_stop_post() {
  R=$(command -v systemd-run) || return 1
  A=$p1
  B=$v1
  C=$p2
  D=$v2
  export R A B C D
  old_umask=$(umask)
  umask 077
  d=$(mktemp -d /run/vm-job-stop.XXXXXX) || { umask "$old_umask"; return 1; }
  umask "$old_umask"
  cat > "$d/systemd-run" << 'SHIM' || { rm -rf "$d"; return 1; }
#!/bin/sh
exec "$R" "$A" "$B" "$C" "$D" "$@"
SHIM
  chmod 700 "$d/systemd-run" || { rm -rf "$d"; return 1; }
  VM_JOB_STOP_DIR=$d
  export VM_JOB_STOP_DIR
  trap 'vm_job_disarm_stop_post' EXIT
  trap 'exit 143' TERM HUP INT
  "$d/systemd-run" --version >/dev/null 2>&1 || { vm_job_disarm_stop_post; return 1; }
  PATH="$d:$PATH"
  export PATH
  return 0
}
vm_job_disarm_stop_post() {
  if [ -n "${VM_JOB_STOP_DIR-}" ]; then
    rm -rf "$VM_JOB_STOP_DIR"
    VM_JOB_STOP_DIR=
  fi
}
p1=$1
v1=$2
p2=$3
v2=$4
starter=$5
shift 5
vm_job_arm_stop_post || { echo stop-post-setup-failed; exit 1; }
/bin/sh -c "$starter" sh "$@"
rc=$?
exit "$rc"
```

## Classification

`classify` reads the answer file. A byte-order mark at its start is ignored, since the answer is JSON and not text the tool passes on. A missing file, a file that is not valid UTF-8, a file that contains a NUL, a file that is not JSON, or a JSON value that is not an object, is refused, exit 1. An array, `null`, a string, or a number is not an object. Otherwise `classify` exits 0 and the class is in the JSON, including `unknown` and `not-read`. Extra keys on the answer are ignored and are not listed. `exit_code` matches only as a number: the string `"10"` is not exit 10. `finished` is present only for step `poll`.

Take the first match in the step. A marker class needs its marker line and its exit code together. A code without its marker, or a marker without its code, is not that class.

On `start`, a non-empty `status` other than `vendor_error` and other than `uncertain` is `gateway-status` before any line is read, because a gateway stop is not a router result. `vendor_error` and `uncertain` are `unknown`, and their output is not read as a start. An `unknown` carries the answer's `action` when it is a string, because an `uncertain` can name an earlier call than this one. On `release`, any non-empty `status` is `unknown`, and its output is not read. On `poll`, the ten fields are read when `outcome` is `ok`, or `remote_failure` with a `machine`; any other outcome, a failure with no `machine`, or a gateway `status` is `not-read`. On `readback` and `journal`, an answer whose `outcome` is not `ok` is `not-read`, and `truncated` is its own class. A `needs_confirmation` answer is the caller's approval question. Classifying it does not say what the job did.

### start

Requires `--unit`, the unit this run's `start` printed. The started line has to name that unit.

| Class | Means | Caller does next |
|-------|-------|------------------|
| `gateway-status` | `status` is a non-empty string other than `vendor_error` and other than `uncertain`. Facts are `{ status }`. Not a router result | The caller's approval question when the status is `needs_confirmation`. Any other status is the caller's gateway handling. Do not poll it as a start |
| `unknown` from `vendor_error` or `uncertain` | `status` is `vendor_error` or `uncertain`. The output is not read. Facts carry `outcome`, `status` and `action` when those values are strings | Unknown whether it started. The `unknown` row below |
| `started` | The line `Running as unit: <unit>.service; invocation ID: <32 hex>` and the line `start-exit:0`. Facts are `invocationId`, and `token` from the first line that begins `token:` and does not begin `token-changed:`. No such line leaves `token` null | Record the invocation ID. Poll |
| `existing-job` | A line `existing-job` and `exit_code` 10. Facts `units` are the non-empty lines after that marker | Nothing was started. The second-run rule |
| `lock-busy` | A line `lock-busy` and `exit_code` 11 | Nothing was started. Start again later with the same token. A token that moved is `token-changed` |
| `enumeration-failed` | A line `enumeration-failed` and `exit_code` 12 | Nothing was started |
| `token-changed` | A line beginning `token-changed:` and `exit_code` 15. Facts `token` is the text after the colon | Nothing was started. The plan is stale. Inspect again and gate again before any start |
| `token-write-failed` | A line `token-write-failed` and `exit_code` 16 | Nothing was started. The token may have changed. Inspect again |
| `refused-before-submission` | A line `start-exit:1` and a line containing `Failed to find executable` or `already loaded or has a fragment file` | Nothing was started. The token was renewed. Inspect again |
| `unknown` | Any other answer: any other `start-exit`, `timeout`, `killed`, `request_timeout`, `connect_timeout`, `busy`, a failure with no `machine`, a `remote_failure` with no `start-exit:` line. Facts carry `outcome`, `status` and `action` when those values are strings, and otherwise `{}` | Unknown whether it started. `systemd-run` can fail after systemd has accepted the job. Poll by this run's name. A loaded class means it started, and the invocation ID that poll reads is the one to record. `not-loaded` is the history question. Never send the start again without a new inspection and a new approval |

### poll

`--recorded` is optional. The ten fields, in order, are `LoadState`, `ActiveState`, `SubState`, `Result`, `ExecMainCode`, `ExecMainStatus`, `InvocationID`, `TasksCurrent`, `ExecMainStartTimestamp`, `ExecMainExitTimestamp`. Facts carry all ten. A field that was absent is null. When the fields are not read, all ten are null, so a failed call does not claim a job state. A field that appears more than once is not chosen between: the class is `unrecognized`, and facts carry `repeated`, naming each such field. A repeated `InvocationID` is reported as null, and offers no `invocationId` to adopt. "No processes" means `TasksCurrent` is `[not set]`, empty, or `0`. An invocation ID is set when it is a non-empty string other than `[not set]`.

Without `--recorded`, facts also carry `invocationId`, the ID when it is set and null when it is not, for the caller to adopt. With `--recorded`, facts also carry `recorded`, that ID. `finished` is true for `succeeded`, `signal`, `failed-exit`, `failed-timeout`, and `failed-other`. It is false for every other poll class.

| Class | Means | Caller does next |
|-------|-------|------------------|
| `not-read` | `outcome` is neither `ok` nor `remote_failure` with a `machine`, or a gateway `status` came back, or any of the ten fields is missing. Says nothing about the job | Poll again |
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
| `unrecognized` | The ten fields were read and no row above matched, or a field appeared more than once, with facts `repeated` naming it. A normal exit with `ExecMainCode` `1` and `ExecMainStatus` other than `0` lands here | Name the fields. Do not treat it as finished |

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
| `unknown` | Any other answer. Facts carry `outcome`, `status` and `action` when those values are strings | Name it. Do not treat it as released |

### scheduled-record

Requires no `--unit` and no `--recorded`. The answer's output is the record file, three lines, or the line `none`. A non-empty `status`, or an `outcome` other than `ok`, is `not-read` before the lines are read. `finished` is absent. The word `none` is a record the wrapper writes when there was no previous unit. The single line `none` is a read that found no record file.

| Class | Means | Caller does next |
|-------|-------|------------------|
| `recorded` | Three lines. The unit matches the unit pattern and is at most 120 characters. The invocation id is 32 lowercase hex characters. The skip count is a whole number, `0` or digits without a leading zero, and it is a safe integer. Facts are `{ unit, invocationId, skips }`, and `skips` is a number | The status read. `skips` above zero is the starvation case |
| `skips-only` | Three lines: `none`, `none`, and a skip count under the same whole-number rule. Facts are `{ skips }` | No previous scheduled unit. `skips` is the starvation count, including a first skip |
| `pending` | Three lines. The unit matches the unit pattern and is at most 120 characters. The invocation line is the word `pending`. The skip count is the same whole number. Facts are `{ unit, skips }` | A launch was recorded and its invocation id is not in the record yet. The next firing reconciles that unit when it is the one loaded unit |
| `none` | The only line is `none`. Facts are `{}` | No scheduled record |
| `not-read` | A gateway `status`, an `outcome` other than `ok`, or output that is none of the rows above. Facts are `{}` | Says nothing about the record. Read it again |

## Script Contract

Every script in this tool follows `wiser/standards/script-contract.md`. What a user meets when running it is `wiser/tools/RUNNING.md`. Node 18 or later covers the whole tool, the same runtime the local gateway that reaches the `vm` connector already needs. Node built-ins cover it, so the contract's dependency-install, `--env`, and system-dependency clauses have nothing to bind here and the tool carries no Dependencies section. No command checks for a package or runs an install. No command takes `--env`, and `--install` is refused by name. Nothing is written, anywhere. The sections above state what each command does; the contract states how the script behaves getting there.

## Output

`help` prints usage text to stdout and exits 0.

`start` prints one JSON object, exit 0:

| Field | Carries |
|-------|---------|
| `command` | `start` |
| `unit` | The unit name built for this run |
| `argv` | Without `--stop-post`: `/bin/sh`, `-c`, the starter, `sh`, the unit, the limit, the token, the script text, then each operand. With `--stop-post`: `/bin/sh`, `-c`, the stop-post driver, `sh`, `-p`, `ExecStopPost=/bin/sh <path>`, `-p`, `TimeoutStopSec=<seconds>`, the starter, then the unit, the limit, the token, the script text, and each operand |

`poll`, `readback`, `journal`, and `release` print one JSON object, exit 0:

| Field | Carries |
|-------|---------|
| `command` | `poll`, `readback`, `journal`, or `release` |
| `argv` | `/bin/sh`, `-c`, that command's script, `sh`, then the command's own strings, in the order the command takes them |

`scheduled` prints one JSON object, exit 0:

| Field | Carries |
|-------|---------|
| `command` | `scheduled` |
| `purpose` | The `--purpose` value |
| `serviceName` | `vmjob-scheduled-<purpose>.service` |
| `timerName` | `vmjob-scheduled-<purpose>.timer` |
| `wrapper` | The wrapper text, including its trailing newline. It may be longer than 4096 code points |
| `service` | The service unit text, including its trailing newline |
| `timer` | The timer unit text, including its trailing newline |
| `sha256` | `{ wrapper, service, timer }`, the hex sha256 of each text |
| `writers` | An ordered list of argv arrays, each `/bin/sh`, `-c`, and one script of at most 4096 code points. Run them in order. A writer whose call was uncertain or failed is never re-sent alone: that file is sent again from its first writer, once the earlier call has ended. The last writer checks the sha256, sets the mode and `root:root`, moves the part with `mv -T --`, and prints `installed:<path>` |

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
| `operands is more than 56` or `more than 51` | `argv` holds at most 64 strings. The plain starter prefix is 8, so 56 operands. The stop-post prefix is 13, so 51 operands. `scheduled` admits 56 |
| `contains a NUL` or `is not valid UTF-8` | The script or the answer is not the text this tool reads |
| `the script is` and `code points` | Shorten the script to 4096 code points or fewer |
| `first line must be exactly "set -eu"` | Make that the first line, with no trailing carriage return |
| `operand` and `code points` | Shorten that operand to 4096 code points or fewer |
| `a wrapper writer is` and `code points` | One line of the install text cannot fit in a writer of 4096 code points. Shorten that operand. The 56 and 51 operand caps are unchanged |
| `writer:part-refused:<path>` | `<path>.part` is a symlink, a directory, or not a regular file, or a later writer found no regular part. Send that file's writers again from the first, once the earlier call has ended |
| `writer:destination-refused:<path>` | The destination is a directory. The part was not moved |
| `contains the writer delimiter` | The text contains `VMJOB_EOF`. Change the operand that carries it |
| `--step must be` | Pass `start`, `poll`, `readback`, `journal`, `release`, or `scheduled-record` |
| `--stop-post and --stop-post-timeout are required together` | Pass both, or pass neither |
| `must not contain a ".." segment` or `must not contain "//"` | The machine path has a `..` segment or a `//`. Pass a single absolute path |
| `--on-calendar must match` | Use letters, digits, and `* : , . / -` and space, at most 64 characters. The skill's re-inspection is what proves systemd accepted it |
| `stop-post-setup-failed` | The shim directory could not be allocated, the shim could not be written, or the absolute-path probe could not execute it. Nothing was started |
| `--unit is required for step start` | Pass `--unit` when classifying a start |
| `--unit applies to step start` | Drop `--unit`, or pass `--step start` |
| `--recorded applies to step poll` | Drop `--recorded`, or pass `--step poll` |
| `is not JSON` or `must be one JSON object` | Save the gateway object unchanged. An array, a string, a number, or `null` is refused |
| `class` is `unknown` or `not-read` and the process exited 0 | That is a successful classification. Read `class` and `facts`. Exit 1 means the file was not classified |

## Success

- `node scripts/vm-job.js help` exits 0 and names every flag, including `--install` and `--env`.
- `start`, `poll`, `readback`, `journal`, and `release` each exit 0 with one JSON object, and `argv[2]` is that command's script. A `start` without `--stop-post` prints the same argv 0.2.0 prints for the same inputs. A `start` with `--stop-post` carries both properties as operands and the unchanged starter.
- `scheduled` exits 0 with one JSON object whose `wrapper`, `service` and `timer` are the texts to install, whose `sha256` names those bytes, and whose `writers` install them. Each writer script is at most 4096 code points. A writer whose call was uncertain or failed is sent again only as part of that file's sequence from its first writer. The service name does not match `vm-job-*`. A plain `start` still admits 56 operands, and a `start` with `--stop-post` still admits 51.
- Two `start` runs print different unit names.
- `classify` exits 0 with one JSON object for every class, `unknown` and `not-read` included, and `finished` is present only for `poll`.
- A bad flag, a bad path, a bad script, a bad operand, or an answer that is not one JSON object exits 1 with stdout empty, and the message names the cause.
- Nothing is written, and no command contacts a gateway or a machine.
