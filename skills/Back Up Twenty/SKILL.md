---
name: Back Up Twenty
type: skill
category: operations
description: Set up scheduled, age-encrypted backups of an install Deploy Twenty made to a Cloudflare R2 bucket, back one up now, check the key's recovery copy, recover after an interrupted backup, stop scheduled backups, or restore a backup onto an install made for a restore, and report what was done.
version: 0.1.1
gaps:
  - authenticating a set's origin, and object lock
  - alerting on an overdue backup
  - Redis's queued and delayed work
  - incremental backups
  - deleting sets by hand
  - making a restored install public (routes, custom domains)
  - serving a restored workspace's custom domain from another install
  - a release other than v2.45.6
  - creating the buckets and the tokens, which is the person's with the vendor
  - scheduled backups of a second install on the same machine
  - a backup or restore whose archive the machine's available memory cannot hold, since the helper holds it whole
---

# Back Up Twenty

## Context

Use when an install Deploy Twenty made should get scheduled age-encrypted backups to a Cloudflare R2 bucket, or one backup should be taken now, or the age key's recovery copy should be checked, or an interrupted backup should be recovered, or scheduled backups should be stopped, or a backup should be restored onto an install made for a restore, and the machine is one a person's router maps. One run is one machine and one install. The release is Twenty v2.45.6 and no other.

Not for authenticating a set's origin, and not for object lock. That is missing. Not for alerting on an overdue backup. That is missing. Not for Redis's queued and delayed work. That is missing. Not for incremental backups. That is missing. Not for deleting sets by hand. That is missing. Not for making a restored install public, its routes and its custom domains. That is missing. Not for serving a restored workspace's custom domain from another install. That is missing. Not for a release other than v2.45.6. That is missing. Not for creating the buckets and the tokens. That is missing: creating the buckets and the tokens, which is the person's with the vendor.

Not for a package. Hand that part to `skills/VM Configure/`. `age` absent is that hand-off, package name `age`, and this skill writes nothing until a later run sees `age` present. Not for a hostname, a DNS record, or a zone. Hand that part to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. Not for an install, a route, or a removal, and not for taking an install offline or bringing it back online. Hand that part to `skills/Deploy Twenty/`. Not for enrolling a machine or taking one out, which is `skills/Prepare VM/`. Not for enabling or disabling a unit that is not this skill's timer. `skills/VM Configure/` does not enable or disable a unit, and that gap is its own. This skill enables and disables only `vmjob-scheduled-twenty-backup.timer`.

It acts only on an install whose marker is Deploy Twenty's. The lines Deploy Twenty's Job 2 marker question requires are the whole lines `skill=deploy-twenty`, `release=v2.45.6`, `compose-sha256=bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d`, and `project=` followed by the install name, and `stat:` was read. A whole line `stage=created` or `stage=files-written` may be present. It does not replace a required line.

The calls are `vm.inventory.list_hosts`, `vm.inventory.health`, and `vm.command.run`, and no other action. This skill never calls `vm.files.write_file` or `vm.files.read_file`. Every long step is a `vm-job` job started with `--stop-post`, except Job 4, which is one direct call for the reason that job names. The contract is `tools/vm-job/` 0.3.2: `start` takes `--stop-post` and `--stop-post-timeout` together, and `scheduled` prints the wrapper, the service, the timer, and the writers that install them. A tool answer that is not the JSON those commands print, a named refusal of either flag included, stops the run. Send no job. Do not start a job on a tool that does not print those flags.

What the router does with a command is Deploy Twenty's (`skills/Deploy Twenty/`). The job script, each direct script, and each saved answer go in a temporary directory outside the plugin and outside any repository. The path passed to the tool is absolute. The tool writes nothing. Reaching the gateway is `skills/Set Up Connectors/` and `gateway/SETUP.md` in `wiser`. Connecting a module is `skills/Connect Account/` in `wiser`. The toolkit registration is `connectors/vm/auth.md` in `wiser`. Cite those files. Do not restate them.

`vm.command.run` runs the argument vector as root. Every call, a read included, is `confirmation: always`. The approval question is Deploy Twenty's (`skills/Deploy Twenty/`). No secret value is asked for in the conversation, printed, placed in an operand, or written into a file in a repository. `backup.env`, `.env`, and the age identity are never `cat`ed by any call. A value the person types goes only into a helper on the machine, over the shell they hold. The report prints lengths, booleans, counts, statuses, the source id, the recipient's sha256, and the set's stamp. It does not print a credential or the identity.

A backup set is `<source-id>/<stamp>-<6 hex>/backup.tar.age`, then `COMPLETE` beside it. `<source-id>` is 32 hex characters made once and kept at `/opt/<install>/backup/source-id`. `COMPLETE` holds `source-id`, `stamp`, `size`, `sha256`, `format=1`, `recipient`, `server-url`, and `files-bucket`, the source install's files bucket, which a restore refuses to write into. Creation lists that source id and stops if the new prefix is already there. The archive holds `db.dump` (`pg_dump -Fc`), `counts.txt`, `state.txt`, `config-db.txt`, `local.tgz`, `files/` and `files.list`, `secrets.env`, and `SHA256SUMS`. `SHA256SUMS` covers those named files. `files.list` holds each object's key, size, and sha256. A directory is not a `sha256sum` argument. The archive is uploaded with its `Content-MD5`, so the bucket refuses bytes that differ from the file, and `COMPLETE` is written only after the bucket's size and ETag for the archive equal the file's size and MD5.

The inputs are staged in a mode-700 work directory under `/opt/<install>/backup/work/`, then streamed, `tar -cf - -C` the work directory `.` piped to `age -r` the recipient `-o` the ciphertext beside that directory, so no plaintext tar is written. Each side's exit status is written by a subshell to a status file, because `dash` has no `pipefail`, and either side failing fails the stage. The inputs are removed once the ciphertext is written and checked. Only the ciphertext leaves the machine. The work directory is removed whatever the outcome. Without the person's identity, nobody holding the bucket's key can read the records, the files, or the keys. Age does not authenticate who made a set. Authenticating a set's origin, and object lock, are missing. A restore shows the set's source id, stamp, and `SERVER_URL`, and the person confirms them. That confirmation is Job 3's.

Redis is not carried. Twenty's compose gives Redis no volume, so queued and delayed work never survives the container being recreated. That is missing. The server re-registers its cron jobs at start. Job 3 checks that it did. A reboot needs no script: `restart: always` restarts the containers when Docker starts. Job 6 still reads the state afterwards and records it.

`secrets.env` is `ENCRYPTION_KEY` and `FALLBACK_ENCRYPTION_KEY`, the latter possibly empty, so a set taken mid-rotation still holds the previous key. The restore parses it as exactly two validated `KEY=value` lines and never sources it. That parse is Job 3's. `config-db.txt` is the names, never the values, of every `core."keyValuePair"` row of type `CONFIG_VARIABLE` with no user and no workspace, read after `server` and `worker` stop. The backup refuses when any name is a variable Deploy Twenty sets in `.env`: `SERVER_URL`, every name that begins `STORAGE_`, every name that begins `EMAIL_`, `EMAILING_DOMAIN_DRIVER`, every name that begins `RESEND_`, every name that begins `CLOUDFLARE_`, `IS_MULTIWORKSPACE_ENABLED`, `DEFAULT_SUBDOMAIN`, `ENCRYPTION_KEY`, and `FALLBACK_ENCRYPTION_KEY`. The refusal starts `server` and `worker` again before it exits.

The success path appends, in order: `begin`, `checks:ok`, `stopping`, `stopped`, `config-db:ok`, `dump:ok`, `local:ok`, `files:ok`, `archive:ok`, `encrypted:ok`, `uploaded:ok`, `complete:ok`, `starting`, `restart-verified`, `retention:ok`, `end`. Downtime is `stopping` to `restart-verified`. The report states the measured length, from the journal timestamps of those two lines. The text that counts is the text after the first `]: `.

The backup program traps `TERM`, `INT`, `HUP`, and `PIPE` and exits 143, so systemd records a failure and runs `ExecStopPost`. A job is cancelled with `systemctl stop` of the job's unit, which runs `ExecStopPost`, never with `systemctl kill`. `KILL` and the runtime limit already count as unclean. With `RemainAfterExit=yes`, a main process that exits 0 stays `active/exited`, and `ExecStopPost` runs when release stops the unit. A process that fails, or is killed at `RuntimeMaxSec`, runs `ExecStopPost` as the unit deactivates. The poll class `signal` stays the one `tools/vm-job/` already has.

`recover` is the `--stop-post` script. It runs whenever the unit stops, scheduled or manual. When the state shows `stopping` or `starting` with no `restart-verified` after that line, it appends `recovering`, starts `server` and `worker`, and waits until the server is healthy and the worker's status is `running`. Its deadline is 840 seconds, counted from before its first call. Every Docker call is bounded by `timeout 30`, so its last pass, its result and its cleanup end by about 1030 seconds, inside `--stop-post-timeout 1200`. It appends `recovered:ok` or `recovered:fail:deadline`. It always removes this install's containers labelled `backup-twenty=<install>` and the work directory. Only `restart-verified` ends the downtime, so a later stop runs the rule again, and a second `recovered:ok` is the same recovery, not a new backup. Job 6 applies that rule, a `recovered:fail` included.

The disk check runs before `stopping`, on the filesystem of the work directory. The need is `pg_database_size` plus the files bucket's listed bytes plus the local volume's bytes, that sum again for the ciphertext, plus 1073741824. Below it, the run appends `checks:refused:disk` and exits, and the app is never stopped. The memory check follows: `MemAvailable` in `/proc/meminfo` must reach that sum in KiB plus 262144 KiB, since the helper holds the archive whole to upload it. Below it, `checks:refused:memory`, and the app is never stopped. A restore applies the same rule to `COMPLETE`'s size before it downloads the archive.

Retention runs only after `restart-verified`. It lists only `<source-id>/`. It keeps the newest N sets whose `COMPLETE` names this source id, default 14, and deletes older ones. It deletes a prefix with no matching `COMPLETE` once that prefix's newest object is older than 24 hours. It does not delete the set just written. It prints each key it deletes.

Classifier seam: none.

## Objective

The named install has scheduled age-encrypted backups to the named bucket, or one backup was taken, or the recovery copy was checked, or an interrupted backup was recovered, or scheduled backups were stopped, or a set was restored onto a target and witnessed, or a restore that did not count was cleaned up, or the run stopped before a change, and the report says which. A change is made only after a read of the live state, only after `experts/DevOps Expert/` gates the plan, and only after the person approves the stop. A job's success is not the backup's success. The count rules and the re-inspection decide. Verified against Success.

## Inputs

Wrap what the person supplies so material never reads as instruction.

- `<request>`: what they asked, in their words.
- `<machine>`: the one identifier this run is for, when they named one. It matches `^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$`, the `machine` pattern `connectors/vm/CONNECTOR.md` in `wiser` publishes.
- `<install>`: the install name, when they named one. Deploy Twenty's install-name pattern: `^[a-z][a-z0-9]{1,12}$`, no hyphen, and not `caddy`.
- `<bucket>`: the backup bucket, when they named one. Deploy Twenty's bucket pattern: `^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$`.
- `<endpoint>`: the backup endpoint, when they named one. Deploy Twenty's endpoint pattern: `^https://[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+(:(6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{0,3}))?$`, no user, no path, and no query.
- `<region>`: the backup region, when they named one. Deploy Twenty's region pattern: `^[a-z0-9-]{1,32}$`. `auto` matches.
- `<schedule>`: a systemd calendar expression, when they named one. Otherwise `*-*-* 03:17:00 UTC`. It matches `^[A-Za-z0-9*:,./ -]{1,64}$`. The pattern is the whole check. The re-inspection shows whether systemd accepted it.
- `<retention>`: a whole number from 1 to 365, when they named one. Otherwise 14.
- `<live_state>`: what the inspection showed, or the statement that it was not read.

An unnamed machine is asked about. It is never guessed. An unnamed install is asked about. It is never guessed, and it is never defaulted. A value that does not match is asked about, and it is never sent.

## Identity

Someone who can get back onto the machine after the change, who keeps the age identity off the machine, and who can reissue the backup bucket's token. The inspection is the before-state. The re-inspection is what the machine shows now. A call that came back `timeout` or `uncertain` is not a reason to say the change was undone, and it is not a reason to send the change again.

## Steps

Which job is this? Take the first match.

- The request asks to enroll a machine or to take one out. Hand that part to `skills/Prepare VM/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a hostname, a DNS record, or a zone, and names no backup, no restore, and no install to create or remove. Hand that part to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a package, or for a unit that is not `vmjob-scheduled-twenty-backup.timer`. Hand it to `skills/VM Configure/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks to install Twenty, to add or remove a route, to remove an install, or to take an install offline or bring it back online, and names no backup. Hand that part to `skills/Deploy Twenty/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a security review. Say that this skill does not do that part. Load `experts/IT Expert/` Rule 5 in `wiser`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a release other than v2.45.6. Stop. Name the gap for a release other than v2.45.6. Send nothing.
- The request asks to restore a backup, or to restore a set onto an install. Job 3.
- The request asks to clean up after a restore that did not count. Job 7.
- The request asks to create a bucket or a token, to take an incremental backup, to delete sets by hand, to lock objects, to authenticate who made a set, to alert someone unprompted, to preserve Redis's queue, to make a restored install public, or to serve a custom domain from another install. Stop. Name that gap. Send nothing.
- The request asks for the status of backups, the newest set, or whether a backup is overdue. Job 0.
- The request asks to set up scheduled backups. Job 1.
- The request asks to back up now. Job 2.
- The request asks to stop scheduled backups. Job 4.
- The request asks to check the recovery copy, or to check the age key. Job 5.
- The request asks to recover an interrupted backup, or says the app is down after a backup. Job 6.
- The request asks for more than one of these, or the job cannot be read. Ask which this run is for. One run is one install. Do not guess. Do not call.

### Do the inputs match, before any call?

Refuse a value by name before `vm.inventory.list_hosts`. Do not send the other form. Ask for one that matches.

The machine, the install, the bucket, the endpoint, and the region use the patterns under Inputs. The schedule and the retention use theirs. Job 1 requires the install, the bucket, the endpoint, and the region. An unnamed schedule is the default. An unnamed retention is 14. Job 0, Job 2, Job 4, Job 5, and Job 6 require the install. They read the bucket from `config` on the machine. A bucket, an endpoint, or a schedule named beside one of those jobs, and different from `config`: ask whether the request is a new setup. Do not send the extra value. Do not guess.

### Before the inspection

The machine question, the map, the health, the role, and the approval questions are Deploy Twenty's (`skills/Deploy Twenty/`). Apply them before the inspection. The role question stops the router host before any change. A fleet member continues. What the router does with a command is Deploy Twenty's (`skills/Deploy Twenty/`). Call one action at a time.

### What did the inspection answer?

One `vm.command.run`, a read, with `machine` set to the identifier and `argv` exactly `/bin/sh`, `-c`, the script, `sh`, and the install name. The install name is the operand. It is not written into the script. The person is told the call is a read. The script does not print `backup.env` or `.env`. It prints `config` and `source-id`, which hold no secret.

This script is 3215 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the operands the question names.

```sh
export LC_ALL=C
install=$1
printf '%s\n' '--- token ---'
if [ -r /run/vm-job.token ]; then cat /run/vm-job.token; else printf '%s\n' none; fi
printf '%s\n' '--- jobs ---'
systemctl list-units --all --plain --no-legend 'vm-job-*'
printf '%s\n' "jobs-exit:$?"
printf '%s\n' '--- systemd ---'
systemctl --version
printf '%s\n' '--- age ---'
if command -v age >/dev/null 2>&1; then
  printf '%s\n' age:present
  age --version
  printf '%s\n' "age-exit:$?"
else
  printf '%s\n' age:absent
  printf '%s\n' age-exit:127
fi
printf '%s\n' '--- marker ---'
dir=/opt/$install
if [ -d "$dir" ]; then
  printf '%s\n' dir:present
  stat -c 'stat:%d %i %a' -- "$dir"
  if [ -f "$dir/INSTALL" ]; then cat "$dir/INSTALL"; else printf '%s\n' marker-absent; fi
else
  printf '%s\n' dir-absent
fi
printf '%s\n' '--- project ---'
if command -v docker >/dev/null 2>&1; then
  (cd "$dir" 2>/dev/null && docker compose -p "$install" ps -a --format '{{.Service}} {{.State}} {{.Status}}')
  printf '%s\n' "project-exit:$?"
  cid=$(cd "$dir" 2>/dev/null && docker compose -p "$install" ps -aq -- server 2>/dev/null | awk 'NR==1 { print; exit }')
  if [ -n "$cid" ]; then
    docker inspect --format '{{.Config.Image}}' -- "$cid"
    printf '%s\n' "image-exit:$?"
  else
    printf '%s\n' image-absent
  fi
else
  printf '%s\n' docker-absent
  printf '%s\n' project-exit:127
fi
printf '%s\n' '--- backup ---'
bk=$dir/backup
if [ -d "$bk" ]; then
  printf '%s\n' backup-dir:present
  stat -c 'mode:%a owner:%u' -- "$bk"
  for f in run recover source-id recipient backup.env config wrapper job keygen-helper token-helper key-check s3.js; do
    if [ -f "$bk/$f" ]; then stat -c "file:$f mode:%a owner:%u" -- "$bk/$f"; else printf '%s\n' "file:$f:absent"; fi
  done
  if [ -f "$bk/recipient" ]; then sha256sum -- "$bk/recipient"; else printf '%s\n' recipient-sha:absent; fi
  printf '%s\n' '--- config ---'
  if [ -f "$bk/config" ]; then cat -- "$bk/config"; else printf '%s\n' config-absent; fi
  printf '%s\n' '--- source-id ---'
  if [ -f "$bk/source-id" ]; then cat -- "$bk/source-id"; else printf '%s\n' source-id-absent; fi
  printf '%s\n' '--- state ---'
  if [ -f "$bk/state" ]; then tail -n 20 -- "$bk/state"; else printf '%s\n' state-absent; fi
else
  printf '%s\n' backup-dir:absent
