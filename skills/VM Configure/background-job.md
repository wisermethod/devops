# Background job

A job is a transient systemd service on the target machine, started, polled, read back and released through `vm.command.run`, each call inside the router's limit. It belongs to PID 1, not to the call that started it. One job is loaded per machine at a time.

The outcome names below are the ones `connectors/vm/CONNECTOR.md` in `wiser` publishes. A gateway status is `status`. A router result is `outcome`.

**Its name** is `vm-job-<purpose>-<yyyymmddthhmmssz>-<six lowercase hex characters>`, the purpose in lowercase letters, digits and hyphens, the stamp in UTC to the second, the six characters chosen afresh for each run. It matches the unit pattern `connectors/vm/CONNECTOR.md` in `wiser` publishes. **A name is never used twice**, loaded or not, so a later read of that name cannot meet another run.

**The lock** is `flock` on `/run/lock/vm-job.lock`, held by the starter and by release for the length of one call, never across calls. It is writable from inside the router's sandbox.

**The generation token** is `/run/vm-job.token`, a fresh random UUID written under the lock by every start and every release. **The inspection a job's plan rests on reads it in the same call as the rest of that inspection**, printing the file's text, or `none` when there is no file, which is what the starter reads too, and the starter refuses unless the token is still that value. So a plan made before another job started, or while one ran, or before one was released, never starts. `/run` is cleared at a reboot, after which the token reads `none` until the next start. **It sees jobs only**: a change made any other way, by hand or by a direct `vm.command.run`, does not renew it, which is why a skill that runs its changes as jobs should run all of them that way.

**Starting it** is one `vm.command.run` whose `argv` is `/bin/sh`, `-c`, the starter below, `sh`, the unit name, the limit in seconds, the token the inspection read, the job's script, and then any operands the job takes, which reach the job's script as `$1` onward. The script and its operands are never spliced into the starter's text, so a package name stays an operand all the way to the command that uses it.

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

| The start call answers | Means |
|------------------------|-------|
| `Running as unit: <unit>.service; invocation ID: <id>` and `start-exit:0` | Started. **Record the invocation ID**; every later call is about that ID |
| `existing-job` and a list, exit 10 | A job is already loaded. Nothing was started. The second-run rule below |
| `lock-busy`, exit 11 | Another start or release held the lock for 20 s. Nothing was started. Start again later with the same token; a token that moved meanwhile is refused at exit 15 |
| `enumeration-failed`, exit 12 | The guard could not list units. Nothing was started |
| `token-changed:<token>`, exit 15 | A job started or was released since the inspection. Nothing was started. **The plan is stale**: inspect again and gate again before any start |
| `token-write-failed`, exit 16 | Nothing was started; the token may have changed. Inspect again |
| `start-exit:1` and the line is `Failed to find executable` or `already loaded or has a fragment file` | Refused before anything was submitted. Nothing was started; the token was renewed, so inspect again |
| Any other nonzero `start-exit`, or `timeout`, `killed`, `request_timeout`, `vendor_error`, `busy`, or a failure with no `machine` | **Unknown whether it started**: `systemd-run` can fail after systemd has accepted the job. Poll by this run's name: loaded means it started, and its `InvocationID` is the one to record; `not-found` is the history question below. Never send the start again without a new inspection and a new approval |

**Polling it** is one `vm.command.run`: `/bin/sh -c 'sleep "$2"; systemctl show -p LoadState,ActiveState,SubState,Result,ExecMainCode,ExecMainStatus,InvocationID,TasksCurrent,ExecMainStartTimestamp,ExecMainExitTimestamp "$1.service"' sh <unit> <wait>`, the wait at most 40 s so the whole call stays well inside the router's 60 s. Take the first row that matches. "No processes" means `TasksCurrent` is `[not set]`, empty or `0`.

| The poll reads | The job is |
|----------------|------------|
| The call came back `timeout`, `busy`, `vendor_error`, `truncated`, or a failure with no `machine`, or any of the ten fields is missing | Not read. Says nothing about the job. Poll again |
| `InvocationID` is set and differs from the recorded one | Not this run's. Stop; change nothing; report both IDs. A first poll with nothing yet recorded, such as a second run's poll of a job it found, records the ID it reads instead |
| `activating`, or `active` and `running` | Still running. Poll again |
| `deactivating`, any `SubState` | Being stopped, by its limit or by someone else. Not finished, whatever `Result` reads. Poll again |
| `active`, `exited`, `ExecMainCode=1`, `ExecMainStatus=0` | Finished, exit 0, every process in it ended. The job succeeded. **The change is not yet known to have succeeded**: the skill's own re-inspection decides that |
| `active`, `exited`, `ExecMainCode` other than 1 | Killed by signal `ExecMainStatus`, which systemd counted clean. Failed |
| `failed` and processes remain | **Stuck**: systemd gave up and processes are still in the job, typically blocked in the kernel. Not finished. Stop; change nothing; release refuses it; it is the person's, over the provider's console |
| `failed`, `Result=exit-code`, no processes | Failed with exit `ExecMainStatus` |
| `failed`, `Result=timeout`, no processes | A limit stopped it; its journal says which (`Service reached runtime time limit` is the job's own). The work may be partial; for apt, the re-inspection's `dpkg --audit` decides what was left |
| `failed`, any other `Result`, no processes | Failed; name the `Result` verbatim |
| `LoadState=not-found`, or `inactive` | Not loaded: released, stopped by someone, never started, or the machine rebooted. Read `journalctl -u <unit>`. Entries are what it shows. **No entries is execution history unknown**, never proof it did not run: a journal can be volatile or vacuumed. Either way the skill re-inspects and never repeats a change on this alone |

**Reading it back** is one `vm.command.run`: `/bin/sh -c 'journalctl --no-pager -o short-iso -n "$2" _SYSTEMD_INVOCATION_ID="$1" + INVOCATION_ID="$1"' sh <recorded invocation ID> <lines>`. It reads by the recorded ID, not the name's current one. A `truncated` answer is read again with fewer lines; the report says how many it shows. **The journal outlives release**, so the read-back can come before or after it.

**Releasing it** is one `vm.command.run` with the unit and the recorded ID, after a poll that read it finished:

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

`release-exit:0` with `load-state:not-found` is released, and the token renewed. Exit 11, 13, 14 or 17 released nothing and left the token alone. Under `ExitType=cgroup`, `active/exited` means every process has ended, so the stop kills nothing. Stopping a running job is a cancel, a change of its own, and not release.

**A second run that finds a job loaded** does not start another, and does not carry on with what it planned before it looked. A running job is reported as running, and the run stops. A finished one is an earlier run's result: it is polled, read back and released, with the ID that poll reads, and reported as that run's. **This run then starts over from its own inspection and gate**, which the renewed token enforces: its old token is refused. A loaded unit carrying this run's own name is this run's, after a start whose answer was lost: poll it.

**What a job's script must be.** It begins `set -eu`. Every step runs in the foreground: no `&`, no daemonizing. The script's exit status is the last command's, so a step whose failure matters is not followed by one that can succeed regardless. Apt changes carry the skill's own pins, `--no-remove` and keep-old-config options, and the starter sets `DEBIAN_FRONTEND=noninteractive` and `NEEDRESTART_SUSPEND=1`. A job has no home directory; a tool that wants one, `gpg` among them, gets a temporary one. On the router host a job runs outside the router's sandbox, which is why it can install a package there, and also why every path rule the skill applies to a direct call applies to a job unchanged.