fi
printf '%s\n' '--- scheduled ---'
rec=/var/lib/vm-job/scheduled/twenty-backup
if [ -f "$rec" ]; then cat -- "$rec"; else printf '%s\n' none; fi
printf '%s\n' '--- units ---'
systemctl show -p LoadState -p UnitFileState -p ActiveState -- vmjob-scheduled-twenty-backup.service
printf '%s\n' "service-show-exit:$?"
systemctl show -p LoadState -p UnitFileState -p ActiveState -p NextElapseUSecRealtime -- vmjob-scheduled-twenty-backup.timer
printf '%s\n' "timer-show-exit:$?"
systemctl is-enabled vmjob-scheduled-twenty-backup.service
printf '%s\n' "service-enabled-exit:$?"
systemctl is-enabled vmjob-scheduled-twenty-backup.timer
printf '%s\n' "timer-enabled-exit:$?"
svc=/etc/systemd/system/vmjob-scheduled-twenty-backup.service
if [ ! -e "$svc" ]; then printf '%s\n' schedule:none
elif grep -qxF -- "ExecStart=/bin/sh $dir/backup/wrapper" "$svc"; then printf '%s\n' schedule:this
else printf '%s\n' schedule:other; fi
printf '%s\n' '--- disk ---'
if [ -d "$dir" ]; then df -B1 -P -- "$dir"; printf '%s\n' "disk-exit:$?"; else printf '%s\n' disk-exit:127; fi
printf '%s\n' '--- token after ---'
if [ -r /run/vm-job.token ]; then cat /run/vm-job.token; else printf '%s\n' none; fi
exit 0
```


The token, the jobs list, and the systemd version are read the way Deploy Twenty's inspection reads them (`skills/Deploy Twenty/`). The other sections are this skill's.

- The answer is not `ok` or `remote_failure` naming this identifier, or the output is `truncated`, or a section the question needs is missing. The inspection was not read. Stop. Change nothing. Do not start a job.
- Both token lines are present and the sections below were read. Continue to the token question.

Did the token hold across the inspection? That question is Deploy Twenty's (`skills/Deploy Twenty/`).

Is a job already loaded? That question is Deploy Twenty's (`skills/Deploy Twenty/`). A unit named `vmjob-scheduled-twenty-backup.service` or `.timer` is not in the `vm-job-*` list. The units section reads those. A loaded `vm-job-twenty-backup-*` unit is this skill's backup or its recovery. A running or deactivating one stops a new job and stops Job 4. A finished one is adopted, read back, and released by that question, and the run starts over from the inspection, once.

What did systemd and Docker show?

- The systemd version is below 254, or the line cannot be read. Stop. Name the gap `skills/Deploy Workload/` declares for a machine whose systemd is older than 254, which a background job needs. Copy the line. Change nothing.
- The project section says `docker-absent`, or `project-exit` is not 0. Stop. Name the gap Deploy Twenty declares for a machine with no Docker. This skill does not install Docker. Change nothing.
- The version is 254 or later and Docker answered. Continue.

Is this install Deploy Twenty's?

The marker question is Deploy Twenty's Job 2 marker question (`skills/Deploy Twenty/`). The required lines are the ones Context names.

- Those lines are present and `stat:` was read. Continue.
- The directory is absent, the marker is absent, or a required line does not match. Stop. This skill does not change an install it did not mark. Change nothing.

What is `age` on this machine?

- The age section says `age:present` and `age-exit` is 0, and a version line was read. Record the version. Continue.
- The age section says `age:absent`, or `age-exit` is not 0. `age` is absent. Job 1 stops and hands the package `age` to `skills/VM Configure/`. Any other job that must run `age` stops the same way. Job 0 still reports the files it could read. Change nothing else.

What is the image?

- The image line, the reference the server container was created from, contains `sha256:dca6d82985901468b391c0335aa8f0519a52b9809709e66f2de1dbff04351e53`. That is the pin Deploy Twenty installed. Continue.
- The server container was read and the pin is absent. Stop. Name the gap for a release other than v2.45.6. Change nothing.
- `image-absent` on a Job 0 read of an install that has no server yet. Record it. Job 1 and Job 2 stop, because the backup reads the running database. Job 3's target has no server by design, and its own read decides it.

What are the project containers?

A line is `<service> <state> <status>`. `db` is required for Job 1 and Job 2.

- `project-exit` is 0, and a `db` line has state `running`. Record every line. Continue.
- `project-exit` is 0 and the section is empty. The install is not running. Job 0 reports that. Job 1 and Job 2 stop. Name Deploy Twenty's offline state when the marker is present and no container was read. Do not start the stack. Change nothing.
- `db` is not `running`. Stop. Do not start it. Change nothing.
- `project-exit` is not 0. The containers were not read. Stop. Change nothing.

What is the backup directory?

For each of `run`, `recover`, `source-id`, `recipient`, `backup.env`, `config`, `wrapper`, `job`, `keygen-helper`, `token-helper`, `key-check`, and `s3.js`, the line is present or `absent`, and a present file has a mode and an owner.

- `backup-dir:absent`. No backup is set up. Job 0 says so and does not list a bucket. Continue to the job.
- The directory is present, its mode is `700`, and its owner is `0`. Record each file, the recipient sha256 or `recipient-sha:absent`, the config lines or `config-absent`, the source id or `source-id-absent`, and the state lines or `state-absent`. Continue.
- The directory is present and the mode or the owner is anything else. Stop. Name the line. Do not write over it. Change nothing.

What is the scheduled record?

Save the scheduled section to a file in the temporary directory. From `tools/vm-job/`, run `classify --step scheduled-record --answer` that file.

- The class is an object with `unit`, `invocationId`, and `skips`. Record them. Continue.
- The class is `none`. No firing has been recorded. Continue.
- The class is `skips-only`, facts `{ skips }`. No unit has been started by a firing, and that many firings skipped. Record the count. Continue.
- The class is `pending`, facts `{ unit, skips }`. A firing recorded a launch whose invocation id is not in the record yet; the next firing reconciles it. Record the unit. Continue.
- The class is `not-read`, or the step is refused because the tool is older than 0.3.2. Read the section directly. Three lines are the unit, the invocation id, and the skip count. The line `none` is the class `none`. Anything else was not read. Stop. Change nothing.

What are the timer and the service?

- `service-show-exit` is 0 and `timer-show-exit` is 0. Record `LoadState`, `UnitFileState`, `ActiveState`, and the timer's `NextElapseUSecRealtime`. Record each `is-enabled` line and its exit. `enabled` with exit 0 is enabled. Any other exit is not enabled. Continue.
- Either show exit is not 0. Those units were not read. Stop before a change that enables or removes them. Job 0 reports that the units were not read.

Whose schedule is it? The units carry one name per machine, so one install's scheduled backups hold them.

- `schedule:none` or `schedule:this`. Continue.
- `schedule:other`. The scheduled service runs another install's wrapper. Job 1 and Job 4 stop and change nothing. Name the gap for scheduled backups of a second install on the same machine. Every other job continues.

What did `df` show?

The data line is the `df -B1 -P` line that is not the header, read the way Deploy Twenty's disk line is read (`skills/Deploy Twenty/`). The fourth field is available bytes.

- `disk-exit` is 0 and the fourth field is a whole number. Record it. Continue.
- Anything else. The disk was not read. Stop before Job 1 or Job 2. Job 0 says the disk was not read.

### Job 0. Status

A read. No gate. No change call. The inspection above, then the bucket list when the credential can be used.

Is the credential usable?

- `file:backup.env:absent`, or `backup-dir:absent`. The bucket was not listed. Say `credential:absent`.
- The file is present and its mode is not `600`. The bucket was not listed. Say `credential:refused`. Do not pass the file to Docker.
- The file is present, its mode is `600`, `config` was read, and `source-id` was read. One direct call, the list script, operand the install name and no second operand. The person is told it is a read.

This script is 1527 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the operands the question names.

```sh
set -eu
export LC_ALL=C
install=$1
prefix=${2:-}
bk=/opt/$install/backup
if [ ! -f "$bk/backup.env" ]; then printf '%s\n' credential:absent; exit 2; fi
mode=$(stat -c '%a' -- "$bk/backup.env")
[ "$mode" = 600 ] || { printf '%s\n' credential:refused; exit 2; }
image=$(awk -F= '$1=="image" { print substr($0, index($0, "=")+1); exit }' "$bk/config")
bucket=$(awk -F= '$1=="bucket" { print substr($0, index($0, "=")+1); exit }' "$bk/config")
endpoint=$(awk -F= '$1=="endpoint" { print substr($0, index($0, "=")+1); exit }' "$bk/config")
region=$(awk -F= '$1=="region" { print substr($0, index($0, "=")+1); exit }' "$bk/config")
source=$(awk 'NR==1 { print; exit }' "$bk/source-id")
printf '%s\n' "$source" | grep -Eq '^[0-9a-f]{32}$' || { printf '%s\n' source:refused; exit 2; }
if [ -n "$prefix" ]; then
  printf '%s\n' "$prefix" | grep -Eq '^[0-9a-f]{32}/[0-9]{8}T[0-9]{6}Z-[0-9a-f]{6}$' || { printf '%s\n' prefix:refused; exit 2; }
fi
docker run --rm --user 0:0 --network "${install}_default" --label "backup-twenty=${install}" --entrypoint node --env-file "$bk/backup.env" -e "S3_BUCKET=$bucket" -e "S3_ENDPOINT=$endpoint" -e "S3_REGION=$region" -v "$bk:/backup:ro" "$image" /backup/s3.js list-sets "$source"
if [ -n "$prefix" ]; then
  docker run --rm --user 0:0 --network "${install}_default" --label "backup-twenty=${install}" --entrypoint node --env-file "$bk/backup.env" -e "S3_BUCKET=$bucket" -e "S3_ENDPOINT=$endpoint" -e "S3_REGION=$region" -v "$bk:/backup:ro" "$image" /backup/s3.js head "$prefix/backup.tar.age"
fi
```


What did the list show?

The direct-call question is Deploy Twenty's (`skills/Deploy Twenty/`). On `ok` or `remote_failure` naming this identifier, read the output.

- A line `credential:absent` or `credential:refused`. The bucket was not listed. The rest of this job still reports.
- `source:refused` or `prefix:refused`. The list was not made. Stop. Change nothing.
- Lines `object`, `field`, and `count`, and no line contains `S3_ACCESS_KEY_ID=`, `S3_SECRET_ACCESS_KEY=`, or `STORAGE_S3_SECRET_ACCESS_KEY=`. The list was read. A `field` line is one `COMPLETE` body line. Group by the object key's directory.
- The call's outcome is `timeout`, `truncated`, or unknown. The bucket was not listed. Do not repeat the call in this run. Report the inspection.

What is the newest set, and is it overdue?

A set counts when a `field` line `source-id=` equals the source id on the machine and a sibling `field` line is `format=1`. The newest is the greatest `stamp=` among those. Its age is the time of the read minus that stamp read as UTC `YYYYMMDDTHHMMSSZ`.

The schedule in `config` derives an interval only when it matches `*-*-*` then a space, then `HH:MM:SS`, then a space, then `UTC`. That interval is 86400 seconds. Twice it is 172800 seconds. The default matches.

- A newest set, and its age is greater than 172800 seconds. `overdue`.
- A newest set, and its age is 172800 seconds or less. Not overdue. Report the age.
- No set, and the timer is enabled. `overdue`.
- No set, and the timer is not enabled. `no-set`.
- The schedule does not match that daily form. Report `interval-not-derived`. Do not say overdue. Report the age when a newest set was read.
- The stamp or the clock cannot be read. The age was not read. Do not say overdue.

Report the skip count from the scheduled record, or `none` when the class was `none`. Report the state section's last line, or `state-absent`. Alerting someone unprompted is missing. Do not send an alert.

### Is the plan gated?

Jobs 0 and 5 take no gate. Jobs 1, 2, 4, and 6 are changes. The question is Deploy Twenty's (`skills/Deploy Twenty/`). The plan names the machine, the role, the inspection, the calls in order, and the way back. It is handed to `experts/DevOps Expert/` with `<live_state>` before any change call.

The way back for Job 1 is Job 4's removal of the timer, the service, the scheduled record, and `/opt/<install>/backup/`. Nothing in the bucket is deleted. The way back for Job 4 is Job 1, which makes a new source id. Sets under the old source id stay. The way back for Job 2 is `recover`, which the stop-post already runs. A counted backup is not undone except by a later retention pass. The way back for Job 6 is Job 6 again. It is safe to repeat. The way back is named. It is not sent unless the person asks, and then it is a new plan, gated again.

### Job 1. Set up scheduled backups

The confirmation names the install, the bucket, and the schedule. The person says those three. Anything else: stop. Send nothing.

`age` absent is a stop. Hand the package `age` to `skills/VM Configure/`. Send no writer.

The marker, the image pin, and a running `db` have already continued. `backup-dir` absent, or present with no `source-id`: this job may write. `source-id` present and the timer enabled: stop. Report Job 0. Do not make a second source id. `source-id` present and the timer not enabled: continue, and do not replace the source id.

The file writes are direct calls, the writer shape Deploy Twenty uses for its first-contact program (`skills/Deploy Twenty/`). Each writer is one `argv` element of at most 4096 code points. The install name is the operand. It is not written into the script. The gate and the approval question apply to each writer. Do not repeat a writer whose re-read shows the file already assembled and the mode set.

What does the setup write first?

The directory, then the three helpers. The person runs `keygen-helper` and `token-helper` before any other file is written.

This script is 121 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the operands the question names.

```sh
set -eu
export LC_ALL=C
install=$1
install -d -m 700 -o root -g root -- "/opt/$install/backup"
printf '%s\n' dir:written
```


The assembled file is 587 code points.
Writer 1 of 1, 872 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/backup/keygen-helper" << 'KEYG1END'
set -eu
export LC_ALL=C
install=$1
bk=/opt/$install/backup
if [ -f "$bk/recipient" ]; then printf '%s\n' keygen:kept; exit 2; fi
umask 077
pub=$(age-keygen 2>/dev/null | while IFS= read -r line; do
  case "$line" in
    'AGE-SECRET-KEY-'*) printf '%s\n' "$line" >/dev/tty ;;
    '# public key: age1'*) printf '%s\n' "${line#\# public key: }" ;;
  esac
done)
case "$pub" in
  age1*) ;;
  *) printf '%s\n' keygen:refused; exit 2 ;;
esac
printf '%s\n' "$pub" > "$bk/recipient"
chmod 644 "$bk/recipient"
chown root:root "$bk/recipient"
sha256sum -- "$bk/recipient"
printf '%s\n' helper-done
KEYG1END
sh -n "/opt/$install/backup/keygen-helper"
chmod 700 "/opt/$install/backup/keygen-helper"
chown root:root "/opt/$install/backup/keygen-helper"
printf '%s\n' 'keygen:written'
```


The assembled file is 673 code points.
Writer 1 of 1, 953 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/backup/token-helper" << 'TOKE1END'
set -eu
export LC_ALL=C
install=$1
bk=/opt/$install/backup
umask 077
stty -echo </dev/tty
printf '%s' 'key id: ' >/dev/tty
IFS= read -r kid </dev/tty || true
printf '\n%s' 'secret: ' >/dev/tty
IFS= read -r sec </dev/tty || true
printf '\n' >/dev/tty
stty echo </dev/tty
case "$kid" in ''|*[[:space:]]*) printf '%s\n' token:refused; exit 2 ;; esac
case "$sec" in ''|*[[:space:]]*) printf '%s\n' token:refused; exit 2 ;; esac
printf 'S3_ACCESS_KEY_ID=%s\nS3_SECRET_ACCESS_KEY=%s\n' "$kid" "$sec" > "$bk/backup.env"
chmod 600 "$bk/backup.env"
chown root:root "$bk/backup.env"
printf '%s\n' "saved:key-id:length:${#kid}" "saved:secret:length:${#sec}" helper-done
unset kid sec
TOKE1END
sh -n "/opt/$install/backup/token-helper"
chmod 700 "/opt/$install/backup/token-helper"
chown root:root "/opt/$install/backup/token-helper"
printf '%s\n' 'token:written'
```


The assembled file is 552 code points.
Writer 1 of 1, 823 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/backup/key-check" << 'KEYC1END'
set -eu
export LC_ALL=C
install=$1
bk=/opt/$install/backup
umask 077
stty -echo </dev/tty
printf '%s' 'identity: ' >/dev/tty
IFS= read -r ident </dev/tty || true
printf '\n' >/dev/tty
stty echo </dev/tty
case "$ident" in
  'AGE-SECRET-KEY-'*) ;;
  *) printf '%s\n' key-check:mismatch; exit 0 ;;
esac
got=$(printf '%s\n' "$ident" | age-keygen -y 2>/dev/null || true)
unset ident
want=$(awk 'NR==1 { print; exit }' "$bk/recipient")
if [ -n "$got" ] && [ "$got" = "$want" ]; then
  printf '%s\n' key-check:match
else
  printf '%s\n' key-check:mismatch
fi
KEYC1END
sh -n "/opt/$install/backup/key-check"
chmod 700 "/opt/$install/backup/key-check"
chown root:root "/opt/$install/backup/key-check"
printf '%s\n' 'keycheck:written'
```


What does the person run?

The pattern is Deploy Twenty's "What does the person run?" (`skills/Deploy Twenty/`). The helper is run with sudo, over the shell the person holds. It is not a router call. A value is not repeated into the conversation. Where Deploy Twenty loads a clipboard, this skill may do the same for the two token values, and it empties the clipboard after the paste. It does not print the file.

`keygen-helper` runs `age-keygen`. The identity line, the line that begins `AGE-SECRET-KEY-`, is written only to `/dev/tty`. The recipient, the `age1` text from the public-key line, is saved at `/opt/<install>/backup/recipient`, root-owned, mode 644. The helper prints that file's sha256 and `helper-done`. A second run, when the recipient is already there, prints `keygen:kept` and writes nothing. The boundary: the identity appears on that terminal, in its scrollback, and in that process's memory on the machine. After it, only the person's copy remains.

`token-helper` reads the key id and the secret from `/dev/tty`, with echo off. An empty value or a value that contains whitespace is refused. It writes `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` to `backup.env`, mode 600, and prints `saved:key-id:length:<n>`, `saved:secret:length:<n>`, and `helper-done`. It does not print the values.

- The person says `keygen-helper` printed `helper-done` and a sha256, or the recipient was already present and they did not need to run it. Continue.
- The person says `token-helper` printed `helper-done` and two lengths, or `backup.env` is already mode 600 and they did not need to run it. Continue.
- The person says a prompt refused a value, or they did not run a helper the files still need. Stop. The files stay. Do not start Job 2.

### Job 5. Check the recovery copy

No gate when `key-check` is already on the machine. The person runs it over the shell they hold, the same pattern as Job 1. They type the identity into the no-echo prompt. The helper derives the recipient with `age-keygen -y` and prints `key-check:match` or `key-check:mismatch`. It prints neither value.

- `file:key-check:absent`. Stop. Name Job 1. Send nothing.
- The person says the helper printed `key-check:match`. Job 1 continues to the file writes. A standalone check reports the match and stops. It writes nothing.
- The person says the helper printed `key-check:mismatch`, or they did not run it. Stop. Do not write the backup program. Do not enable the timer. The identity they hold does not match the recipient on the machine.

### What does the setup write after the match?

The source id, then `config`, then `run`, `recover`, `s3.js`, and `job`, then the wrapper and the two units from `vm-job scheduled`. Operands of the config script are the install, the bucket, the endpoint, the region, the retention, and the schedule, in that order. The image line in `config` is the pin above. The source id is read from the file, not from an operand.

This script is 437 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the operands the question names.

```sh
set -eu
export LC_ALL=C
install=$1
bk=/opt/$install/backup
umask 022
if [ -f "$bk/source-id" ]; then
  printf '%s\n' source-id:kept
  exit 0
fi
hex=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n' | tr 'A-F' 'a-f')
printf '%s\n' "$hex" | grep -Eq '^[0-9a-f]{32}$' || { printf '%s\n' source-id:refused; exit 2; }
printf '%s\n' "$hex" > "$bk/source-id"
chmod 644 "$bk/source-id"
chown root:root "$bk/source-id"
printf '%s\n' "source-id:$hex"
```


This script is 911 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the operands the question names.

```sh
set -eu
export LC_ALL=C
install=$1
bucket=$2
endpoint=$3
region=$4
retention=$5
schedule=$6
bk=/opt/$install/backup
sid=$(awk 'NR==1 { print; exit }' "$bk/source-id")
printf '%s\n' "$sid" | grep -Eq '^[0-9a-f]{32}$' || { printf '%s\n' config:refused; exit 2; }
case "$retention" in
  [1-9]|[1-9][0-9]|[1-9][0-9][0-9]) [ "$retention" -le 365 ] || { printf '%s\n' config:refused; exit 2; } ;;
  *) printf '%s\n' config:refused; exit 2 ;;
esac
umask 022
{
  printf 'bucket=%s\n' "$bucket"
  printf 'endpoint=%s\n' "$endpoint"
  printf 'region=%s\n' "$region"
  printf 'source_id=%s\n' "$sid"
  printf 'retention=%s\n' "$retention"
  printf 'schedule=%s\n' "$schedule"
  printf '%s\n' 'image=twentycrm/twenty@sha256:dca6d82985901468b391c0335aa8f0519a52b9809709e66f2de1dbff04351e53'
  printf 'install=%s\n' "$install"
} > "$bk/config"
chmod 644 "$bk/config"
chown root:root "$bk/config"
printf '%s\n' config:written
```


`run` is the backup program. The last writer runs `sh -n` on the assembled file and sets mode 700.

The assembled file is 10524 code points.
Writer 1 of 3, 3671 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/backup/run" << 'RUN1END'
set -eu
export LC_ALL=C
umask 077
install=${1:-}
base=/opt/$install
bk=$base/backup
st=$bk/state
work=$bk/work

note() { printf '%s\n' "$1" >> "$st"; printf '%s\n' "$1"; }
cleanup() {
  status=$?
  rm -rf "$work" || true
  rm -f "$bk/backup.tar.age" "$bk/tar.rc" "$bk/age.rc" "$bk/COMPLETE.part" "$bk/psql.err" "$bk/files.env" || true
  exit "$status"
}
trap cleanup EXIT
trap 'exit 143' TERM INT HUP PIPE

[ -n "$install" ] || exit 2
cd "$base"
note begin

cfg() { awk -F= -v k="$1" '$1==k { print substr($0, index($0, "=") + 1); exit }' "$bk/config"; }
bucket=$(cfg bucket)
endpoint=$(cfg endpoint)
region=$(cfg region)
source_id=$(cfg source_id)
retention=$(cfg retention)
image=$(cfg image)
want=$(cfg install)
sid=$(awk 'NR==1 { print; exit }' "$bk/source-id")

[ "$want" = "$install" ] || { note checks:refused:install; exit 2; }
[ "$sid" = "$source_id" ] || { note checks:refused:source; exit 2; }
printf '%s\n' "$source_id" | grep -Eq '^[0-9a-f]{32}$' || { note checks:refused:source; exit 2; }
case "$retention" in
  [1-9]|[1-9][0-9]|[1-9][0-9][0-9]) [ "$retention" -le 365 ] || { note checks:refused:retention; exit 2; } ;;
  *) note checks:refused:retention; exit 2 ;;
esac
command -v age >/dev/null 2>&1 || { note checks:refused:age; exit 2; }
[ -f "$bk/recipient" ] || { note checks:refused:recipient; exit 2; }
[ -f "$bk/backup.env" ] || { note checks:refused:credential; exit 2; }

psqlc() {
  timeout 60 docker compose -p "$install" exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d default -At -c "$1" 2>>"$bk/psql.err"
}
s3f() {
  awk -F= '$1 ~ /^STORAGE_S3_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|NAME|ENDPOINT|REGION)$/' "$base/.env" > "$bk/files.env"
  timeout 1800 docker run --rm --user 0:0 --network "${install}_default" --label "backup-twenty=${install}" --entrypoint node --env-file "$bk/files.env" -v "$bk:/backup:ro" -v "$work:/work" "$image" /backup/s3.js "$@"
  rm -f "$bk/files.env"
}
s3b() {
  timeout 1800 docker run --rm --user 0:0 --network "${install}_default" --label "backup-twenty=${install}" --entrypoint node --env-file "$bk/backup.env" -e "S3_BUCKET=$bucket" -e "S3_ENDPOINT=$endpoint" -e "S3_REGION=$region" -v "$bk:/backup:ro" -v "$work:/work" "$image" /backup/s3.js "$@"
}
num() {
  case "$1" in
    [0-9]|[0-9][0-9]|[0-9][0-9][0-9]|[0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]|[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) return 0 ;;
    *) return 1 ;;
  esac
}

rm -rf "$work"
mkdir -m 700 "$work"
dump_b=$(psqlc "select pg_database_size(current_database())") || { note checks:refused:size; exit 2; }
num "$dump_b" || { note checks:refused:size; exit 2; }
s3f list-files > "$work/list.out" || { note checks:refused:list; exit 2; }
listed=$(awk '$1=="bytes" { print $2; exit }' "$work/list.out")
num "$listed" || { note checks:refused:list; exit 2; }
local_line=$(timeout 60 docker run --rm --user 0:0 --label "backup-twenty=${install}" --entrypoint du -v "${install}_server-local-data:/s:ro" "$image" -s -B1 /s) || { note checks:refused:local; exit 2; }
local_b=$(printf '%s\n' "$local_line" | awk 'NR==1 { print $1 }')
RUN1END
printf '%s\n' writer-ok
```

Writer 2 of 3, 3652 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat >> "/opt/$install/backup/run" << 'RUN2END'
num "$local_b" || { note checks:refused:local; exit 2; }
need=$(( (dump_b + listed + local_b) * 2 + 1073741824 ))
avail=$(df -B1 -P -- "$work" | awk 'NR==2 { print $4 }')
num "$avail" || { note checks:refused:df; exit 2; }
printf '%s\n' "disk-need:$need" "disk-avail:$avail"
if [ "$avail" -lt "$need" ]; then note checks:refused:disk; exit 2; fi
mem_k=$(awk '$1=="MemAvailable:" { print $2; exit }' /proc/meminfo 2>/dev/null || true)
num "$mem_k" || { note checks:refused:memory; exit 2; }
mneed_k=$(( (dump_b + listed + local_b) / 1024 + 262144 ))
printf '%s\n' "memory-need-kib:$mneed_k" "memory-avail-kib:$mem_k"
if [ "$mem_k" -lt "$mneed_k" ]; then note checks:refused:memory; exit 2; fi
rm -f "$work/list.out"
note checks:ok

note stopping
timeout 120 docker compose -p "$install" stop server worker
note stopped

if ! psqlc "select \"key\" from core.\"keyValuePair\" where type = 'CONFIG_VARIABLE' and \"userId\" is null and \"workspaceId\" is null order by 1" > "$work/config-db.txt"; then
  note config-db:fail
  timeout 120 docker compose -p "$install" start server worker || true
  exit 3
fi
refused=0
while IFS= read -r name; do
  [ -n "$name" ] || continue
  case "$name" in
    SERVER_URL|EMAILING_DOMAIN_DRIVER|IS_MULTIWORKSPACE_ENABLED|DEFAULT_SUBDOMAIN|ENCRYPTION_KEY|FALLBACK_ENCRYPTION_KEY) refused=1 ;;
    STORAGE_*|EMAIL_*|RESEND_*|CLOUDFLARE_*) refused=1 ;;
  esac
done < "$work/config-db.txt"
if [ "$refused" -eq 1 ]; then
  note config-db:refused
  timeout 120 docker compose -p "$install" start server worker || true
  exit 3
fi
note config-db:ok

psqlc "select format('select %L, count(*) from %I.%I;', table_schema||'.'||table_name, table_schema, table_name) from information_schema.tables where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema') order by 1" > "$work/counts.sql"
timeout 120 docker compose -p "$install" exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d default -At -F ' ' < "$work/counts.sql" > "$work/counts.raw" 2>>"$bk/psql.err"
sort "$work/counts.raw" > "$work/counts.txt"
rm -f "$work/counts.sql" "$work/counts.raw"
{
  psqlc "select 'workspace', id, subdomain, \"activationStatus\" from core.workspace order by subdomain"
  psqlc "select 'signingKey', id, \"isCurrent\", \"privateKey\" is not null from core.\"signingKey\" order by 2"
  psqlc "select 'apiKey', id, \"revokedAt\" is null from core.\"apiKey\" order by 2"
} > "$work/state.txt"
timeout 600 docker compose -p "$install" exec -T db pg_dump -U postgres -d default -Fc > "$work/db.dump" 2>>"$bk/psql.err"
[ -s "$work/db.dump" ] || { note dump:fail; exit 4; }
note dump:ok

timeout 600 docker run --rm --user 0:0 --label "backup-twenty=${install}" --entrypoint tar -v "${install}_server-local-data:/s:ro" "$image" -czf - -C /s . > "$work/local.tgz"
[ -s "$work/local.tgz" ] || { note local:fail; exit 4; }
note local:ok

if ! s3f get-files /work/files > "$work/get.out"; then
  note files:fail
  exit 4
fi
[ -f "$work/files.list" ] || { note files:fail; exit 4; }
rm -f "$work/get.out"
note files:ok

enc=$(awk -F= '$1=="ENCRYPTION_KEY" { print substr($0, index($0, "=") + 1); exit }' "$base/.env")
fb=$(awk -F= '$1=="FALLBACK_ENCRYPTION_KEY" { print substr($0, index($0, "=") + 1); exit }' "$base/.env")
case "$enc" in ''|*[[:space:]]*|*[!A-Za-z0-9+/=]*) note secrets:refused; exit 4 ;; esac
case "$fb" in *[[:space:]]*|*[!A-Za-z0-9+/=]*) note secrets:refused; exit 4 ;; esac
printf 'ENCRYPTION_KEY=%s\nFALLBACK_ENCRYPTION_KEY=%s\n' "$enc" "$fb" > "$work/secrets.env"
unset enc fb
RUN2END
printf '%s\n' writer-ok
```

Writer 3 of 3, 3689 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat >> "/opt/$install/backup/run" << 'RUN3END'
url=$(awk -F= '$1=="SERVER_URL" { print substr($0, index($0, "=") + 1); exit }' "$base/.env")
fbk=$(awk -F= '$1=="STORAGE_S3_NAME" { print substr($0, index($0, "=") + 1); exit }' "$base/.env")
( cd "$work" && sha256sum db.dump counts.txt state.txt config-db.txt local.tgz files.list secrets.env > SHA256SUMS )
recip=$(awk 'NR==1 { print; exit }' "$bk/recipient")
[ -n "$recip" ] || { note encrypted:fail; exit 4; }
rm -f "$bk/tar.rc" "$bk/age.rc"
{ set +e; tar -cf - -C "$work" .; echo $? > "$bk/tar.rc"; } | { set +e; age -r "$recip" -o "$bk/backup.tar.age"; echo $? > "$bk/age.rc"; } || true
trc=$(awk 'NR==1 { print; exit }' "$bk/tar.rc")
arc=$(awk 'NR==1 { print; exit }' "$bk/age.rc")
[ "$trc" = 0 ] || { note archive:fail; exit 4; }
note archive:ok
[ "$arc" = 0 ] || { note encrypted:fail; exit 4; }
[ -s "$bk/backup.tar.age" ] || { note encrypted:fail; exit 4; }
note encrypted:ok
rm -rf "$work"
mkdir -m 700 "$work"

sum=$(sha256sum "$bk/backup.tar.age" | awk 'NR==1 { print $1 }')
sz=$(wc -c < "$bk/backup.tar.age" | tr -d ' ')
printf '%s\n' "archive-sha256:$sum" "archive-size:$sz"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
hex=$(od -An -N3 -tx1 /dev/urandom | tr -d ' \n' | tr 'A-F' 'a-f')
case "$hex" in
  [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]) ;;
  *) note uploaded:fail; exit 4 ;;
esac
prefix="$source_id/${stamp}-$hex"
s3b list-sets "$source_id" > "$work/sets.out" || { note uploaded:fail; exit 4; }
if grep -F "$prefix/" "$work/sets.out" >/dev/null 2>&1; then
  note uploaded:refused:prefix
  exit 4
fi
s3b put /backup/backup.tar.age "$prefix/backup.tar.age" > "$work/put.out" || { note uploaded:fail; exit 4; }
{
  printf 'source-id=%s\n' "$source_id"
  printf 'stamp=%s\n' "$stamp"
  printf 'size=%s\n' "$sz"
  printf 'sha256=%s\n' "$sum"
  printf 'format=1\n'
  printf 'recipient=%s\n' "$recip"
  printf 'server-url=%s\n' "$url"
  printf 'files-bucket=%s\n' "$fbk"
} > "$bk/COMPLETE.part"
h=$(s3b head "$prefix/backup.tar.age") || { note uploaded:fail; exit 4; }
hsz=$(printf '%s\n' "$h" | awk '$1=="head" { print $3; exit }')
[ "$hsz" = "$sz" ] || { note uploaded:fail; exit 4; }
pmd5=$(awk '$1=="put" { print $5; exit }' "$work/put.out")
hmd5=$(printf '%s\n' "$h" | awk '$1=="head" { print $4; exit }')
case "$pmd5" in ''|*[!0-9a-f]*) note uploaded:fail; exit 4 ;; esac
[ "${#pmd5}" -eq 32 ] && [ "$hmd5" = "$pmd5" ] || { note uploaded:fail; exit 4; }
s3b put /backup/COMPLETE.part "$prefix/COMPLETE" >/dev/null || { note uploaded:fail; exit 4; }
printf '%s\n' "set:$prefix"
note uploaded:ok
note complete:ok
rm -f "$bk/backup.tar.age" "$bk/COMPLETE.part"

note starting
timeout 120 docker compose -p "$install" start server worker
t0=$(date +%s)
ok=0
while :; do
  now=$(date +%s)
  if [ $((now - t0)) -ge 900 ]; then break; fi
  cid=$(timeout 60 docker compose -p "$install" ps -aq -- server | awk 'NR==1 { print; exit }')
  wid=$(timeout 60 docker compose -p "$install" ps -aq -- worker | awk 'NR==1 { print; exit }')
  hs=$(timeout 60 docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)
  wr=$(timeout 60 docker inspect --format '{{.State.Status}}' "$wid" 2>/dev/null || echo missing)
  if [ "$hs" = healthy ] && [ "$wr" = running ]; then ok=1; break; fi
  sleep 5
done
[ "$ok" -eq 1 ] || { note restart:fail; exit 5; }
note restart-verified

if ! s3b retention "$source_id" "$retention" > "$work/retention.out"; then
  note retention:fail
  exit 6
fi
note retention:ok
note end
exit 0
RUN3END
sh -n "/opt/$install/backup/run"
chmod 700 "/opt/$install/backup/run"
chown root:root "/opt/$install/backup/run"
printf '%s\n' 'run:written'
```


`recover` is the stop-post script. Mode 700.

The assembled file is 1541 code points.
Writer 1 of 1, 1803 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/backup/recover" << 'RECO1END'
set -eu
export LC_ALL=C
install=${1:-}
bkdir=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
if [ -z "$install" ]; then
  install=$(basename "$(dirname "$bkdir")")
fi
base=/opt/$install
bk=$base/backup
st=$bk/state
work=$bk/work
cd "$base"

note() { printf '%s\n' "$1" >> "$st"; printf '%s\n' "$1"; }
cleanup() {
  status=$?
  ids=$(timeout 30 docker ps -aq --filter "label=backup-twenty=${install}" 2>/dev/null || true)
  if [ -n "$ids" ]; then
    timeout 30 docker rm -f $ids >/dev/null 2>&1 || true
  fi
  rm -rf "$work" || true
  exit "$status"
}
trap cleanup EXIT

need=0
if [ -f "$st" ]; then
  need=$(awk '
    BEGIN { v = 0; d = 0 }
    $0 == "restart-verified" { v = NR }
    $0 == "stopping" || $0 == "starting" { d = NR }
    END { print (d > 0 && d > v) ? 1 : 0 }
  ' "$st")
fi
if [ "$need" != 1 ]; then
  exit 0
fi

note recovering
t0=$(date +%s)
timeout 30 docker compose -p "$install" start server worker || true
while :; do
  now=$(date +%s)
  if [ $((now - t0)) -ge 840 ]; then
    note recovered:fail:deadline
    exit 1
  fi
  sid=$(timeout 30 docker compose -p "$install" ps -aq -- server | awk 'NR==1 { print; exit }')
  wid=$(timeout 30 docker compose -p "$install" ps -aq -- worker | awk 'NR==1 { print; exit }')
  hs=$(timeout 30 docker inspect --format '{{.State.Health.Status}}' "$sid" 2>/dev/null || echo missing)
  wr=$(timeout 30 docker inspect --format '{{.State.Status}}' "$wid" 2>/dev/null || echo missing)
  if [ "$hs" = healthy ] && [ "$wr" = running ]; then
    note recovered:ok
    exit 0
  fi
  sleep 5
done
RECO1END
sh -n "/opt/$install/backup/recover"
chmod 700 "/opt/$install/backup/recover"
chown root:root "/opt/$install/backup/recover"
printf '%s\n' 'recover:written'
```


`s3.js` runs inside a one-shot container of the pinned image. The container is `--rm`, `--network` `<install>_default`, `--label backup-twenty=<install>`, `--entrypoint node`, `--env-file` the credential file, and the work directory bind-mounted when the command needs it. `run` passes `backup.env` and `S3_BUCKET`, `S3_ENDPOINT`, and `S3_REGION` for the backup bucket, and passes `files.env` for the files bucket: the five `STORAGE_S3_` lines of `.env` and no other, written mode 600 for the call and removed after it, so no other secret of the install reaches the helper. Every helper container runs as `--user 0:0`, since the backup directory is root-owned, mode 700. The program reads `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_ENDPOINT`, and `S3_REGION`, and otherwise the `STORAGE_S3_` names. It loads `@aws-sdk/client-s3` from `@aws-sdk/client-s3` or from `/app/packages/twenty-server/node_modules/@aws-sdk/client-s3`, the module path Deploy Twenty's start check proved. It sets `forcePathStyle`. It prints keys, sizes, hashes, and counts. It never prints a credential. A missing client prints `s3-client:absent`. A missing setting prints `s3-config:absent`.

The commands are `list-files`, `get-files` and a directory, `get` and a key and a file, `put` and a file and a key, `head` and a key, `list-sets` and a source id, `delete` and a key, and `retention` and a source id and N. `list-files` follows `ContinuationToken` while `IsTruncated` is set. `get-files` writes every object under the directory and writes `<dir>.list` as key, size, and sha256. It refuses a key that starts with `/` or contains `..`. `put` sends `Content-MD5` and prints the key, the size, the sha256 and the MD5. `head` prints the size and the ETag, or `absent` and exit 2 when the key is missing. `delete` prints `deleted` for a missing key as well. `list-sets` prints each object and, for a key that ends in `/COMPLETE`, each body line as `field`. `retention` keeps the newest N matching sets, always keeps the newest of those, deletes older matching sets, and deletes a prefix with no matching `COMPLETE` once it is older than 24 hours. The last writer runs `node --check` on the assembled file inside the image, with the network off and only that file mounted, and sets mode 644.

The assembled file is 9463 code points.
Writer 1 of 3, 3718 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 022
cat > "/opt/$install/backup/s3.js" << 'S3.J1END'
"use strict";
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

function loadClient() {
  const paths = ["@aws-sdk/client-s3", "/app/packages/twenty-server/node_modules/@aws-sdk/client-s3"];
  for (let i = 0; i < paths.length; i++) {
    try { return require(paths[i]); } catch (e) {}
  }
  return null;
}

function envFirst(names) {
  for (let i = 0; i < names.length; i++) {
    const v = process.env[names[i]];
    if (v) return v;
  }
  return "";
}

function say(parts) {
  process.stdout.write(parts.join("\t") + "\n");
}

function sha(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function safeKey(key) {
  if (!key || key.charAt(0) === "/" || key.indexOf("..") !== -1) return "";
  return key;
}

async function listAll(s3, A, bucket, prefix) {
  const out = [];
  let token = undefined;
  do {
    const res = await s3.send(new A.ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      ContinuationToken: token,
      MaxKeys: 1000
    }));
    const contents = res.Contents || [];
    for (let i = 0; i < contents.length; i++) out.push(contents[i]);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

async function bodyOf(s3, A, bucket, key) {
  const g = await s3.send(new A.GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = Buffer.from(await g.Body.transformToByteArray());
  return bytes;
}

function field(text, name) {
  const lines = String(text).split("\n");
  const pref = name + "=";
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(pref) === 0) return lines[i].slice(pref.length);
  }
  return "";
}

function setOf(key, source) {
  const p = source + "/";
  if (key.indexOf(p) !== 0) return "";
  const rest = key.slice(p.length);
  const i = rest.indexOf("/");
  if (i < 1) return "";
  return rest.slice(0, i);
}

async function main() {
  const A = loadClient();
  if (!A) {
    say(["s3-client:absent"]);
    process.exit(1);
  }
  const access = envFirst(["S3_ACCESS_KEY_ID", "STORAGE_S3_ACCESS_KEY_ID"]);
  const secret = envFirst(["S3_SECRET_ACCESS_KEY", "STORAGE_S3_SECRET_ACCESS_KEY"]);
  const bucket = envFirst(["S3_BUCKET", "STORAGE_S3_NAME"]);
  const endpoint = envFirst(["S3_ENDPOINT", "STORAGE_S3_ENDPOINT"]);
  const region = envFirst(["S3_REGION", "STORAGE_S3_REGION"]);
  if (!access || !secret || !bucket || !endpoint || !region) {
    say(["s3-config:absent"]);
    process.exit(1);
  }
  const s3 = new A.S3Client({
    region: region,
    endpoint: endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: access, secretAccessKey: secret }
  });
  const cmd = process.argv[2] || "";
  const a3 = process.argv[3] || "";
  const a4 = process.argv[4] || "";

  if (cmd === "list-files") {
    const objs = await listAll(s3, A, bucket, "");
    let total = 0;
    for (let i = 0; i < objs.length; i++) {
      const size = Number(objs[i].Size || 0);
      total += size;
      say(["file", String(size), objs[i].Key]);
    }
    say(["count", String(objs.length)]);
    say(["bytes", String(total)]);
    return;
  }

  if (cmd === "get-files") {
    const dir = a3;
    if (!dir) { say(["args:refused"]); process.exit(2); }
    fs.mkdirSync(dir, { recursive: true });
    const listPath = dir.replace(/\/$/, "") + ".list";
    const objs = await listAll(s3, A, bucket, "");
    let n = 0;
    let text = "";
    for (let i = 0; i < objs.length; i++) {
      const key = safeKey(objs[i].Key);
      if (!key) { say(["key:refused"]); process.exit(2); }
S3.J1END
printf '%s\n' writer-ok
```

Writer 2 of 3, 3701 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 022
cat >> "/opt/$install/backup/s3.js" << 'S3.J2END'
      const bytes = await bodyOf(s3, A, bucket, objs[i].Key);
      const dest = path.join(dir, key);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, bytes);
      const sum = sha(bytes);
      text += [key, String(bytes.length), sum].join("\t") + "\n";
      say(["got", String(bytes.length), sum, key]);
      n += 1;
    }
    fs.writeFileSync(listPath, text);
    say(["count", String(n)]);
    return;
  }

  if (cmd === "put") {
    const file = a3;
    const key = safeKey(a4);
    if (!file || !key) { say(["args:refused"]); process.exit(2); }
    const bytes = fs.readFileSync(file);
    const md5 = crypto.createHash("md5").update(bytes).digest();
    await s3.send(new A.PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentMD5: md5.toString("base64") }));
    say(["put", key, String(bytes.length), sha(bytes), md5.toString("hex")]);
    return;
  }

  if (cmd === "head") {
    const key = safeKey(a3);
    if (!key) { say(["args:refused"]); process.exit(2); }
    try {
      const h = await s3.send(new A.HeadObjectCommand({ Bucket: bucket, Key: key }));
      say(["head", key, String(h.ContentLength), String(h.ETag || "").replace(/"/g, "").toLowerCase()]);
    } catch (e) {
      const name = e && e.name ? e.name : "";
      if (name === "NotFound" || name === "NoSuchKey") {
        say(["absent", key]);
        process.exit(2);
      }
      say(["head:fail"]);
      process.exit(1);
    }
    return;
  }

  if (cmd === "delete") {
    const key = safeKey(a3);
    if (!key) { say(["args:refused"]); process.exit(2); }
    try {
      await s3.send(new A.DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (e) {
      const name = e && e.name ? e.name : "";
      if (name !== "NotFound" && name !== "NoSuchKey") {
        say(["delete:fail"]);
        process.exit(1);
      }
    }
    say(["deleted", key]);
    return;
  }

  if (cmd === "list-sets") {
    const source = a3;
    if (!/^[0-9a-f]{32}$/.test(source)) { say(["args:refused"]); process.exit(2); }
    const objs = await listAll(s3, A, bucket, source + "/");
    for (let i = 0; i < objs.length; i++) {
      const key = objs[i].Key;
      const lm = objs[i].LastModified ? new Date(objs[i].LastModified).toISOString() : "";
      say(["object", String(Number(objs[i].Size || 0)), lm, key]);
      if (key.slice(-9) === "/COMPLETE") {
        const bytes = await bodyOf(s3, A, bucket, key);
        const lines = bytes.toString("utf8").split("\n");
        for (let j = 0; j < lines.length; j++) {
          if (lines[j]) say(["field", lines[j]]);
        }
      }
    }
    say(["count", String(objs.length)]);
    return;
  }

  if (cmd === "get") {
    const key = safeKey(a3);
    if (!key || !a4) { say(["args:refused"]); process.exit(2); }
    let bytes;
    try {
      bytes = await bodyOf(s3, A, bucket, key);
    } catch (e) {
      const name = e && e.name ? e.name : "";
      if (name === "NoSuchKey" || name === "NotFound") { say(["absent", key]); process.exit(2); }
      say(["get:fail"]);
      process.exit(1);
    }
    fs.mkdirSync(path.dirname(a4), { recursive: true });
    fs.writeFileSync(a4, bytes);
    say(["get", key, String(bytes.length), sha(bytes)]);
    return;
  }

  if (cmd === "retention") {
    const source = a3;
    const n = Number(a4);
    if (!/^[0-9a-f]{32}$/.test(source) || !/^[1-9][0-9]{0,2}$/.test(a4) || n < 1 || n > 365) {
      say(["args:refused"]);
      process.exit(2);
    }
    const objs = await listAll(s3, A, bucket, source + "/");
    const groups = {};
S3.J2END
printf '%s\n' writer-ok
```

Writer 3 of 3, 2726 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 022
cat >> "/opt/$install/backup/s3.js" << 'S3.J3END'
    for (let i = 0; i < objs.length; i++) {
      const name = setOf(objs[i].Key, source);
      if (!name) continue;
      if (!groups[name]) groups[name] = [];
      groups[name].push(objs[i]);
    }
    const names = Object.keys(groups);
    const complete = [];
    const bare = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const rows = groups[name];
      let completeKey = "";
      let newest = 0;
      for (let j = 0; j < rows.length; j++) {
        const lm = rows[j].LastModified ? new Date(rows[j].LastModified).getTime() : 0;
        if (lm > newest) newest = lm;
        if (rows[j].Key.slice(-9) === "/COMPLETE") completeKey = rows[j].Key;
      }
      if (!completeKey) {
        bare.push({ name: name, newest: newest, rows: rows });
        continue;
      }
      const bytes = await bodyOf(s3, A, bucket, completeKey);
      const named = field(bytes.toString("utf8"), "source-id");
      if (named !== source) {
        bare.push({ name: name, newest: newest, rows: rows });
        continue;
      }
      complete.push({ name: name, rows: rows });
    }
    complete.sort(function (x, y) { return x.name < y.name ? 1 : x.name > y.name ? -1 : 0; });
    const keepN = n < 1 ? 1 : n;
    const kept = {};
    for (let i = 0; i < complete.length && i < keepN; i++) kept[complete[i].name] = 1;
    if (complete.length) kept[complete[0].name] = 1;
    const day = 86400000;
    const now = Date.now();
    let deleted = 0;
    async function removeRows(rows) {
      for (let i = 0; i < rows.length; i++) {
        await s3.send(new A.DeleteObjectCommand({ Bucket: bucket, Key: rows[i].Key }));
        say(["delete", rows[i].Key]);
        deleted += 1;
      }
    }
    for (let i = 0; i < complete.length; i++) {
      if (kept[complete[i].name]) say(["keep", source + "/" + complete[i].name + "/"]);
      else await removeRows(complete[i].rows);
    }
    for (let i = 0; i < bare.length; i++) {
      const age = now - bare[i].newest;
      if (age > day) await removeRows(bare[i].rows);
      else say(["keep", source + "/" + bare[i].name + "/"]);
    }
    say(["count-deleted", String(deleted)]);
    return;
  }

  say(["args:refused"]);
  process.exit(2);
}

main().catch(function () {
  say(["s3:fail"]);
  process.exit(1);
});
S3.J3END
docker run --rm --user 0:0 --network none --entrypoint node -v "/opt/$install/backup/s3.js:/check.js:ro" twentycrm/twenty@sha256:dca6d82985901468b391c0335aa8f0519a52b9809709e66f2de1dbff04351e53 --check /check.js
chmod 644 "/opt/$install/backup/s3.js"
chown root:root "/opt/$install/backup/s3.js"
printf '%s\n' 's3:written'
```


`job` is the script a firing and a manual backup run. Its body begins with `set -eu`. The temp file passed to `start` is that body, byte for byte, not the writer. Mode 700.

The assembled file is 63 code points.
Writer 1 of 1, 303 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/backup/job" << 'JOB1END'
set -eu
export LC_ALL=C
exec /bin/sh "/opt/$1/backup/run" "$1"
JOB1END
sh -n "/opt/$install/backup/job"
chmod 700 "/opt/$install/backup/job"
chown root:root "/opt/$install/backup/job"
printf '%s\n' 'job:written'
```


The wrapper and the units come from `tools/vm-job/` `scheduled`, run from that tool's directory the way its Quick Start runs `node scripts/vm-job.js`. The flags are `--purpose twenty-backup`, `--limit 3600`, `--script-path` `/opt/<install>/backup/job`, `--wrapper-path` `/opt/<install>/backup/wrapper`, `--on-calendar` the schedule, `--stop-post` `/opt/<install>/backup/recover`, `--stop-post-timeout 1200`, then `--` and the install name. Send the `writers` it prints, in order, each as one `vm.command.run` whose `argv` is that writer, unchanged. Each installs one chunk; the last of each file checks that file's sha256 against the tool's, sets its mode and `root:root`, moves it into place, and prints `installed:<path>`. The service is `/etc/systemd/system/vmjob-scheduled-twenty-backup.service` and the timer `/etc/systemd/system/vmjob-scheduled-twenty-backup.timer`, outside `vm-job-*`, so a loaded timer does not count as a loaded job. A writer whose call was unclear or failed is never sent again alone: that file's writers are sent again from its first, once the earlier call has ended. A `writer:sha-mismatch`, `writer:part-refused` or `writer:destination-refused` line stops the run. Do not restate the wrapper.

The timer is not enabled yet. Job 2 runs once. Only a Job 2 that counts is followed by the enable call.

### Job 2. Back up now

One job. Purpose `twenty-backup`, limit 3600, `--stop-post` `/opt/<install>/backup/recover`, `--stop-post-timeout 1200`, operand the install name. The script is the temp copy of `job`. Build it with `tools/vm-job/` `start` and send the `argv` it prints, unchanged. The job question is Deploy Twenty's (`skills/Deploy Twenty/`).

It counts only when all of these hold. The poll class is `succeeded`. The read-back, in the text after the first `]: `, contains `restart-verified` and a later line `end`. A line `set:` names the prefix. A line `archive-sha256:` and a line `archive-size:` were printed. The list script, with the install and that prefix as operands, shows a `field` line `sha256=` equal to that archive sha256, and a `head` line whose size equals that archive size. Anything else does not count. Release still follows a finished poll. Do not leave the unit loaded because the count failed.

The list script's second operand is the prefix. It matches 32 hex, a slash, `YYYYMMDDTHHMMSSZ`, a hyphen, and 6 hex. Any other prefix is `prefix:refused`, and the backup does not count.

Downtime is the journal timestamp of `stopping` to the journal timestamp of `restart-verified`. The report states that length. A run that never printed `restart-verified` has no measured downtime. `recover` is what starts the app, on the unit's stop, unless the run itself already started it, which the config-db refusal does before it exits.

A `checks:refused:disk` or `checks:refused:memory` line means the app was not stopped. A `config-db:refused` line means the names were read and the app was started again. A `files:fail` line means that stage failed and `recover` is what starts the app. None of these count.

### What enables the timer?

Ask only after a Job 2 that counts, inside Job 1. One direct call. Then re-inspect.

This script is 317 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the operands the question names.

```sh
set -eu
export LC_ALL=C
systemctl daemon-reload
systemctl enable --now vmjob-scheduled-twenty-backup.timer
systemctl is-enabled vmjob-scheduled-twenty-backup.timer
systemctl show -p LoadState -p UnitFileState -p ActiveState -p NextElapseUSecRealtime -- vmjob-scheduled-twenty-backup.timer
printf '%s\n' timer-enabled
```


- The call came back and the re-inspection shows the timer `enabled`, `LoadState` `loaded`, and a next elapse that was read. The schedule was accepted. `changed` when the timer was not enabled before.
- The call's outcome was unknown, or the next elapse was not read. The timer was not shown enabled. Do not say the schedule was accepted. Do not repeat the enable in this run. Report the re-inspection.
- Job 2 did not count. Do not enable the timer. The files stay. The way back is Job 4, named, not sent, unless the person asks.

### Job 3. Restore a set onto a target

The target is an install Deploy Twenty made with its install for a restore (`skills/Deploy Twenty/`, its resting state for a restore): the marker's required lines with `stage=files-written`, no project container, volume or network, `admin.password` present, and its own files bucket, empty, which is neither the set's source bucket nor the backup bucket. The set is `<set>`, a prefix `<source-id>/<stamp>-<6 hex>` in the backup bucket. One run restores one set onto one target. The restore posts no route. Making a restored install public is missing.

The inputs are `<target>`, the target's install name, by Deploy Twenty's pattern; `<set>`, matching `^[0-9a-f]{32}/[0-9]{8}T[0-9]{6}Z-[0-9a-f]{6}$`; `<bucket>`, `<endpoint>` and `<region>` for the backup bucket; and the witness: `<witness_email>`, a user who existed at the backup, by Deploy Twenty's email pattern; `<witness_host>`, the hostname the restored workspace answers to on the target, `<subdomain>.<target base>`, by Deploy Twenty's hostname pattern; `<witness_record>`, a Twenty object's singular API name such as `person`, the name its one-record query takes (`^[a-z][A-Za-z0-9]{0,40}$`); `<witness_record_id>`, a UUID; and `<witness_file_key>`, the key of that record's attachment in the source's files bucket, whose last segment is the attachment's file id, with its extension when it has one, as Twenty names a stored file (`^[A-Za-z0-9._/-]{1,512}$`, no `..`, not starting `/`). The witness's password is typed by the person into a helper on the machine. It is never an input here.

What does the target hold?

The inspection is part 1's, with the target's name as the operand. Then one more read, operand the target. The person is told it is a read.

This script is 1943 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the operands the question names.

```sh
set -eu
export LC_ALL=C
install=$1
dir=/opt/$install
printf '%s\n' '--- volumes ---'
if command -v docker >/dev/null 2>&1; then
  docker volume ls --filter "label=com.docker.compose.project=$install" --format '{{.Name}}'
  printf '%s\n' "volumes-exit:$?"
else
  printf '%s\n' volumes-exit:127
fi
printf '%s\n' '--- networks ---'
if command -v docker >/dev/null 2>&1; then
  docker network ls --no-trunc --filter "label=com.docker.compose.project=$install" --format '{{.ID}} {{.Name}}'
  printf '%s\n' "networks-exit:$?"
  set +e
  docker network inspect --format '{{.Name}}' -- "${install}-proxy"
  pe=$?
  set -e
  printf '%s\n' "proxy-exit:$pe"
else
  printf '%s\n' networks-exit:127
  printf '%s\n' proxy-exit:127
fi
printf '%s\n' '--- admin ---'
if [ -f "$dir/admin.password" ]; then
  stat -c 'file:admin.password mode:%a owner:%u' -- "$dir/admin.password"
  wc -c < "$dir/admin.password" | tr -d ' '
else
  printf '%s\n' admin-password-absent
fi
printf '%s\n' '--- restore ---'
rs=$dir/restore
if [ -d "$rs" ]; then
  printf '%s\n' restore-dir:present
  stat -c 'mode:%a owner:%u' -- "$rs"
  for f in run restore-recover identity-helper witness-helper witness.js job plan state attempted.list server-since archive.tar; do
    if [ -f "$rs/$f" ]; then stat -c "file:$f mode:%a owner:%u" -- "$rs/$f"; else printf '%s\n' "file:$f:absent"; fi
  done
  if [ -f "$rs/state" ]; then tail -n 40 -- "$rs/state"; else printf '%s\n' restore-state-absent; fi
  if [ -f "$rs/attempted.list" ]; then wc -l < "$rs/attempted.list" | tr -d ' '; else printf '%s\n' attempted-absent; fi
else
  printf '%s\n' restore-dir:absent
fi
printf '%s\n' '--- clean ---'
bk=$dir/backup
for f in clean clean-recover clean-state; do
  if [ -f "$bk/$f" ]; then stat -c "file:$f mode:%a owner:%u" -- "$bk/$f"; else printf '%s\n' "file:$f:absent"; fi
done
if [ -f "$bk/clean-state" ]; then tail -n 40 -- "$bk/clean-state"; else printf '%s\n' clean-state-absent; fi
exit 0
```

Take the first match.

- The marker's required lines are present with `stage=files-written`, the project section is empty, `volumes-exit` and `networks-exit` are 0 with nothing listed, `proxy-exit` is not 0, `admin.password` is present at mode 600 with at least 2 bytes, `age` is present, and the restore directory is absent or holds no `state`. The target is ready. Continue.
- The restore directory holds a `state`. A restore was already attempted on this target. It is never sent again. Name Job 7. Stop.
- Anything else. Stop. Name what was read. Change nothing. A target is made by Deploy Twenty's install for a restore, and nothing here makes one.

Does the target have the backup side's files?

The restore reads the backup bucket with the target's own `backup.env`, and runs the target's own `s3.js`. When `/opt/<target>/backup/` is absent, write it as Job 1 writes it, against the target: the directory writer, the `token-helper` writer, and the three `s3.js` writers. Then the person runs `token-helper` over the shell they hold, with the backup bucket's key, as in Job 1. The recipient, the key check and the schedule are not part of a restore. When they are present and `backup.env` is mode 600, continue.

Which set, and is it whole?

One `vm.command.run`, operands the target, the set, the bucket, the endpoint and the region. It downloads the set's `COMPLETE` into `/opt/<target>/restore/` and reads it, heads the archive, and lists the target's files bucket. It writes nothing else and prints no credential.

This script is 3594 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the operands the question names.

```sh
set -eu
export LC_ALL=C
umask 077
install=$1
prefix=$2
bucket=$3
endpoint=$4
region=$5
base=/opt/$install
bk=$base/backup
rs=$base/restore
pin='twentycrm/twenty@sha256:dca6d82985901468b391c0335aa8f0519a52b9809709e66f2de1dbff04351e53'
tab=$(printf '\t')
printf '%s\n' "$prefix" | grep -Eq '^[0-9a-f]{32}/[0-9]{8}T[0-9]{6}Z-[0-9a-f]{6}$' || { printf '%s\n' set:refused; exit 2; }
printf '%s\n' "$bucket" | grep -Eq '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' || { printf '%s\n' bucket:refused; exit 2; }
printf '%s\n' "$region" | grep -Eq '^[a-z0-9-]{1,32}$' || { printf '%s\n' region:refused; exit 2; }
printf '%s\n' "$endpoint" | grep -Eq '^https://[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+(:(6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{0,3}))?$' || { printf '%s\n' endpoint:refused; exit 2; }
[ -f "$bk/backup.env" ] || { printf '%s\n' credential:absent; exit 2; }
[ "$(stat -c '%a' -- "$bk/backup.env")" = 600 ] || { printf '%s\n' credential:refused; exit 2; }
[ -f "$bk/s3.js" ] || { printf '%s\n' s3:absent; exit 2; }
image=$(awk -F= '$1=="TWENTY_IMAGE" { print substr($0, index($0, "=") + 1); exit }' "$base/.env")
[ "$image" = "$pin" ] || { printf '%s\n' image:refused; exit 2; }
tgt=$(awk -F= '$1=="STORAGE_S3_NAME" { print substr($0, index($0, "=") + 1); exit }' "$base/.env")
[ -n "$tgt" ] || { printf '%s\n' files-bucket:absent; exit 2; }
mkdir -p "$rs"
chmod 700 "$rs"
if [ -f "$rs/state" ]; then printf '%s\n' set:refused:again; exit 2; fi
if ! timeout 1800 docker run --rm --user 0:0 --label "backup-twenty=${install}" --entrypoint node --env-file "$bk/backup.env" -e "S3_BUCKET=$bucket" -e "S3_ENDPOINT=$endpoint" -e "S3_REGION=$region" -v "$bk:/backup:ro" -v "$rs:/restore" "$image" /backup/s3.js get "$prefix/COMPLETE" /restore/COMPLETE >/dev/null; then
  rm -f "$rs/COMPLETE"
  printf '%s\n' complete:absent
  exit 2
fi
chmod 600 "$rs/COMPLETE"
field() { awk -F= -v k="$1" '$1==k { print substr($0, index($0, "=") + 1); exit }' "$rs/COMPLETE"; }
for k in source-id stamp size sha256 format recipient server-url files-bucket; do
  printf '%s=%s\n' "$k" "$(field "$k")"
done
srcb=$(field files-bucket)
[ -n "$srcb" ] || { printf '%s\n' files-bucket:absent; exit 2; }
[ "$tgt" != "$srcb" ] && [ "$tgt" != "$bucket" ] || { printf '%s\n' buckets:same; exit 2; }
h=$(timeout 1800 docker run --rm --user 0:0 --label "backup-twenty=${install}" --entrypoint node --env-file "$bk/backup.env" -e "S3_BUCKET=$bucket" -e "S3_ENDPOINT=$endpoint" -e "S3_REGION=$region" -v "$bk:/backup:ro" -v "$rs:/restore" "$image" /backup/s3.js head "$prefix/backup.tar.age") || { printf '%s\n' archive:absent; exit 2; }
hsz=$(printf '%s\n' "$h" | awk -F "$tab" '$1=="head" { print $3; exit }')
[ "$hsz" = "$(field size)" ] || { printf '%s\n' size:mismatch; exit 2; }
awk -F= '$1 ~ /^STORAGE_S3_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|NAME|ENDPOINT|REGION)$/' "$base/.env" > "$bk/files.env"
chmod 600 "$bk/files.env"
set +e
out=$(timeout 1800 docker run --rm --user 0:0 --label "backup-twenty=${install}" --entrypoint node --env-file "$bk/files.env" -v "$bk:/backup:ro" -v "$rs:/restore" "$image" /backup/s3.js list-files)
rc=$?
set -e
rm -f "$bk/files.env"
[ "$rc" -eq 0 ] || { printf '%s\n' list:fail; exit 2; }
lcount=$(printf '%s\n' "$out" | awk -F "$tab" '$1=="count" { print $2; exit }')
lbytes=$(printf '%s\n' "$out" | awk -F "$tab" '$1=="bytes" { print $2; exit }')
[ "$lcount" = 0 ] && [ "$lbytes" = 0 ] || { printf '%s\n' bucket-not-empty; exit 2; }
printf '%s\n' "target-files-bucket:$tgt" buckets:differ sha:in-job
exit 0
```

- The output lists the set's `source-id`, `stamp`, `size`, `sha256`, `format`, `recipient`, `server-url` and `files-bucket`, then `target-files-bucket:<name>`, `buckets:differ` and `sha:in-job`. The set is present, its archive's size matches, and the target's bucket is empty and differs from both. Continue.
- `set:refused`, `bucket:refused`, `region:refused`, `endpoint:refused`, `credential:absent`, `credential:refused`, `s3:absent`, `image:refused`, `files-bucket:absent`, `set:refused:again`, `complete:absent`, `buckets:same`, `archive:absent`, `size:mismatch`, `list:fail` or `bucket-not-empty`. Stop. Name the line. Send nothing further.
- The call's outcome is unknown. Stop. Do not repeat it in this run.

Has the person confirmed the restore?

The person names the target, the set's `source-id`, its `stamp` and its `server-url` exactly as the read printed them, and the witness's email, host, record, record id and file key. A `server-url` other than the target's own base is allowed: the restored workspaces then answer at `<subdomain>.<target base>`, and their custom domains are not served, which is missing. Anything that does not match: ask once, naming the set. No answer that matches: stop. Send nothing.

The gate is Deploy Twenty's gate question (`skills/Deploy Twenty/`), with `experts/DevOps Expert/`. The plan names the target, the set, the stages below, the two helpers the person runs, the restore job with its stop-post, and the way back: a restore that does not count is never re-sent, and its continuation is Job 7, then Deploy Twenty's removal of the target. Nothing on the source install is touched.

What does the restore write first?

The plan file, one direct call, operands the target, the set, the bucket, the endpoint, the region, the set's `server-url`, and the witness's email, host, record, record id and file key, in that order. It refuses a value that does not match its pattern, and a target whose restore already has a `state`.

This script is 2469 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the operands the question names.

```sh
set -eu
export LC_ALL=C
umask 077
install=$1
prefix=$2
bucket=$3
endpoint=$4
region=$5
server_url=$6
email=$7
host=$8
record=$9
record_id=${10}
file_key=${11}
base=/opt/$install
rs=$base/restore
printf '%s\n' "$prefix" | grep -Eq '^[0-9a-f]{32}/[0-9]{8}T[0-9]{6}Z-[0-9a-f]{6}$' || { printf '%s\n' plan:refused; exit 2; }
printf '%s\n' "$bucket" | grep -Eq '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' || { printf '%s\n' plan:refused; exit 2; }
printf '%s\n' "$region" | grep -Eq '^[a-z0-9-]{1,32}$' || { printf '%s\n' plan:refused; exit 2; }
printf '%s\n' "$endpoint" | grep -Eq '^https://[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+(:(6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{0,3}))?$' || { printf '%s\n' plan:refused; exit 2; }
printf '%s\n' "$server_url" | grep -Eq '^https://[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$' || { printf '%s\n' plan:refused; exit 2; }
printf '%s\n' "$email" | grep -Eq '^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}$' || { printf '%s\n' plan:refused; exit 2; }
printf '%s\n' "$host" | grep -Eq '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' || { printf '%s\n' plan:refused; exit 2; }
printf '%s\n' "$record" | grep -Eq '^[a-z][A-Za-z0-9]{0,40}$' || { printf '%s\n' plan:refused; exit 2; }
printf '%s\n' "$record_id" | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' || { printf '%s\n' plan:refused; exit 2; }
case "$file_key" in
  *..*) printf '%s\n' plan:refused; exit 2 ;;
esac
[ "$(printf '%s' "$file_key" | cut -c1)" != / ] || { printf '%s\n' plan:refused; exit 2; }
flen=$(printf '%s' "$file_key" | wc -c | tr -d ' ')
[ "$flen" -ge 1 ] && [ "$flen" -le 512 ] || { printf '%s\n' plan:refused; exit 2; }
printf '%s\n' "$file_key" | grep -Eq '^[A-Za-z0-9._/-]+$' || { printf '%s\n' plan:refused; exit 2; }
mkdir -p "$rs"
chmod 700 "$rs"
if [ -f "$rs/state" ]; then printf '%s\n' plan:refused:again; exit 2; fi
{
  printf 'set=%s\n' "$prefix"
  printf 'bucket=%s\n' "$bucket"
  printf 'endpoint=%s\n' "$endpoint"
  printf 'region=%s\n' "$region"
  printf 'server-url=%s\n' "$server_url"
  printf 'email=%s\n' "$email"
  printf 'host=%s\n' "$host"
  printf 'record=%s\n' "$record"
  printf 'record-id=%s\n' "$record_id"
  printf 'file-key=%s\n' "$file_key"
} > "$rs/plan"
chmod 600 "$rs/plan"
chown root:root "$rs/plan"
printf '%s\n' plan:written
exit 0
```

Then the restore's files, each by its writers, in this order: `run`, `restore-recover`, `identity-helper`, `witness-helper`, `witness.js`, then `job`. The last writer of each checks it (`sh -n`, or `node --check` in the pinned image) and sets its mode. A writer whose call was unclear is not sent again alone: the file's writers are sent again from its first, after a re-read shows what is there.

`run` is the restore program. Its stages, each appended to `/opt/<target>/restore/state` before it starts and with its result after: `begin`, `checks` (the plan's values, the marker, `admin.password`, no container, volume or network, the set's `COMPLETE` downloaded, `format=1`, the source id, stamp and `server-url` equal to the plan's, `MemAvailable` at least `COMPLETE`'s size plus 256 MiB, the archive downloaded, the archive's sha256 and size equal to `COMPLETE`'s, the target's files bucket empty and neither the source's nor the backup bucket), `handoff`, `sums`, `secrets`, `create` and `created`, `volumes`, `data`, `dump`, `counts`, `config-db`, `local`, `files`, `server`, `worker`, `witness`, then `end`. Each stage's failure is a line naming it, and the program exits nonzero.

- **The handoff.** The program makes `/run/twenty-restore-<target>/identity` a FIFO, mode 600, prints `fifo-ready`, and waits at most 600 seconds for one line. The person runs `identity-helper` then, over the shell they hold, and types the age identity into its no-echo prompt. The helper writes it into the FIFO that exists, never creating a file in its place, and waits at most 30 seconds for the program to read; otherwise it prints `identity:refused:closed`. The program pipes it into `age -d -i -`, so the identity reaches only that process. The ciphertext is a file. A timeout, a line that is not an identity, or a failed decryption is `handoff:refused`, then `restore:nothing-written`. Any partial `archive.tar` is removed.
- **The secrets.** `secrets.env` must be exactly two lines, `ENCRYPTION_KEY=` and `FALLBACK_ENCRYPTION_KEY=`, their values in the base64 alphabet. They replace the target's `ENCRYPTION_KEY` line and its `FALLBACK_ENCRYPTION_KEY` line, adding the latter when the target has none, as an install Deploy Twenty made does not, through `.env.new` and a move, mode 600. The program never sources the file.
- **Data before the app.** `docker compose create` for every service; both volumes exist with Compose's project and volume labels; `db` and `redis` up and healthy; `pg_restore`; the row counts equal to the set's `counts.txt`; the restored database's `CONFIG_VARIABLE` names equal to the set's `config-db.txt` and passing the backup's refusal list; the local volume extracted, owner `1000:1000`.
- **Files.** For each line of the set's `files.list`, the key is appended to `attempted.list` before its upload, and the upload's answer after it. A key with `..` or a leading `/` stops the stage. Each upload's sha256 must equal the list's.
- **The app.** `server` started, and its log since that start must hold `Successfully migrated DB!` and `Successfully registered all background sync jobs!` and neither `Upgrade completed with errors` nor `Failed to register background jobs`, within 300 seconds. Then healthy within 300 seconds. Then `worker`, running within 300 seconds.
- **The witness.** The restored state rows equal the set's `state.txt`, and every workspace's activation status is unchanged. Then the program makes `/run/twenty-restore-<target>/password` a FIFO and prints `witness-ready`. The person runs `witness-helper` then, and types the witness user's password. Like `identity-helper`, it writes only into the FIFO that exists and waits at most 30 seconds, otherwise printing `witness:refused:closed`. `witness.js`, in a one-shot container on the target's proxy network, signs in at the server's private address, with the host, `X-Forwarded-Host`, `X-Forwarded-Proto` and `Origin` set to `<witness_host>`, as Deploy Twenty's first contact does. It prints `witness:login:ok`, then `witness:kid:match` when the fresh token's key id is the signing key the set's `state.txt` marked current, then `witness:record:ok` and `witness:attachment:<n>` for the record and its attachments, then `witness:attachment:match` when one of those attachments holds the file whose id is `<witness_file_key>`'s last segment without its extension. Last, the file at `<witness_file_key>` is fetched from the target's bucket and its sha256 compared with the set's `files.list`: `file:match`.
- **The end.** The decrypted archive and the work directory are removed, `admin.password` is removed, which no first contact will, and the state ends `end`.

`restore-recover` is the restore's stop-post. When the state has `server` and no `end` after it, it stops `server` and `worker`, so a restore that did not count never leaves a half-restored app serving. Its deadline is 840 seconds and every Docker call is bounded by `timeout 30`, so it ends inside `--stop-post-timeout 1200`. It always removes the FIFOs, the decrypted archive, `files.env`, the work directory and this install's labelled helper containers.

`run`, the restore program.

The assembled file is 17800 code points.
Writer 1 of 6, 3469 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/restore/run" << 'RST1END'
set -eu
export LC_ALL=C
umask 077
install=${1:-}
[ -n "$install" ] || exit 2
base=/opt/$install
rs=$base/restore
bk=$base/backup
st=$rs/state
work=$rs/work
runfifo=/run/twenty-restore-$install
pin='twentycrm/twenty@sha256:dca6d82985901468b391c0335aa8f0519a52b9809709e66f2de1dbff04351e53'
tab=$(printf '\t')

note() { printf '%s\n' "$1" >> "$st"; printf '%s\n' "$1"; }
stop() { note "$1"; exit "$2"; }
cleanup() {
  status=$?
  rm -f "$runfifo/identity" "$runfifo/password" || true
  rmdir "$runfifo" 2>/dev/null || true
  rm -f "$bk/files.env" "$rs/archive.tar" "$rs/psql.err" "$base/.env.new" || true
  rm -rf "$work" || true
  exit "$status"
}
trap cleanup EXIT
trap 'exit 143' TERM INT HUP PIPE

cd "$base"
if [ -f "$st" ]; then
  printf '%s\n' checks:refused:again >> "$st"
  printf '%s\n' checks:refused:again
  exit 2
fi
mkdir -p "$rs"
chmod 700 "$rs"

field() { awk -F= -v k="$1" '$1==k { print substr($0, index($0, "=") + 1); exit }' "$rs/COMPLETE"; }
cfgp() { awk -F= -v k="$1" '$1==k { print substr($0, index($0, "=") + 1); exit }' "$rs/plan"; }
psqlc() {
  timeout 60 docker compose -p "$install" exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d default -At -c "$1" 2>>"$rs/psql.err"
}
s3bak() {
  set +e
  timeout 1800 docker run --rm --user 0:0 --label "backup-twenty=${install}" --entrypoint node --env-file "$bk/backup.env" -e "S3_BUCKET=$bucket" -e "S3_ENDPOINT=$endpoint" -e "S3_REGION=$region" -v "$bk:/backup:ro" -v "$rs:/restore" "$image" /backup/s3.js "$@"
  rc=$?
  set -e
  return "$rc"
}
s3files() {
  net=$1
  shift
  awk -F= '$1 ~ /^STORAGE_S3_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|NAME|ENDPOINT|REGION)$/' "$base/.env" > "$bk/files.env"
  chmod 600 "$bk/files.env"
  set +e
  if [ -n "$net" ]; then
    timeout 1800 docker run --rm --user 0:0 --network "$net" --label "backup-twenty=${install}" --entrypoint node --env-file "$bk/files.env" -v "$bk:/backup:ro" -v "$rs:/restore" "$image" /backup/s3.js "$@"
  else
    timeout 1800 docker run --rm --user 0:0 --label "backup-twenty=${install}" --entrypoint node --env-file "$bk/files.env" -v "$bk:/backup:ro" -v "$rs:/restore" "$image" /backup/s3.js "$@"
  fi
  rc=$?
  set -e
  rm -f "$bk/files.env"
  return "$rc"
}
private4() {
  oldifs=$IFS
  IFS=.
  set -- $1
  IFS=$oldifs
  [ "$#" -eq 4 ] || return 1
  for o in "$1" "$2" "$3" "$4"; do
    case "$o" in
      ''|*[!0-9]*) return 1 ;;
      0[0-9]*) return 1 ;;
    esac
    [ "$o" -le 255 ] || return 1
  done
  case "$1" in
    10) return 0 ;;
    172) [ "$2" -ge 16 ] && [ "$2" -le 31 ] ;;
    192) [ "$2" -eq 168 ] ;;
    *) return 1 ;;
  esac
}

note begin
note checks
[ -f "$rs/plan" ] || stop checks:refused:plan 2
prefix=$(cfgp set)
bucket=$(cfgp bucket)
endpoint=$(cfgp endpoint)
region=$(cfgp region)
server_url=$(cfgp server-url)
email=$(cfgp email)
host=$(cfgp host)
record=$(cfgp record)
record_id=$(cfgp record-id)
file_key=$(cfgp file-key)
printf '%s\n' "$prefix" | grep -Eq '^[0-9a-f]{32}/[0-9]{8}T[0-9]{6}Z-[0-9a-f]{6}$' || stop checks:refused:set 2
source_id=$(printf '%s\n' "$prefix" | awk -F/ 'NR==1 { print $1; exit }')
rest=$(printf '%s\n' "$prefix" | awk -F/ 'NR==1 { print $2; exit }')
stamp=${rest%-*}
printf '%s\n' "$bucket" | grep -Eq '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' || stop checks:refused:bucket 2
printf '%s\n' "$region" | grep -Eq '^[a-z0-9-]{1,32}$' || stop checks:refused:region 2
RST1END
printf '%s\n' writer-ok
```

Writer 2 of 6, 3702 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat >> "/opt/$install/restore/run" << 'RST2END'
printf '%s\n' "$endpoint" | grep -Eq '^https://[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+(:(6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{0,3}))?$' || stop checks:refused:endpoint 2
printf '%s\n' "$server_url" | grep -Eq '^https://[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$' || stop checks:refused:url 2
printf '%s\n' "$email" | grep -Eq '^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}$' || stop checks:refused:email 2
printf '%s\n' "$host" | grep -Eq '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' || stop checks:refused:host 2
printf '%s\n' "$record" | grep -Eq '^[a-z][A-Za-z0-9]{0,40}$' || stop checks:refused:record 2
printf '%s\n' "$record_id" | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' || stop checks:refused:record 2
case "$file_key" in
  *..*) stop checks:refused:file 2 ;;
esac
[ "$(printf '%s' "$file_key" | cut -c1)" != / ] || stop checks:refused:file 2
flen=$(printf '%s' "$file_key" | wc -c | tr -d ' ')
[ "$flen" -ge 1 ] && [ "$flen" -le 512 ] || stop checks:refused:file 2
printf '%s\n' "$file_key" | grep -Eq '^[A-Za-z0-9._/-]+$' || stop checks:refused:file 2
command -v age >/dev/null 2>&1 || stop checks:refused:age 2
[ -f "$bk/backup.env" ] || stop checks:refused:credential 2
[ "$(stat -c '%a' -- "$bk/backup.env")" = 600 ] || stop checks:refused:credential 2
[ -f "$bk/s3.js" ] || stop checks:refused:s3 2
image=$(awk -F= '$1=="TWENTY_IMAGE" { print substr($0, index($0, "=") + 1); exit }' "$base/.env")
[ "$image" = "$pin" ] || stop checks:refused:image 2
mark=$base/INSTALL
[ -f "$mark" ] || stop checks:refused:marker 2
grep -qx 'skill=deploy-twenty' "$mark" || stop checks:refused:marker 2
grep -qx 'release=v2.45.6' "$mark" || stop checks:refused:marker 2
grep -qx 'compose-sha256=bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d' "$mark" || stop checks:refused:marker 2
grep -qx "project=$install" "$mark" || stop checks:refused:marker 2
grep -qx 'stage=files-written' "$mark" || stop checks:refused:marker 2
[ -f "$base/admin.password" ] || stop checks:refused:admin 2
[ "$(stat -c '%a' -- "$base/admin.password")" = 600 ] || stop checks:refused:admin 2
abytes=$(wc -c < "$base/admin.password" | tr -d ' ')
[ "$abytes" -ge 2 ] || stop checks:refused:admin 2
ps=$(timeout 60 docker compose -p "$install" ps -aq)
[ -z "$ps" ] || stop checks:refused:containers 2
vols=$(timeout 60 docker volume ls -q --filter "label=com.docker.compose.project=$install")
[ -z "$vols" ] || stop checks:refused:volumes 2
nets=$(timeout 60 docker network ls -q --filter "label=com.docker.compose.project=$install")
[ -z "$nets" ] || stop checks:refused:networks 2
if ! s3bak get "$prefix/COMPLETE" /restore/COMPLETE >/dev/null; then stop checks:refused:complete 2; fi
[ "$(field format)" = 1 ] || stop checks:refused:format 2
[ "$(field source-id)" = "$source_id" ] || stop checks:refused:source 2
[ "$(field stamp)" = "$stamp" ] || stop checks:refused:stamp 2
[ "$(field server-url)" = "$server_url" ] || stop checks:refused:url 2
csz=$(field size)
case "$csz" in ''|*[!0-9]*) stop checks:refused:size 2 ;; esac
mem_k=$(awk '$1=="MemAvailable:" { print $2; exit }' /proc/meminfo 2>/dev/null || true)
case "$mem_k" in ''|*[!0-9]*) stop checks:refused:memory 2 ;; esac
[ "$mem_k" -ge $(( csz / 1024 + 262144 )) ] || stop checks:refused:memory 2
if ! s3bak get "$prefix/backup.tar.age" /restore/backup.tar.age >/dev/null; then stop checks:refused:archive 2; fi
RST2END
printf '%s\n' writer-ok
```

Writer 3 of 6, 3670 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat >> "/opt/$install/restore/run" << 'RST3END'
sum=$(sha256sum "$rs/backup.tar.age" | awk 'NR==1 { print $1 }')
[ "$sum" = "$(field sha256)" ] || stop checks:refused:sha 2
sz=$(wc -c < "$rs/backup.tar.age" | tr -d ' ')
[ "$sz" = "$(field size)" ] || stop checks:refused:size 2
srcb=$(field files-bucket)
tgt=$(awk -F= '$1=="STORAGE_S3_NAME" { print substr($0, index($0, "=") + 1); exit }' "$base/.env")
[ -n "$srcb" ] && [ -n "$tgt" ] || stop checks:refused:files-bucket 2
[ "$tgt" != "$srcb" ] || stop checks:refused:bucket 2
[ "$tgt" != "$bucket" ] || stop checks:refused:bucket 2
if ! out=$(s3files "" list-files); then stop checks:refused:list 2; fi
printf '%s\n' "$out" > "$rs/list.out"
lcount=$(awk -F "$tab" '$1=="count" { print $2; exit }' "$rs/list.out")
lbytes=$(awk -F "$tab" '$1=="bytes" { print $2; exit }' "$rs/list.out")
rm -f "$rs/list.out"
[ "$lcount" = 0 ] && [ "$lbytes" = 0 ] || stop checks:refused:bucket-not-empty 2
note checks:ok

note handoff
if [ ! -d "$runfifo" ]; then mkdir -m 700 "$runfifo"; fi
rm -f "$runfifo/identity"
mkfifo -m 600 "$runfifo/identity"
printf '%s\n' fifo-ready
set +e
ident=$(timeout 600 cat "$runfifo/identity")
rc=$?
set -e
if [ "$rc" -ne 0 ] || [ -z "$ident" ]; then
  unset ident
  rm -f "$rs/archive.tar"
  note handoff:refused:timeout
  note restore:nothing-written
  exit 2
fi
case "$ident" in
  AGE-SECRET-KEY-*) ;;
  *)
    unset ident
    rm -f "$rs/archive.tar"
    note handoff:refused:decrypt
    note restore:nothing-written
    exit 2
    ;;
esac
set +e
printf '%s\n' "$ident" | age -d -i - -o "$rs/archive.tar" "$rs/backup.tar.age"
rc=$?
set -e
unset ident
rm -f "$runfifo/identity"
if [ "$rc" -ne 0 ] || [ ! -s "$rs/archive.tar" ]; then
  rm -f "$rs/archive.tar"
  note handoff:refused:decrypt
  note restore:nothing-written
  exit 2
fi
note handoff:ok

note sums
rm -rf "$work"
mkdir -m 700 "$work"
if ! tar -xf "$rs/archive.tar" -C "$work"; then note sums:fail; exit 4; fi
if ! (cd "$work" && sha256sum -c --strict --quiet SHA256SUMS); then note sums:fail; exit 4; fi
note sums:ok

note secrets
l1=$(awk 'NR==1 { print; exit }' "$work/secrets.env")
l2=$(awk 'NR==2 { print; exit }' "$work/secrets.env")
extra=$(awk 'NR>2 && $0 != "" { print "x"; exit }' "$work/secrets.env")
case "$l1" in
  ENCRYPTION_KEY=*) ;;
  *) note secrets:refused; exit 4 ;;
esac
case "$l2" in
  FALLBACK_ENCRYPTION_KEY=*) ;;
  *) note secrets:refused; exit 4 ;;
esac
[ -z "$extra" ] || { note secrets:refused; exit 4; }
enc=${l1#ENCRYPTION_KEY=}
fb=${l2#FALLBACK_ENCRYPTION_KEY=}
case "$enc" in ''|*[[:space:]]*|*[!A-Za-z0-9+/=]*) note secrets:refused; exit 4 ;; esac
case "$fb" in *[[:space:]]*|*[!A-Za-z0-9+/=]*) note secrets:refused; exit 4 ;; esac
unset enc fb
if ! awk '
  NR==FNR {
    if ($0 ~ /^ENCRYPTION_KEY=/) enc=substr($0, index($0, "=") + 1)
    if ($0 ~ /^FALLBACK_ENCRYPTION_KEY=/) fb=substr($0, index($0, "=") + 1)
    next
  }
  $0 ~ /^ENCRYPTION_KEY=/ { print "ENCRYPTION_KEY=" enc; seen1=1; next }
  $0 ~ /^FALLBACK_ENCRYPTION_KEY=/ { print "FALLBACK_ENCRYPTION_KEY=" fb; seen2=1; next }
  { print }
  END { if (!seen1) exit 1; if (!seen2) print "FALLBACK_ENCRYPTION_KEY=" fb }
' "$work/secrets.env" "$base/.env" > "$base/.env.new"; then
  rm -f "$base/.env.new"
  note secrets:fail
  exit 4
fi
chmod 600 "$base/.env.new"
mv "$base/.env.new" "$base/.env"
note secrets:ok

note create
if ! timeout 300 docker compose -p "$install" create; then note create:fail; exit 4; fi
note created
note volumes
for pair in "db-data ${install}_db-data" "server-local-data ${install}_server-local-data"; do
  short=${pair%% *}
  name=${pair#* }
RST3END
printf '%s\n' writer-ok
```

Writer 4 of 6, 3685 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat >> "/opt/$install/restore/run" << 'RST4END'
  got=$(timeout 60 docker volume inspect --format '{{index .Labels "com.docker.compose.project"}} {{index .Labels "com.docker.compose.volume"}}' "$name" 2>/dev/null || true)
  [ "$got" = "$install $short" ] || { note volumes:fail; exit 4; }
done
note volumes:ok
note data
if ! timeout 300 docker compose -p "$install" up -d --wait --wait-timeout 300 db redis; then note data:fail; exit 4; fi
for svc in db redis; do
  id=$(timeout 60 docker compose -p "$install" ps -aq -- "$svc" | awk 'NR==1 { print; exit }')
  [ -n "$id" ] || { note data:fail; exit 4; }
  hs=$(timeout 60 docker inspect --format '{{.State.Health.Status}}' "$id" 2>/dev/null || echo missing)
  [ "$hs" = healthy ] || { note data:fail; exit 4; }
done
note data:ok

note dump
if ! timeout 600 docker compose -p "$install" exec -T db pg_restore -U postgres -d default --no-owner < "$work/db.dump"; then
  note dump:fail
  exit 4
fi
note dump:ok
note counts
if ! psqlc "select format('select %L, count(*) from %I.%I;', table_schema||'.'||table_name, table_schema, table_name) from information_schema.tables where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema') order by 1" > "$work/counts.sql"; then
  note counts:fail
  exit 4
fi
if ! timeout 120 docker compose -p "$install" exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d default -At -F ' ' < "$work/counts.sql" > "$work/counts.raw" 2>>"$rs/psql.err"; then
  note counts:fail
  exit 4
fi
sort "$work/counts.raw" > "$work/counts.now"
if ! cmp -s "$work/counts.txt" "$work/counts.now"; then note counts:fail; exit 4; fi
note counts:ok

note config-db
if ! psqlc "select \"key\" from core.\"keyValuePair\" where type = 'CONFIG_VARIABLE' and \"userId\" is null and \"workspaceId\" is null order by 1" > "$work/config-db.now"; then
  note config-db:fail
  exit 3
fi
if ! cmp -s "$work/config-db.txt" "$work/config-db.now"; then note config-db:mismatch; exit 3; fi
refused=0
while IFS= read -r name || [ -n "$name" ]; do
  [ -n "$name" ] || continue
  case "$name" in
    SERVER_URL|EMAILING_DOMAIN_DRIVER|IS_MULTIWORKSPACE_ENABLED|DEFAULT_SUBDOMAIN|ENCRYPTION_KEY|FALLBACK_ENCRYPTION_KEY) refused=1 ;;
    STORAGE_*|EMAIL_*|RESEND_*|CLOUDFLARE_*) refused=1 ;;
  esac
done < "$work/config-db.now"
if [ "$refused" -eq 1 ]; then note config-db:refused; exit 3; fi
note config-db:ok

note local
if ! timeout 600 docker run -i --rm --user 0:0 --label "backup-twenty=${install}" --entrypoint tar -v "${install}_server-local-data:/s" "$image" -xzf - -C /s < "$work/local.tgz"; then
  note local:fail
  exit 4
fi
owner=$(timeout 60 docker run --rm --user 0:0 --label "backup-twenty=${install}" --entrypoint stat -v "${install}_server-local-data:/s:ro" "$image" -c '%u:%g' /s)
[ "$owner" = "1000:1000" ] || { note local:fail; exit 4; }
note local:ok

note files
: >> "$rs/attempted.list"
while IFS=$(printf '\t') read -r key fsz fsum || [ -n "$key" ]; do
  [ -n "$key" ] || continue
  case "$key" in
    *..*) note files:fail; exit 4 ;;
  esac
  [ "$(printf '%s' "$key" | cut -c1)" != / ] || { note files:fail; exit 4; }
  printf '%s\n' "key $key" >> "$rs/attempted.list"
  if ! out=$(s3files "${install}_default" put "/restore/work/files/$key" "$key"); then
    note files:fail
    exit 4
  fi
  got=$(printf '%s\n' "$out" | awk -F "$tab" '$1=="put" { print $4; exit }')
  [ "$got" = "$fsum" ] || { note files:fail; exit 4; }
  printf '%s\n' "answer $out" >> "$rs/attempted.list"
done < "$work/files.list"
note files:ok

since=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf '%s\n' "$since" > "$rs/server-since"
note server
RST4END
printf '%s\n' writer-ok
```

Writer 5 of 6, 3710 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat >> "/opt/$install/restore/run" << 'RST5END'
if ! timeout 120 docker compose -p "$install" start server; then note server:fail:start; exit 5; fi
cid=$(timeout 60 docker compose -p "$install" ps -aq -- server | awk 'NR==1 { print; exit }')
[ -n "$cid" ] || { note server:fail:start; exit 5; }
t0=$(date +%s)
oklog=0
while :; do
  now=$(date +%s)
  if [ $((now - t0)) -ge 300 ]; then break; fi
  set +e
  log=$(timeout 60 docker logs --since "$since" "$cid" 2>&1)
  set -e
  if printf '%s\n' "$log" | grep -F -q 'Upgrade completed with errors' || printf '%s\n' "$log" | grep -F -q 'Failed to register background jobs'; then
    note server:fail:log
    exit 5
  fi
  if printf '%s\n' "$log" | grep -F -q 'Successfully migrated DB!' && printf '%s\n' "$log" | grep -F -q 'Successfully registered all background sync jobs!'; then
    oklog=1
    break
  fi
  sleep 5
done
[ "$oklog" -eq 1 ] || { note server:fail:log; exit 5; }
t0=$(date +%s)
okh=0
while :; do
  now=$(date +%s)
  if [ $((now - t0)) -ge 300 ]; then break; fi
  hs=$(timeout 60 docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)
  if [ "$hs" = healthy ]; then okh=1; break; fi
  sleep 5
done
[ "$okh" -eq 1 ] || { note server:fail:health; exit 5; }
note server:ok

note worker
if ! timeout 120 docker compose -p "$install" start worker; then note worker:fail; exit 5; fi
t0=$(date +%s)
okw=0
while :; do
  now=$(date +%s)
  if [ $((now - t0)) -ge 300 ]; then break; fi
  wid=$(timeout 60 docker compose -p "$install" ps -aq -- worker | awk 'NR==1 { print; exit }')
  wr=$(timeout 60 docker inspect --format '{{.State.Status}}' "$wid" 2>/dev/null || echo missing)
  if [ "$wr" = running ]; then okw=1; break; fi
  sleep 5
done
[ "$okw" -eq 1 ] || { note worker:fail; exit 5; }
note worker:ok

note witness
{
  psqlc "select 'workspace', id, subdomain, \"activationStatus\" from core.workspace order by subdomain"
  psqlc "select 'signingKey', id, \"isCurrent\", \"privateKey\" is not null from core.\"signingKey\" order by 2"
  psqlc "select 'apiKey', id, \"revokedAt\" is null from core.\"apiKey\" order by 2"
} > "$work/state.now"
if ! cmp -s "$work/state.txt" "$work/state.now"; then note witness:fail:state; exit 5; fi
note witness:state:equal
if ! awk -F'|' '
  NR==FNR { if ($1=="workspace") a[$2]=$4; next }
  $1=="workspace" { if (a[$2] != $4) bad=1 }
  END { exit bad ? 1 : 0 }
' "$work/state.txt" "$work/state.now"; then note witness:fail:activation; exit 5; fi
note witness:activation:unchanged
rm -f "$runfifo/password"
mkfifo -m 600 "$runfifo/password"
printf '%s\n' witness-ready
set +e
pw=$(timeout 600 cat "$runfifo/password")
rc=$?
set -e
if [ "$rc" -ne 0 ] || [ -z "$pw" ]; then
  unset pw
  note witness:refused:password
  exit 5
fi
ip=$(timeout 60 docker inspect --format '{{with index .NetworkSettings.Networks "'"$install"'-proxy"}}{{.IPAddress}}{{end}}' "$cid")
if ! private4 "$ip"; then
  unset pw
  note witness:refused:address
  exit 5
fi
set +e
printf '%s\n' "$pw" | timeout 120 docker run -i --rm --user 0:0 --network "${install}-proxy" --label "backup-twenty=${install}" --entrypoint node -v "$rs:/restore:ro" "$image" /restore/witness.js "$ip" "$host" "$email" "$record" "$record_id" /restore/work/state.txt "$file_key"
rc=$?
set -e
unset pw
rm -f "$runfifo/password"
[ "$rc" -eq 0 ] || { note witness:fail:login; exit 5; }
if ! out=$(s3files "${install}_default" get "$file_key" /restore/work/fetched); then note witness:fail:file; exit 5; fi
got=$(printf '%s\n' "$out" | awk -F "$tab" '$1=="get" { print $4; exit }')
want=$(awk -F "$tab" -v k="$file_key" '$1==k { print $3; exit }' "$work/files.list")
RST5END
printf '%s\n' writer-ok
```

Writer 6 of 6, 441 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat >> "/opt/$install/restore/run" << 'RST6END'
[ -n "$got" ] && [ "$got" = "$want" ] || { note witness:fail:file; exit 5; }
note file:match
note witness:ok

rm -f "$rs/archive.tar" "$base/admin.password"
rm -rf "$work"
note end
exit 0
RST6END
sh -n "/opt/$install/restore/run"
chmod 700 "/opt/$install/restore/run"
chown root:root "/opt/$install/restore/run"
printf '%s\n' 'restore-run:written'
```

`restore-recover`.

The assembled file is 1702 code points.
Writer 1 of 1, 2006 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/restore/restore-recover" << 'RRC1END'
set -eu
export LC_ALL=C
install=${1:-}
here=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
if [ -z "$install" ]; then
  install=$(basename "$(dirname "$here")")
fi
base=/opt/$install
rs=$base/restore
st=$rs/state
runfifo=/run/twenty-restore-$install
cd "$base"

note() { printf '%s\n' "$1" >> "$st"; printf '%s\n' "$1"; }
cleanup() {
  status=$?
  ids=$(timeout 30 docker ps -aq --filter "label=backup-twenty=${install}" 2>/dev/null || true)
  if [ -n "$ids" ]; then
    timeout 30 docker rm -f $ids >/dev/null 2>&1 || true
  fi
  rm -f "$runfifo/identity" "$runfifo/password" || true
  rmdir "$runfifo" 2>/dev/null || true
  rm -f "$rs/archive.tar" "$base/backup/files.env" || true
  rm -rf "$rs/work" || true
  exit "$status"
}
trap cleanup EXIT

need=0
if [ -f "$st" ]; then
  need=$(awk '
    BEGIN { e = 0; s = 0 }
    $0 == "end" { e = NR }
    $0 == "server" { s = NR }
    END { print (s > 0 && s > e) ? 1 : 0 }
  ' "$st")
fi
if [ "$need" != 1 ]; then
  exit 0
fi

note restore-recovering
t0=$(date +%s)
while :; do
  now=$(date +%s)
  if [ $((now - t0)) -ge 840 ]; then
    note restore-recover:fail:deadline
    exit 1
  fi
  timeout 30 docker compose -p "$install" stop server worker || true
  ready=0
  for svc in server worker; do
    id=$(timeout 30 docker compose -p "$install" ps -aq -- "$svc" | awk 'NR==1 { print; exit }')
    if [ -z "$id" ]; then
      ready=$((ready + 1))
      continue
    fi
    stt=$(timeout 30 docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || echo missing)
    case "$stt" in
      running|restarting) ;;
      *) ready=$((ready + 1)) ;;
    esac
  done
  if [ "$ready" -eq 2 ]; then
    note restore-recover:stopped
    exit 0
  fi
  sleep 5
done
RRC1END
sh -n "/opt/$install/restore/restore-recover"
chmod 700 "/opt/$install/restore/restore-recover"
chown root:root "/opt/$install/restore/restore-recover"
printf '%s\n' 'restore-recover:written'
```

`identity-helper`.

The assembled file is 595 code points.
Writer 1 of 1, 899 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/restore/identity-helper" << 'IDH1END'
set -eu
export LC_ALL=C
install=$1
fifo=/run/twenty-restore-$install/identity
[ -p "$fifo" ] || { printf '%s\n' identity:refused; exit 2; }
stty -echo </dev/tty
printf '%s' 'identity: ' >/dev/tty
IFS= read -r ident </dev/tty || true
printf '\n' >/dev/tty
stty echo </dev/tty
case "$ident" in
  AGE-SECRET-KEY-*) ;;
  *) printf '%s\n' identity:refused; exit 2 ;;
esac
set +e
printf '%s\n' "$ident" | timeout 30 dd of="$fifo" conv=nocreat,notrunc status=none 2>/dev/null
rc=$?
set -e
unset ident
[ "$rc" -eq 0 ] || { printf '%s\n' identity:refused:closed; exit 2; }
printf '%s\n' identity:written
IDH1END
sh -n "/opt/$install/restore/identity-helper"
chmod 700 "/opt/$install/restore/identity-helper"
chown root:root "/opt/$install/restore/identity-helper"
printf '%s\n' 'identity-helper:written'
```

`witness-helper`.

The assembled file is 571 code points.
Writer 1 of 1, 870 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/restore/witness-helper" << 'WTH1END'
set -eu
export LC_ALL=C
install=$1
fifo=/run/twenty-restore-$install/password
[ -p "$fifo" ] || { printf '%s\n' witness:refused; exit 2; }
stty -echo </dev/tty
printf '%s' 'password: ' >/dev/tty
IFS= read -r pw </dev/tty || true
printf '\n' >/dev/tty
stty echo </dev/tty
case "$pw" in
  ''|*[[:space:]]*) printf '%s\n' witness:refused; exit 2 ;;
esac
set +e
printf '%s\n' "$pw" | timeout 30 dd of="$fifo" conv=nocreat,notrunc status=none 2>/dev/null
rc=$?
set -e
unset pw
[ "$rc" -eq 0 ] || { printf '%s\n' witness:refused:closed; exit 2; }
printf '%s\n' witness:written
WTH1END
sh -n "/opt/$install/restore/witness-helper"
chmod 700 "/opt/$install/restore/witness-helper"
chown root:root "/opt/$install/restore/witness-helper"
printf '%s\n' 'witness-helper:written'
```

`witness.js`. Mode 644.

The assembled file is 5605 code points.
Writer 1 of 2, 3730 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/restore/witness.js" << 'WTJ1END'
"use strict";
const fs = require("fs");
const http = require("http");

function say(line) {
  process.stdout.write(line + "\n");
}

function private4(s) {
  const p = String(s).split(".");
  if (p.length !== 4) return false;
  const n = [];
  for (let i = 0; i < 4; i++) {
    if (!/^[0-9]+$/.test(p[i])) return false;
    if (p[i].length > 1 && p[i].charAt(0) === "0") return false;
    const x = Number(p[i]);
    if (x < 0 || x > 255) return false;
    n.push(x);
  }
  if (n[0] === 10) return true;
  if (n[0] === 172 && n[1] >= 16 && n[1] <= 31) return true;
  return n[0] === 192 && n[1] === 168;
}

function post(ip, host, path, body, tok) {
  return new Promise(function (resolve) {
    const data = JSON.stringify(body);
    const headers = {
      "Content-Type": "application/json",
      Host: host,
      "X-Forwarded-Host": host,
      "X-Forwarded-Proto": "https",
      Origin: "https://" + host,
      "Content-Length": Buffer.byteLength(data)
    };
    if (tok) headers.Authorization = "Bearer " + tok;
    const req = http.request({
      host: ip,
      port: 3000,
      path: path,
      method: "POST",
      headers: headers,
      timeout: 20000
    }, function (res) {
      const chunks = [];
      res.on("data", function (c) { chunks.push(c); });
      res.on("end", function () {
        const text = Buffer.concat(chunks).toString("utf8");
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
        resolve({ code: res.statusCode, json: parsed });
      });
    });
    req.on("error", function () { resolve({ code: 0, json: null }); });
    req.on("timeout", function () { req.destroy(); resolve({ code: 0, json: null }); });
    req.write(data);
    req.end();
  });
}

function b64url(s) {
  let t = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  return Buffer.from(t, "base64").toString("utf8");
}

function dig(d, a, b, c, e, f) {
  let cur = d && d.data ? d.data : null;
  const keys = [a, b, c, e, f];
  for (let i = 0; i < keys.length; i++) {
    if (!keys[i]) break;
    if (!cur || typeof cur !== "object" || !(keys[i] in cur)) return null;
    cur = cur[keys[i]];
  }
  return cur;
}

async function main() {
  const ip = process.argv[2] || "";
  const host = process.argv[3] || "";
  const email = process.argv[4] || "";
  const record = process.argv[5] || "";
  const recordId = process.argv[6] || "";
  const statePath = process.argv[7] || "";
  const fileKey = process.argv[8] || "";
  const fileName = fileKey.split("/").pop();
  const fileId = fileName.indexOf(".") === -1 ? fileName : fileName.slice(0, fileName.indexOf("."));
  if (!private4(ip)) {
    say("witness:refused:address");
    process.exit(2);
  }
  if (!/^[a-z][A-Za-z0-9]{0,40}$/.test(record)) {
    say("witness:record:refused");
    process.exit(2);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(fileId)) {
    say("witness:file:refused");
    process.exit(2);
  }
  const raw = fs.readFileSync(0, "utf8");
  const pw = raw.split("\n")[0];
  if (!pw) {
    say("witness:refused:password");
    process.exit(2);
  }
  const origin = "https://" + host;
  const loginQ = "mutation($e:String!,$p:String!,$o:String!){getLoginTokenFromCredentials(email:$e,password:$p,origin:$o){loginToken{token}}}";
  const login = await post(ip, host, "/metadata", { query: loginQ, variables: { e: email, p: pw, o: origin } }, "");
  const lt = dig(login.json, "getLoginTokenFromCredentials", "loginToken", "token");
  if (!lt) {
    say("witness:login:fail");
    process.exit(2);
WTJ1END
printf '%s\n' writer-ok
```

Writer 2 of 2, 2460 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat >> "/opt/$install/restore/witness.js" << 'WTJ2END'
  }
  const tokQ = "mutation($t:String!,$o:String!){getAuthTokensFromLoginToken(loginToken:$t,origin:$o){tokens{accessOrWorkspaceAgnosticToken{token}}}}";
  const tok = await post(ip, host, "/metadata", { query: tokQ, variables: { t: lt, o: origin } }, "");
  const access = dig(tok.json, "getAuthTokensFromLoginToken", "tokens", "accessOrWorkspaceAgnosticToken", "token");
  if (!access) {
    say("witness:login:fail");
    process.exit(2);
  }
  say("witness:login:ok");
  let kid = "";
  try {
    const header = JSON.parse(b64url(access.split(".")[0]));
    kid = header && header.kid ? String(header.kid) : "";
  } catch (e) {
    kid = "";
  }
  const lines = fs.readFileSync(statePath, "utf8").split("\n");
  let cur = "";
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].split("|");
    if (f[0] === "signingKey" && f[2] === "t") cur = f[1];
  }
  if (!kid || !cur || kid !== cur) {
    say("witness:kid:mismatch");
    process.exit(2);
  }
  say("witness:kid:match");
  const q = "query($i:UUID!){" + record + "(filter:{id:{eq:$i}}){id attachments{edges{node{id file{fileId}}}}}}";
  const rec = await post(ip, host, "/graphql", { query: q, variables: { i: recordId } }, access);
  const node = rec.json && rec.json.data ? rec.json.data[record] : null;
  const edges = node && node.attachments && node.attachments.edges;
  if (!node || !node.id || !edges || !edges.length) {
    say("witness:record:fail");
    process.exit(2);
  }
  say("witness:record:ok");
  say("witness:attachment:" + String(edges.length));
  let held = false;
  for (let i = 0; i < edges.length; i++) {
    const files = edges[i] && edges[i].node && Array.isArray(edges[i].node.file) ? edges[i].node.file : [];
    for (let j = 0; j < files.length; j++) if (files[j] && files[j].fileId === fileId) held = true;
  }
  if (!held) {
    say("witness:attachment:mismatch");
    process.exit(2);
  }
  say("witness:attachment:match");
}

main().catch(function () {
  say("witness:fail");
  process.exit(1);
});
WTJ2END
docker run --rm --user 0:0 --network none --entrypoint node -v "/opt/$install/restore/witness.js:/check.js:ro" twentycrm/twenty@sha256:dca6d82985901468b391c0335aa8f0519a52b9809709e66f2de1dbff04351e53 --check /check.js
chmod 644 "/opt/$install/restore/witness.js"
chown root:root "/opt/$install/restore/witness.js"
printf '%s\n' 'witness:written'
```

`job`, the script the restore job runs. The temp file passed to `start` is its body, byte for byte.

The assembled file is 64 code points.
Writer 1 of 1, 316 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/restore/job" << 'RJB1END'
set -eu
export LC_ALL=C
exec /bin/sh "/opt/$1/restore/run" "$1"
RJB1END
sh -n "/opt/$install/restore/job"
chmod 700 "/opt/$install/restore/job"
chown root:root "/opt/$install/restore/job"
printf '%s\n' 'restore-job:written'
```

What does the restore job do?

One job. Purpose `twenty-restore`, limit 3600, `--stop-post` `/opt/<target>/restore/restore-recover`, `--stop-post-timeout 1200`, operand the target. The script is the temp copy of the restore's `job`. Build it with `tools/vm-job/` `start` and send the `argv` it prints, unchanged. The job question is Deploy Twenty's (`skills/Deploy Twenty/`).

The two prompts come during the job. Poll it. When a read-back by its invocation shows `fifo-ready`, tell the person to run `/opt/<target>/restore/identity-helper <target>` with sudo over the shell they hold, within 600 seconds, and to say when it printed `identity:written`. Poll again. When a read-back shows `witness-ready`, tell them to run `/opt/<target>/restore/witness-helper <target>` the same way, and type the witness's password. A prompt the person does not answer in time is the job's own refusal. Do not start the job again.

It counts only when all of these hold. The poll class is `succeeded`. The read-back, in the text after the first `]: `, holds `checks:ok`, `handoff:ok`, `sums:ok`, `secrets:ok`, `created`, `volumes:ok`, `data:ok`, `dump:ok`, `counts:ok`, `config-db:ok`, `local:ok`, `files:ok`, `server:ok`, `worker:ok`, `witness:state:equal`, `witness:activation:unchanged`, `witness:login:ok`, `witness:kid:match`, `witness:record:ok`, `witness:attachment:match`, `file:match`, `witness:ok`, and then `end`. Release follows a finished poll whether or not it counted. Release runs `restore-recover`, which finds `end` and only cleans up.

- It counted. Re-inspect the target: the server healthy, the worker running, `admin.password` absent, the restore's state ending `end`. Report `changed`, the stages, and the witness lines.
- It did not count. Report the last stage line. Name Job 7, then Deploy Twenty's removal of the target. Do not send the restore again.

### Job 4. Stop scheduled backups

Refused while a `vm-job-twenty-backup-*` unit is `activating`, `deactivating`, or `running`. The inspection's jobs section and this script both refuse that. A finished unit is released by the loaded-job question first. The confirmation names the install. The person says the install name. The gate applies. It is one direct call, operand the install name, because the call removes `/opt/<install>/backup/`, which holds `recover`, so `--stop-post` cannot point there. It disables and removes the timer and the service, removes `/var/lib/vm-job/scheduled/twenty-backup`, and removes that directory. Nothing in the bucket is deleted. It holds `tools/vm-job/`'s admission lock, `/run/lock/vm-job.lock`, from its unit check to its last removal, so neither a timer firing nor another start can begin a backup in between, and a firing already waiting on the lock is stopped with the service. It changes nothing when the scheduled service runs another install's wrapper, or when the lock stays busy for 10 seconds.

This script is 0 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the operands the question names.

```sh
set -eu
export LC_ALL=C
install=$1
svc=/etc/systemd/system/vmjob-scheduled-twenty-backup.service
if [ -e "$svc" ] && ! grep -qxF -- "ExecStart=/bin/sh /opt/$install/backup/wrapper" "$svc"; then printf '%s\n' stop-scheduled:refused:other-install; exit 2; fi
exec 9>/run/lock/vm-job.lock
flock -w 10 9 || { printf '%s\n' stop-scheduled:refused:lock-busy; exit 2; }
set +e
list=$(systemctl list-units --all --plain --no-legend 'vm-job-twenty-backup-*')
list_rc=$?
set -e
if [ "$list_rc" -ne 0 ]; then printf '%s\n' stop-scheduled:refused:unread; exit 2; fi
printf '%s\n' "$list" | awk '
  {
    name = $1
    if (name ~ /^vm-job-twenty-backup-/ && ($3 == "activating" || $3 == "deactivating" || $4 == "running" || $4 == "activating" || $4 == "deactivating")) bad = 1
  }
  END { exit bad ? 1 : 0 }
' || { printf '%s\n' stop-scheduled:refused:running; exit 2; }
systemctl disable --now vmjob-scheduled-twenty-backup.timer || true
systemctl disable --now vmjob-scheduled-twenty-backup.service || true
rm -f /etc/systemd/system/vmjob-scheduled-twenty-backup.service /etc/systemd/system/vmjob-scheduled-twenty-backup.timer /var/lib/vm-job/scheduled/twenty-backup
systemctl daemon-reload
rm -rf -- "/opt/$install/backup"
printf '%s\n' stop-scheduled:done
```


- The output is `stop-scheduled:refused:other-install`. Nothing was removed. Stop. The scheduled backups on this machine are another install's.
- The output is `stop-scheduled:refused:lock-busy`. Nothing was removed. Stop. A start held the lock; re-inspect before asking again.
- The output is `stop-scheduled:refused:unread`. Nothing was removed. Stop. The unit list was not read.
- The output is `stop-scheduled:refused:running`. Nothing was removed. Stop. Report the unit.
- The output is `stop-scheduled:done`. Re-inspect.
- The call's outcome was unknown. Re-inspect. Do not repeat the call.

The requested state is the two units not loaded and the backup directory absent. The bucket is untouched.

- That state holds, and the directory or a unit was present before. `changed`.
- That state held before the call. `unchanged`.
- The directory remains, or a unit is still loaded. Failed. Name what the re-inspection shows. Do not repeat the call.

The way back is Job 1. A new Job 1 makes a new source id. Sets under the old source id stay in the bucket. Deleting them by hand is missing.

### Job 6. Recover an interrupted backup

The rule in Context, as a gated job. Purpose `twenty-backup-recover`, limit 3600, the same `--stop-post` and `--stop-post-timeout` as Job 2, operand the install name. The temp script is this text and no other. Its first line is `set -eu`.

This script is 67 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the operands the question names.

```sh
set -eu
export LC_ALL=C
exec /bin/sh "/opt/$1/backup/recover" "$1"
```


It counts when the poll class is `succeeded` and the read-back shows `recovered:ok`, or the state already had `restart-verified` after the last `stopping` or `starting` and the script exited 0 without appending `recovering`. A `recovered:fail` does not count. Release runs `recover` once more, and another `recovered:ok` can be appended. That second line does not erase the first. The app is up when the server is healthy and the worker is `running` in the re-inspection. A failure's way back is Job 6 again, a new plan.

A reboot that already restarted the containers still gets this read when the person asks. Record the state the re-inspection shows.

### Job 7. Clean up after a restore that did not count

Ask on a target whose restore `state` exists and does not end `end`, or whose `backup/clean-state` exists and does not end `clean:end`, a cleanup cut off after it removed `restore/`. The confirmation names the target and says to clean it up. It is safe to repeat. Every step treats an absent thing as done.

The inspection, then the restore read of Job 3. The gate is Deploy Twenty's (`skills/Deploy Twenty/`), with `experts/DevOps Expert/`. The plan names the target, the job and its stop-post, and the way back: none is needed, since the job only stops the target's app, deletes keys the restore attempted, and removes the restore's files, and the target is Deploy Twenty's to remove next.

The cleanup's files are written into `/opt/<target>/backup/`, each by its writers, when the inspection shows them absent: `clean`, `clean-recover`, then `clean-job`. `clean` stops `server` and `worker` first, absent counting as stopped, and checks they are no longer running. It then deletes every key named on a `key ` line of `restore/attempted.list` from the target's files bucket, with the target's own files key, a missing key counting as deleted. It removes `restore/` and `admin.password`. Each step is appended to `backup/clean-state`, ending `clean:end`. `clean-recover` is its stop-post: it removes this install's labelled helper containers and `files.env`.

`clean`.

The assembled file is 2613 code points.
Writer 1 of 1, 2863 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/backup/clean" << 'CLN1END'
set -eu
export LC_ALL=C
umask 077
install=${1:-}
[ -n "$install" ] || exit 2
base=/opt/$install
rs=$base/restore
bk=$base/backup
cd "$base"

say() { printf '%s\n' "$1" >> "$bk/clean-state"; printf '%s\n' "$1"; }
s3files() {
  awk -F= '$1 ~ /^STORAGE_S3_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|NAME|ENDPOINT|REGION)$/' "$base/.env" > "$bk/files.env"
  chmod 600 "$bk/files.env"
  set +e
  timeout 1800 docker run --rm --user 0:0 --label "backup-twenty=${install}" --entrypoint node --env-file "$bk/files.env" -v "$bk:/backup:ro" -v "$rs:/restore" "$image" /backup/s3.js "$@"
  rc=$?
  set -e
  rm -f "$bk/files.env"
  return "$rc"
}
stopped() {
  id=$(timeout 60 docker compose -p "$install" ps -aq -- "$1" | awk 'NR==1 { print; exit }')
  if [ -z "$id" ]; then
    return 0
  fi
  stt=$(timeout 60 docker inspect --format '{{.State.Status}}' "$id" 2>/dev/null || echo missing)
  case "$stt" in
    running|restarting) return 1 ;;
    *) return 0 ;;
  esac
}

image=$(awk -F= '$1=="TWENTY_IMAGE" { print substr($0, index($0, "=") + 1); exit }' "$base/.env")
[ -n "$image" ] || { say clean:refused:image; exit 2; }
[ -f "$bk/s3.js" ] || { say clean:refused:s3; exit 2; }

say clean:server
sid=$(timeout 60 docker compose -p "$install" ps -aq -- server | awk 'NR==1 { print; exit }')
if [ -z "$sid" ]; then
  say clean:server:absent
else
  timeout 120 docker compose -p "$install" stop server || true
  if stopped server; then say clean:server:stopped; else say clean:server:fail; exit 1; fi
fi
say clean:worker
wid=$(timeout 60 docker compose -p "$install" ps -aq -- worker | awk 'NR==1 { print; exit }')
if [ -z "$wid" ]; then
  say clean:worker:absent
else
  timeout 120 docker compose -p "$install" stop worker || true
  if stopped worker; then say clean:worker:stopped; else say clean:worker:fail; exit 1; fi
fi

say clean:files
if [ -f "$rs/attempted.list" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      key\ *) key=${line#key } ;;
      *) continue ;;
    esac
    [ -n "$key" ] || continue
    if ! out=$(s3files delete "$key"); then
      say clean:files:fail
      exit 1
    fi
    case "$out" in
      deleted*) ;;
      *) say clean:files:fail; exit 1 ;;
    esac
    say "clean:deleted:$key"
  done < "$rs/attempted.list"
  say clean:files:ok
else
  say clean:attempted:absent
fi

say clean:restore
if [ -d "$rs" ]; then
  rm -rf "$rs"
  say clean:restore-removed
else
  say clean:restore:absent
fi
say clean:admin
if [ -e "$base/admin.password" ]; then
  rm -f "$base/admin.password"
  say clean:admin-password-removed
else
  say clean:admin:absent
fi
say clean:end
exit 0
CLN1END
sh -n "/opt/$install/backup/clean"
chmod 700 "/opt/$install/backup/clean"
chown root:root "/opt/$install/backup/clean"
printf '%s\n' 'clean:written'
```

`clean-recover`.

The assembled file is 417 code points.
Writer 1 of 1, 707 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/backup/clean-recover" << 'CLR1END'
set -eu
export LC_ALL=C
install=${1:-}
here=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
if [ -z "$install" ]; then
  install=$(basename "$(dirname "$here")")
fi
base=/opt/$install
bk=$base/backup
cd "$base"
ids=$(timeout 60 docker ps -aq --filter "label=backup-twenty=${install}" 2>/dev/null || true)
if [ -n "$ids" ]; then
  timeout 60 docker rm -f $ids >/dev/null 2>&1 || true
fi
rm -f "$bk/files.env" || true
exit 0
CLR1END
sh -n "/opt/$install/backup/clean-recover"
chmod 700 "/opt/$install/backup/clean-recover"
chown root:root "/opt/$install/backup/clean-recover"
printf '%s\n' 'clean-recover:written'
```

`clean-job`. The temp file passed to `start` is its body, byte for byte.

The assembled file is 65 code points.
Writer 1 of 1, 335 code points. `argv` is `/bin/sh`, `-c`, this script, `sh`, and the install name.
```sh
set -eu
export LC_ALL=C
install=$1
umask 077
cat > "/opt/$install/backup/clean-job" << 'CJB1END'
set -eu
export LC_ALL=C
exec /bin/sh "/opt/$1/backup/clean" "$1"
CJB1END
sh -n "/opt/$install/backup/clean-job"
chmod 700 "/opt/$install/backup/clean-job"
chown root:root "/opt/$install/backup/clean-job"
printf '%s\n' 'clean-job:written'
```

One job. Purpose `twenty-restore-clean`, limit 3600, `--stop-post` `/opt/<target>/backup/clean-recover`, `--stop-post-timeout 1200`, operand the target, the script the temp copy of `clean-job`. It counts when the poll class is `succeeded` and the read-back ends `clean:end`. A cleanup that did not count is sent again as a new plan, since every step is safe to repeat.

Then name Deploy Twenty's removal of the target (`skills/Deploy Twenty/`): its full branch when a project container, volume or network remains, otherwise its partial branch.

### What did the job do?

That question is Deploy Twenty's (`skills/Deploy Twenty/`). A backup counts only by Job 2's rule. A recovery counts only by Job 6's rule. The class `succeeded` alone is not the count.

### What did a direct call answer?

That question is Deploy Twenty's (`skills/Deploy Twenty/`). A writer, the list, the enable call, and Job 4 use it. Do not repeat a change call on a failure or an unclear answer.

### What did the re-inspection show?

The outcome classes are Deploy Twenty's (`skills/Deploy Twenty/`). Inspect again with the same inspection script. The person is told it is a read.

Job 1's requested state, after a counted Job 2 and the enable call: `run`, `recover`, `s3.js`, `job`, `config`, `source-id`, `recipient`, `backup.env`, `keygen-helper`, `token-helper`, `key-check`, and `wrapper` are present at the modes this skill sets, owner `0`, the timer is enabled, and the state ends in `end` and contains `restart-verified`.

Job 2's requested state, outside a setup: the state ends in `end` and contains `restart-verified`, and the list script's sha256 matches. The timer is not this job's to enable.

Job 4's requested state is the one its question states. Job 6's requested state is the server healthy and the worker `running`.

- The re-inspection is incomplete, `truncated`, absent, or not a state. Do not claim `changed` or `unchanged`. Report failed, with the change call's outcome and the re-inspection's outcome. Do not repeat the change.
- The requested state holds, and it did not hold in the before-state. `changed`.
- The requested state held before any change call. `unchanged`.
- The requested state does not hold. Failed. Name what the re-inspection shows. Do not repeat the change.

### What does the report say?

One report. For each part: what was inspected, what was planned, the gate's verdict or that no gate was taken, each call's action and its `outcome`, any `exit_code`, the output copied verbatim where the report shows it, the re-inspection, and `changed`, `unchanged`, or failed.

A line that contains `PG_DATABASE_PASSWORD=`, `ENCRYPTION_KEY=`, `FALLBACK_ENCRYPTION_KEY=`, `CLOUDFLARE_API_KEY=`, `EMAIL_SMTP_PASSWORD=`, `RESEND_API_KEY=`, `STORAGE_S3_SECRET_ACCESS_KEY=`, `STORAGE_S3_ACCESS_KEY_ID=`, `S3_SECRET_ACCESS_KEY=`, `S3_ACCESS_KEY_ID=`, `ADMIN_PASSWORD=`, or `AGE-SECRET-KEY-` is withheld, and the report says the line was withheld. A secret value is not a report line. Lengths, booleans, counts, and statuses are.

The report names the install, the bucket, the schedule, the retention, the source id, and the recipient's sha256. It names the newest set's stamp and age, or `no-set`, and `overdue` or `interval-not-derived` when Job 0's rule says so. It names the skip count and the state file's last line. It names a backup's unit, invocation id, limit, whether it counted, the archive sha256 and size, the set prefix, and the measured downtime when both lines were read. It says Redis's queue was not carried. It says a holder of the bucket key cannot read the set without the identity, and that age does not authenticate who made the set. It names every gap that applies. A restore names the target, the set's source id, stamp and `server-url`, each stage reached, the witness's lines, and `changed` or the stage that stopped it. A cleanup names each key it deleted and its last line.

For each job, also: its unit name, its invocation ID and its limit, the last poll's state, the read-back lines the report may show and the line count shown, and the release outcome. A job not read as finished after six polls is reported in the state the last poll that was read showed, or as unknown when none was read.

## Pitfalls

- **The request is ambiguous.** More than one machine, more than one install, a setup and a removal together, or a restore without a named target and set. Ask before any call.
- **A restore sent again.** A restore whose job did not count is never re-sent. Job 7 cleans the target, and Deploy Twenty removes it. A new target is a new restore.
- **A restore onto an install that serves.** The target is Deploy Twenty's install for a restore, which never started. A restore never writes into a running install or into the source's bucket.
- **The identity or the witness's password in the conversation.** Both are typed by the person into a helper over the shell they hold. The FIFO carries them to the job, and nothing writes them to disk.
- **A machine that is not on the map, or whose health is not `ok`.** Stop the way Deploy Twenty stops (`skills/Deploy Twenty/`). Change nothing.
- **The router host.** The role question stops it before any change. Name the gap `skills/Deploy Workload/` declares for a workload on the router host.
- **`age` absent, and a writer sent anyway.** Stop. Hand the package `age` to `skills/VM Configure/`. Write nothing in that run.
- **A script that contains the comment pair Deploy Twenty's Pitfalls names.** Do not send it. Do not read a repeated `vendor_error` on an unchanged script as the machine's answer.
- **A secret in an `argv`, a journal line, or the report.** Withhold the line. Decline a stop that shows a secret. The helpers print a length, a sha256, or `key-check:match` or `key-check:mismatch`.
- **`backup.env`, `.env`, or the identity passed to `cat` in a router call.** Do not. The inspection prints modes, `config`, and `source-id`. The list script passes `--env-file` and prints no credential.
- **A backup cancelled with `systemctl kill`.** Cancel with `systemctl stop` of the unit. The program's exit 143 is what makes `ExecStopPost` run on a signal.
- **Exit 0, or the class `succeeded`, reported as a counted backup.** Job 2's count also needs `end`, `restart-verified`, and the `COMPLETE` sha256 equal to the archive. Job 6's count needs `recovered:ok`, or a cleanup when the restart was already verified.
- **The timer enabled before Job 2 counts.** Do not enable it. The files may stay. Job 4 is the way back, named, not sent, unless the person asks.
- **Job 4 sent while a `vm-job-twenty-backup-*` unit is running.** The script prints `stop-scheduled:refused:running` and removes nothing. Wait, or recover, first.
- **Job 4 described as deleting the bucket.** It removes the timer, the service, the record, and the directory. The bucket is untouched.
- **An overdue backup treated as an alert that was sent.** Report `overdue`. Alerting someone unprompted is missing.
- **A schedule that is not daily, called overdue.** Report `interval-not-derived`. Do not say overdue.
- **Redis's queue expected to come back.** It is not in the set. That is missing. Say so.
- **A second job started while one is loaded.** The loaded-job question is Deploy Twenty's. A running job stops the run. A finished one is released and the run starts over from its inspection, once.
- **A start sent on `tools/vm-job/` 0.2.0, without `--stop-post`.** Stop. The backup needs 0.3.2. Send nothing.
- **A writer longer than 4096 code points, sent or split past the last check.** Do not send it. The last writer is the one that runs `sh -n` or `node --check` and sets the mode.
- **The scheduled service read as a loaded job.** `vmjob-scheduled-twenty-backup.service` does not match `vm-job-*`. The units section is where it is read.
- **A release of a successful backup read as the app being down.** `recover` then sees `restart-verified` and only removes helpers and the work directory.
- **A config-db refusal left with the app stopped.** The program starts `server` and `worker` before it exits. It does not count as a backup.
- **A disk refusal that stopped the app.** Below the need, the program exits before `stopping`.
- **A failure with no `machine`, called a finished backup.** It does not establish whether the router reached the machine. Re-inspect when a read is still possible. Do not repeat the change.
- **The fleet called down.** A router-host failure, or a `list_hosts` `vendor_error`, means connector access to the whole fleet depends on the router host. Installs keep serving.

## Success

- The report covers one machine and one install. A request that named more than one was asked, and nothing was called before the answer.
- The machine was on the map and `vm.inventory.health` was `ok` before any inspection or change. Otherwise the report says not on the map and points to `skills/Prepare VM/`, or names the health outcome the way `skills/VM Inventory/` does, and nothing was changed.
- The router host was stopped before any change, and the report names the gap `skills/Deploy Workload/` declares for a workload on the router host.
- Patterns were refused by name before any call. No secret value was an operand, an argument of a router call, a printed line, or a report line. `backup.env`, `.env`, and the identity were never `cat`ed. The helpers printed a length, a sha256, or a match line.
- The inspection was one `vm.command.run`, the person was told it is a read, and the install name was the operand. It carried both token lines. A loaded job was handled by Deploy Twenty's loaded-job question before any decision to change.
- The run acted only on an install whose marker held the lines Deploy Twenty's Job 2 marker question requires. Any other install was not changed.
- `age` absent stopped the run and handed the package `age` to `skills/VM Configure/`. No writer was sent in that run.
- A change was sent only after `experts/DevOps Expert/` returned safe as planned, or safe with named conditions the person was told, and only after the person approved that call's stop. Job 0 and a standalone Job 5 took no gate.
- Job 1's confirmation named the install, the bucket, and the schedule. The person ran `keygen-helper` and `token-helper` over the shell they hold. Job 5 printed `key-check:match` before `run`, `recover`, `s3.js`, `job`, and the units were written. The identity was not copied into the conversation.
- Every `argv` element was at most 4096 code points. A longer file was written by the writers listed with that file, the last of which checked the assembled file and set its mode. The wrapper and the units were the texts `vm-job scheduled` printed, or the run stopped because the tool did not print them.
- Job 2 was one job, purpose `twenty-backup`, limit 3600, with `--stop-post` on `recover` and `--stop-post-timeout 1200`. It counted only on `succeeded`, a state ending in `end` with `restart-verified`, and `COMPLETE` read back with its sha256 equal to the archive. The timer was enabled only after that count, with `systemctl enable --now` on the timer, and the re-inspection showed the next elapse.
- Job 4 ran only after the person named the install, refused a running `vm-job-twenty-backup-*` unit, and removed the units, the record, and the directory. The re-inspection showed the units not loaded and the directory gone. Nothing in the bucket was deleted.
- Job 6 was the recovery rule as a job. A `recovered:fail` did not count. The way back named was Job 6 again.
- A restore ran only onto a target Deploy Twenty made for a restore, with an empty files bucket that was neither the source's nor the backup bucket, after the person confirmed the set's source id, stamp and `server-url`. The identity and the witness's password reached the job through FIFOs from helpers the person ran. It counted only on every stage line through `end`, `witness:kid:match` and `file:match` included. A restore that did not count was not re-sent: Job 7 cleaned the target, deleting only the keys the restore attempted, and Deploy Twenty's removal was named.
- The report names the recipient sha256, the source id, the newest set's age, overdue or not, the skip count, the last state, whether a backup counted, the measured downtime when both lines were read, that Redis's queue was not carried, and every gap that applies.
- DNS was handed to `experts/IT Expert/` in `wiser`. A package was handed to `skills/VM Configure/`. An install, a route, or a removal was handed to `skills/Deploy Twenty/`.
