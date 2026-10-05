---
name: Deploy Workload
type: skill
category: operations
description: Deploy one container to one machine a person's router maps, behind a Caddy the skill runs there, through targeted admin-API updates, or remove one it deployed, and report the URL it serves and whether it answered, through a router the person already runs
version: 0.1.0
gaps:
  - a router this plugin does not ship, which every deploy goes through
  - a workload on the router host, where Caddy has not been measured beside the router's own public origin
  - a workload that needs a secret, a private registry login, a host directory, or more than one container
  - changing a deployed workload's image or settings in place
  - the provider firewall rule and the DNS record a public URL needs, which no guest can set
  - installing Docker on a distribution other than Ubuntu, or on a machine that already forwards IPv4 traffic
  - IPv6 ingress
  - installing Docker or pulling an image on a machine whose systemd is older than 254, which a background job needs
---

# Deploy Workload

## Context

Use when one container should be deployed on one existing machine, or one container this skill deployed there should be removed, and the machine is one a person's router maps. One run is one machine and one workload. The workload publishes no port. Caddy, one container per machine, is the only publisher, and a route is one targeted admin-API update. The report says what was inspected, what was planned, what the gate said, what each call answered, the URL, and whether that URL answered.

Not for a workload on the router host. That is the gap for a workload on the router host, where Caddy has not been measured beside the router's own public origin. Not for a secret, a private registry login, a host directory, or more than one container. Not for changing a deployed workload's image or settings in place. Not for a configuration file. That is the gap `experts/DevOps Expert/` still declares. The one configuration write this skill makes is Docker's apt source and key, and only as the install branch of a deploy on a machine that has no Docker. This skill never calls `vm.files.write_file` or `vm.files.read_file`. Not for enrolling a machine or taking one out, which is `skills/Prepare VM/`. Not for reading the fleet, which is `skills/VM Inventory/`. Not for a package or a unit with no workload, which is `skills/VM Configure/`. Not for a security review. Not for IPv6 ingress. Not for the provider firewall rule or the DNS record a public URL needs. Hand the DNS part to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`.

This plugin does not ship a router, and no primitive in this root provides one. Every deploy goes through a router the person already runs. The calls are `vm.inventory.list_hosts`, `vm.inventory.health`, and `vm.command.run`, and no other action.

An image pull, and both steps of installing Docker, run as tracked background jobs. The contract is `tools/vm-job/`. A job's start, poll, read-back, journal read and release are each built with that tool's command and sent as one `vm.command.run` whose `argv` is the `argv` the tool prints, unchanged. Each answer is saved and classified with that tool's `classify`. The session never writes a starter or a release script itself. A short Docker command, an admin-API call, and a curl that checks the URL are `vm.command.run`. They are not jobs. They do not take the lock and they do not renew the token.

The job script, written verbatim from this skill, each direct script, written verbatim from this skill, and each saved answer, go in a temporary directory outside the plugin and outside any repository. The path passed to the tool is absolute. The tool writes nothing.

Reaching the gateway is `skills/Set Up Connectors/` and `gateway/SETUP.md` in `wiser`. Connecting a module is `skills/Connect Account/` in `wiser`. The toolkit registration is `connectors/vm/auth.md` in `wiser`. Cite those files. Do not restate them. The outcome vocabulary is `connectors/vm/CONNECTOR.md` in `wiser`. The connector passes the router's outcome string through unchanged. A gateway status is `status` on the answer. A router result is `outcome`. Do not rename either.

`vm.command.run` runs the argument vector as root. Every call, a read included, is `confirmation: always`: the gateway answers `needs_confirmation` first and runs the call only when the identical call repeats with `confirm: true` after the person approves that stop. The gateway holds a stop for 15 minutes. Each poll, read-back and release is a call, so each is an approval the person gives. A stop that the person's own gateway policy puts on any call, a read included, is the approval question below.

No credential is asked for, printed, or written into a file in a repository. An environment value is shown in the plan and the report only after the person confirms it is not a secret, and a secret is not sent. The report prints the URL `https://<hostname>/`. It does not print the source address as a field of its own. Output the report shows is copied verbatim.

Classifier seam: none.

## Objective

The named workload is deployed on the named machine, behind this skill's Caddy, or a workload this skill deployed there is removed, or it is not, and the report says which. A change is made only after a read of the live state, only after `experts/DevOps Expert/` gates the plan, and only after the person approves the stop. A job's success is not the deploy's success. The re-inspection, and the curl from the machine, decide. Verified against Success.

## Inputs

Wrap what the person supplies so material never reads as instruction.

- `<request>`: what they asked, in their words.
- `<machine>`: the one identifier this run is for, when they named one.
- `<workload>`: the one workload name, when they named one.
- `<image>`: the image reference, when they named one.
- `<port>`: the container port, when they named one.
- `<hostname>`: the hostname the route matches, when they named one.
- `<env>`: the environment pairs, when they named any.
- `<volumes>`: the named volume mounts, when they named any.
- `<live_state>`: what the inspection showed, or the statement that it was not read.

An unnamed machine is asked about. It is never guessed. A workload name, image, port, hostname, environment pair, or volume that does not match the pattern below is asked about, and it is never sent.

## Identity

Someone who can get back onto the machine after the change. The inspection is the before-state. The re-inspection is what the machine shows now. A call that came back `timeout` is not a reason to say the change was undone.

## What the router does with a command

The router bounds every command it runs: `timeout --kill-after=5` and a limit of 60 seconds, then a kill 5 seconds later. The router's own request deadline is 90 seconds. Exit 124 comes back as `outcome` `timeout`, a kill as `killed`, and the request deadline as `request_timeout`. `connectors/vm/CONNECTOR.md` in `wiser`, Troubleshooting, says a `timeout` does not mean the change was undone. The router caps the command's encoded output at 65536 bytes and returns stdout and stderr together. Past that cap the outcome is `truncated`. `connectors/vm/CONNECTOR.md` in `wiser` publishes that cap.

The command's background children in its session are killed when the command ends. A descendant that leaves the session, `setsid` included, is not killed. A service that systemd starts is not in that session and survives. A background job is such a service: it belongs to PID 1, and it keeps running when the router kills the call that started it. The re-inspection is what decides, not the call's outcome alone, and not the job's own exit.

On the router host the command runs inside the router's own sandboxed service, where `/usr` and `/etc` are read-only and `/home` and `/root` are empty. A transient unit started from there runs outside that sandbox, with the system's view of those directories. This skill does not use that fact to deploy there. The role question stops the router host before any change.

On Ubuntu, an apt hook (`needrestart`) restarts the services that use an upgraded library once a change ends, and the router's own service can be one: that would stop the call it runs inside. The hook does nothing when `NEEDRESTART_SUSPEND` is set. The starter the tool emits sets `NEEDRESTART_SUSPEND=1` and `DEBIAN_FRONTEND=noninteractive` on every job, so the job script does not set them. A service still using an old library is then the person's to restart, as a unit request of its own, through `skills/VM Configure/`.

`busy` means the router was at its concurrency limit and the machine was not asked. `vendor_error` does not establish whether the call ran. A failure outcome whose answer carries no `machine` does not establish whether the router reached the machine. `remote_failure` carries the command's `exit_code` and its `output` when the command ran.

Call one action at a time. Do not start the next call until this call's answer is classified.

## Steps

Which job is this? Take the first match.

- The request asks to enroll a machine or to take one out. Hand that part to `skills/Prepare VM/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a hostname, a DNS record, or a zone, and names no workload to deploy and no workload to remove. Hand that part to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks to read the fleet, or whether a machine is reachable, and names no workload. Hand that part to `skills/VM Inventory/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a configuration file. Say that this skill does not change one, and that the gap `experts/DevOps Expert/` still declares is a configuration file. Docker's apt source and key are not this case. They are the install branch of a deploy, below. Do not send a command that writes any other file. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a package change or a unit change, and names no workload. Hand that part to `skills/VM Configure/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a security review. Say that this skill does not do that part. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a secret, a private registry login, a host directory, or more than one container. Stop. Name the gap for a workload that needs a secret, a private registry login, a host directory, or more than one container. Send nothing.
- The request asks to change a deployed workload's image or settings in place, to recreate it, or to redeploy it. Stop. Name the gap for changing a deployed workload's image or settings in place. Name Job 2. Do not change it. Send nothing.
- The request asks to install Docker and names no workload. Ask whether a deploy is the request. Do not install Docker with nothing to deploy. Do not guess. Do not call.
- The request asks to remove one named workload and names no deploy. Job 2.
- The request asks to deploy one workload and also to remove one. Ask which this run is for. Do not guess. Do not call.
- The request names more than one workload. Ask which one this run is for. One run is one workload. Do not guess. Do not call.
- The request asks to deploy one workload. Job 1.
- The job cannot be read. Ask. Do not guess. Do not call.

### Which machine is this run for?

- The request names one identifier, or names the router host and no identifier. That is the machine. An identifier named more than once is one machine.
- The request names the router host and also an identifier. Ask which machine this run is for. Do not call.
- The request names more than one identifier, or names a fleet, or narrows the machines by anything other than one identifier or the router host. Ask which one machine this run is for. One run is one machine. Do not call.
- No machine can be read. Ask. Do not guess. Do not call.

The identifier has to match `^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$`, the `machine` pattern `connectors/vm/CONNECTOR.md` in `wiser` publishes. A name that does not match: ask for one that does. Do not send the other form.

### Do the inputs match, before any call?

Refuse a value by name before `vm.inventory.list_hosts`. Do not send the other form. Ask for one that matches.

The workload name matches `^[a-z][a-z0-9-]{1,31}$`, and it is not `caddy`. Job 1 and Job 2 both require it.

Job 1 also requires an image, a port, and a hostname.

- The image has no whitespace and is at most 255 characters. It is a Docker reference: lowercase name components separated by `/`, an optional registry host with an optional `:port` before the first `/`, an optional tag matching `^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$`, and an optional `@sha256:` followed by 64 lowercase hex digits. A reference with no `/` is a Docker Hub name. Anything else does not match.
- The port is a whole number from 1 to 65535, written in digits, with no sign and no leading zero.
- The hostname matches `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`, is at most 253 characters, and contains a letter. A name with no dot does not match.
- Each environment pair is `KEY=VALUE`. The key matches `^[A-Z0-9_]+$`. The value is one line: no newline. The whole pair is at most 4096 code points. Zero pairs is a match.
- Each volume is `<named volume>:<absolute container path>`, one colon. The named volume matches `^[A-Za-z0-9][A-Za-z0-9_.-]*$` and contains no `/`. The container path matches `^/[A-Za-z0-9._/-]*$`. A source that contains `/`, starts with `.`, or is absolute is a host path and does not match. A mode suffix does not match. Zero volumes is a match.
- Job 1's environment pairs and volumes together are more than 25. Stop. The workload `docker run` argv is 13 strings plus two per pair, and `connectors/vm/CONNECTOR.md` in `wiser` bounds `argv` at 64 strings, so more than 25 does not fit one call. Ask which this run includes, 25 or fewer. Do not choose. Do not add a pair that was not named. No answer: stop. Send nothing.

Job 2 has no image, port, hostname, environment, or volume. A Job 2 request that includes one: ask whether the request is a removal. Do not send the extra value. Do not guess.

### What did `vm.inventory.list_hosts` answer?

Call it with `{}` before any other call. Do not retry this call, except the one re-read the `unknown_machine` question names.

- `outcome` is `ok` and `hosts` is a list. Continue.
- `outcome` is `ok` and `hosts` is empty. The map holds no machine. Point to `skills/Prepare VM/`. Stop. Change nothing.
- `status` is `needs_confirmation`. The approval question. Take the repeated call's answer as this call's answer.
- `status` is `needs_provider_capability` and the message says this connector is not offered on the hosted endpoint. Change nothing. The route is the local gateway in a command-line harness, through `skills/Set Up Connectors/` and `gateway/SETUP.md` in `wiser`. Do not say the endpoint will never offer the connector. Stop.
- `status` is `needs_connect`, `denied`, or `vendor_error`, or any other gateway status. Change nothing. Hand that status to `skills/Connection Troubleshooter/` in `wiser` for its one next step. On `needs_connect`, the module is the one the answer names, and `inventory` when it names none. On `vendor_error`, say that connector access to the whole fleet depends on the router host. Do not say the fleet is down. Workloads keep serving while the router is unreachable. Stop.
- Any other answer. Change nothing. Name the `outcome` or the `status` verbatim. Do not call the map empty. Do not retry. Stop.

### Is this machine on the map?

- The machine is an identifier and one `hosts` entry has that `id`. That entry is the machine. Continue.
- The machine is the router host and one entry has `self` boolean true. That entry is the machine. Its `id` is the identifier from here on. Continue.
- The machine is the router host and no entry has `self` boolean true. Say the map marks no router host. Stop. Change nothing.
- The identifier is absent. It is not on the router's map. Point to `skills/Prepare VM/`. Do not call `health`. Do not call it unreachable. Stop.

### Does this `health` answer get retried?

Call `vm.inventory.health` with `machine` set to the identifier. Reachability has to be established before any other call on the machine. The classes below are the ones `skills/VM Inventory/` reports. Do not change a machine whose reachability is not established.

- `status` is `needs_confirmation`. The approval question, then ask this question of the repeated call.
- `outcome` is `busy`, `timeout`, `connect_timeout`, `request_timeout`, `killed`, or `remote_failure`, or `status` is `vendor_error`, and this call has been retried fewer than three times. Wait a few seconds. Call it again. Ask this question of the new answer.
- Three retries have been made, or the answer is anything else. Do not retry. Classify the latest answer.

### Which health class is the latest answer?

- `outcome` is `ok`. Reachable. Continue.
- `outcome` is `timeout`, `connect_timeout`, `request_timeout`, `killed`, or `remote_failure`, and the answer names this identifier in `machine`. Unreachable. Name the outcome and any `exit_code`. Stop. Change nothing.
- One of those outcomes, and the answer carries no `machine`. Not determined. The answer does not establish whether the router reached the machine. Name the outcome and any `reason`. Stop. Change nothing.
- `outcome` is `busy`. Not determined. The machine was not asked. Stop. Change nothing.
- `status` is `vendor_error`. Not determined. The answer did not establish whether the machine was asked, or what it answered. Stop. Change nothing.
- `outcome` is `unknown_machine`. Do not retry. Read `vm.inventory.list_hosts` once more, and take the next question.
- `status` is `invalid_arguments`. Not determined. The connector sent nothing. Stop. Change nothing.
- Any other `outcome` or `status`. Not determined. Name it verbatim. Stop. Change nothing.

### What did the second `list_hosts` show?

Ask only after `health` answered `unknown_machine`.

- The identifier is absent. It left the map during the run. Point to `skills/Prepare VM/`. Stop. Change nothing.
- The identifier is still listed. Not determined. Name the contradiction: the map lists it and `health` answered `unknown_machine`. Stop. Change nothing.
- The re-read did not answer a list of hosts. Not determined. Name its `outcome` or `status` verbatim. Stop. Change nothing.

### What is the role?

Read the `hosts` entry.

- `self` is boolean true. Router host. Stop. Name the gap for a workload on the router host, where Caddy has not been measured beside the router's own public origin. Change nothing.
- `self` is any other value, or it is absent. Fleet member. Continue.

When the row is the router host and health was unreachable, that stop already said that connector access to the whole fleet depends on the router host. Do not say the fleet is down.

### Did a call stop for approval?

`vm.command.run` stops on `needs_confirmation` before it runs. Any other call stops there when the person's gateway policy asks to approve it. `skills/Connection Troubleshooter/` in `wiser` owns that stop: it shows the stop, and it repeats the identical call with `confirm: true` only after the person approves that stop, once.

Before handing over the inspection, a poll, a read-back, a journal read, a socket read, a config or routes read, the verify read, a logs read, or the curl that checks the URL, tell the person the call is a read. Before handing over a release, tell the person it unloads the finished job and removes no log.

- The stop is the call this step sent. Hand it over. Take the repeated call's answer as this call's answer.
- The stop is some other call. Do not confirm it. Stop. Name the difference. Change nothing further.
- The person declines a read that this run needed before any change call. Make no further call. Nothing was changed. Deliver the report of what was read before the decline.
- The person declines a poll or a read-back after a job has started. Make no further call. Report the unit name, the invocation ID and the limit, and that asking again later reads the result through the second-run rule. Do not claim `changed` or `unchanged`.
- The person declines a release. Make no further call. The read-back stands. The job stays loaded. Do not claim `changed` or `unchanged`. A later run releases it through the second-run rule.
- The person declines a change call, the start of a job included. Make no further call. An earlier change in this run keeps the result its re-inspection gave it. Nothing changed after the decline. Deliver the report.

### What did the inspection answer?

One `vm.command.run`, a read, with `machine` set to the identifier and `argv` exactly `/bin/sh`, `-c`, the script, `sh`, and the workload name. The workload name is an operand. It is never written into the script. The person is told the call is a read. Its only redirection discards what `command -v` prints. `<script>` is this text and no other:

```
export LC_ALL=C
printf '%s\n' '--- os-release ---'
awk -F= '$1 == "ID" || $1 == "VERSION_CODENAME" { print }' /etc/os-release
printf '%s\n' '--- token ---'
if [ -r /run/vm-job.token ]; then cat /run/vm-job.token; else printf '%s\n' none; fi
printf '%s\n' '--- jobs ---'
systemctl list-units --all --plain --no-legend 'vm-job-*'
printf '%s\n' "jobs-exit:$?"
printf '%s\n' '--- systemd ---'
systemctl --version
printf '%s\n' '--- dpkg audit ---'
dpkg --audit
printf '%s\n' "dpkg-audit-exit:$?"
printf '%s\n' '--- docker ---'
if command -v docker >/dev/null 2>&1; then
  docker version --format 'server:{{.Server.Version}}'
  printf '%s\n' "docker-version-exit:$?"
else
  printf '%s\n' docker-absent
  printf '%s\n' docker-version-exit:127
fi
printf '%s\n' '--- forwarding ---'
if [ -r /proc/sys/net/ipv4/ip_forward ]; then
  printf '%s\n' "ip_forward:$(cat /proc/sys/net/ipv4/ip_forward)"
else
  printf '%s\n' ip_forward:unread
fi
for f in /proc/sys/net/ipv4/conf/*/forwarding; do
  if [ -r "$f" ]; then printf '%s:%s\n' "$f" "$(cat "$f")"; else printf '%s\n' "unread:$f"; fi
done
printf '%s\n' '--- source ---'
ip -4 -o route get 192.0.2.1
printf '%s\n' "source-exit:$?"
printf '%s\n' '--- caddy ---'
if command -v docker >/dev/null 2>&1; then
  docker inspect --format '{{.State.Status}} {{index .Config.Labels "deploy-workload"}} {{json .HostConfig.PortBindings}}' caddy
  printf '%s\n' "caddy-inspect-exit:$?"
else
  printf '%s\n' caddy-not-read
  printf '%s\n' caddy-inspect-exit:127
fi
printf '%s\n' '--- socket ---'
if [ -S /var/lib/caddy-admin/admin.sock ]; then
  printf '%s\n' socket-present
  printf '%s\n' '--- config ---'
  curl -sS -D - --max-time 10 --unix-socket /var/lib/caddy-admin/admin.sock http://localhost/config/
  printf '%s\n' "config-exit:$?"
  printf '%s\n' '--- routes ---'
  curl -sS -D - --max-time 10 --unix-socket /var/lib/caddy-admin/admin.sock http://localhost/config/apps/http/servers/workloads/routes
  printf '%s\n' "routes-exit:$?"
else
  printf '%s\n' socket-absent
fi
printf '%s\n' '--- workload ---'
if command -v docker >/dev/null 2>&1; then
  docker inspect --format '{{.State.Status}} {{index .Config.Labels "deploy-workload"}}' -- "$1"
  printf '%s\n' "workload-inspect-exit:$?"
  printf '%s\n' '--- network ---'
  docker network inspect --format '{{index .Labels "deploy-workload"}}' -- "wl-$1"
  printf '%s\n' "network-inspect-exit:$?"
else
  printf '%s\n' workload-not-read
  printf '%s\n' workload-inspect-exit:127
  printf '%s\n' network-inspect-exit:127
fi
printf '%s\n' '--- listeners ---'
ss -lnt
printf '%s\n' "listeners-exit:$?"
printf '%s\n' '--- token after ---'
if [ -r /run/vm-job.token ]; then cat /run/vm-job.token; else printf '%s\n' none; fi
exit 0
```

`192.0.2.1` is the probe the route lookup uses. The source address is the field after `src` on that line. It is not a destination this skill serves.

Classify the answer after the approval question.

- `status` is `needs_confirmation`. The approval question. Take the repeated call's answer and ask this question again.
- `outcome` is `ok`, or `outcome` is `remote_failure` and the answer names this identifier in `machine`, and `output` contains every marker `--- os-release ---`, `--- token ---`, `--- jobs ---`, `--- systemd ---`, `--- dpkg audit ---`, `--- docker ---`, `--- forwarding ---`, `--- source ---`, `--- caddy ---`, `--- socket ---`, `--- workload ---`, `--- listeners ---`, and `--- token after ---`, and the `jobs-exit:` line, and a line after `--- token ---` and after `--- token after ---`, and `truncated` is not true. Take the token question.
- `outcome` is `truncated`, or a marker is missing, or `output` is absent. The inspection is incomplete. Stop. Name the outcome. Change nothing.
- `outcome` is `timeout`, `killed`, `request_timeout`, `busy`, or `vendor_error`, or a failure outcome with no `machine`. Not a machine state. Name it. On `busy`, the machine was not asked. On `vendor_error`, or on a failure with no `machine`, the answer does not establish whether the call ran. Stop. Change nothing. Do not repeat the inspection.
- Any other answer. Name the `outcome` or the `status` verbatim. Stop. Change nothing.

### Did the token hold across the inspection?

The token is the line after `--- token ---`. The token after is the line after `--- token after ---`. Each is the file's text, or `none`.

- They are equal. That is the token the plan carries. Continue.
- They differ, and this run has not yet inspected again for this reason. A job started or was released while the inspection ran, so what it read may be stale. Inspect again. Nothing was changed.
- They differ again. Stop. Change nothing.

### Is a job already loaded?

Ask when the token question continued, before the stops below. Ask it again when this run starts over from its inspection. The jobs section is the text between `--- jobs ---` and the line `jobs-exit:`. It is empty when every character in it is whitespace. A unit's name is the first field of its line, with a trailing `.service` removed. One poll here is the tool's `poll` with `--wait 0`. Save the answer in the temporary directory and classify it with `classify --step poll` and no `--recorded`. The person is told the poll is a read. `needs_confirmation` is the approval question, taken before classify. A gateway status other than `needs_confirmation` and other than `vendor_error` is the gateway bullets in "What did a direct call answer?", with the module `command`, and it is not a poll class. Take the first match.

- This run has already started over from its inspection once, and the jobs section is non-empty or `jobs-exit` is not 0. Stop. A job is still loaded. Change nothing.
- `jobs-exit` is not 0. The list was not read. Stop. Change nothing.
- The section is empty and `jobs-exit` is 0. No job is loaded. Continue.
- More than one unit line. Stop. Name each. Change nothing.
- One unit line. Poll it once. Take the next question.

### What did that one poll read?

The class `other-invocation` does not apply: nothing was recorded, and the facts carry the invocation ID the poll read, for this poll to adopt. Take the first match.

- The class is `not-read`. Stop. Name the outcome. Change nothing. This class is a router result that was not read. It is not a `needs_confirmation` stop.
- The class is `running` or `deactivating`. Say so. Name the unit. Change nothing. Stop.
- The class is `stuck`. Stop. Change nothing. Do not release it. It is the person's, over the provider's console.
- The class is `succeeded`, `signal`, `failed-exit`, `failed-timeout`, or `failed-other`. Adopt the invocation ID the facts carry. Read it back by that ID: the tool's `readback`, sent as the `argv` it prints, unchanged. Classify the read-back. A class `truncated` is read again with fewer lines, and the report names the line count in the facts. A class `not-read` says the read-back was not read. The person is told the read-back is a read. Release it with that ID: the tool's `release`, sent as the `argv` it prints, unchanged. Tell the person the release unloads the finished job and removes no log. Classify the release. The class `released`: report it as an earlier run's result, then start this run over from its inspection. The plan and the gate use the new inspection and its token. This start-over happens at most once. Any other release class: stop, the job is still loaded, change nothing, and do not start over.
- The class is `not-loaded`. The unit left between the list and the poll. Start this run over from its inspection, at most once. A journal class `no-entries` is not proof it did not run.
- The class is `unrecognized`. Stop. Name the facts. Change nothing.

A loaded unit carrying this run's own name, after a start whose answer was lost, is the job question below. It is this run's job. Poll it there.

### What is Docker on this machine?

Read the docker section. The server version is the text after `server:` on that line.

- The section says `docker-absent`. Docker is absent. Continue to the install-branch question. Do not read the caddy, workload, or network sections as container state.
- `docker-version-exit` is 0 and the server line has a version. Docker is present. That version is the one the report names. Continue to the source question. Do not install Docker.
- The command is present and the exit is not 0, or the server line has no version. Docker did not answer. Stop. Copy the docker section. Do not install over it. Change nothing.

### Does the install branch apply?

Ask only when Docker is absent.

The audit section is non-empty when it has a character that is not whitespace, or when `dpkg-audit-exit` is not 0. The `ID` line is read with one layer of matching quotes stripped. The systemd section's first line is `systemd <version>` followed by more text. Forwarding is off when the line is `ip_forward:0` and every other forwarding line ends in `:0`.

Take the first match.

- The audit section is non-empty, or `dpkg-audit-exit` is not 0. Stop. Copy the audit section. The repair is the person's, over the provider's console. Send nothing.
- `ID` is not `ubuntu`. Stop. Name the gap for installing Docker on a distribution other than Ubuntu, or on a machine that already forwards IPv4 traffic. Copy the `ID` and `VERSION_CODENAME` lines. Change nothing.
- No `ID` line. Stop. Say the distribution could not be read. Change nothing.
- The systemd version is lower than 254, or the line cannot be read. Stop. Name the gap for installing Docker or pulling an image on a machine whose systemd is older than 254. Copy the line. Change nothing.
- A forwarding line ends in anything other than `:0`, or a line says `unread`. A `:1` names the gap for installing Docker on a distribution other than Ubuntu, or on a machine that already forwards IPv4 traffic. An `unread` line means forwarding was not read: stop, and do not claim the machine forwards. Copy the forwarding section. Change nothing.
- `ID` is `ubuntu`, the systemd version is 254 or more, and forwarding is off. The install branch is in the plan. Continue to the source question.

### Can this machine pull an image?

Ask when Docker is present, before any pull. The same systemd line as the install branch.

- The version is a whole number of 254 or more. Continue.
- It is lower, or the line cannot be read. Stop. Name the gap for installing Docker or pulling an image on a machine whose systemd is older than 254. Copy the line. Change nothing.

### What is the source address?

The source line is the `ip` output. The address is the field immediately after the first `src`. Each of its four numbers is from 0 to 255.

- `source-exit` is 0 and that field is an address. That is `<addr>`. Publish only on it. Continue.
- Anything else. The source address was not read. Stop. Change nothing. Do not publish on every address.

### What is Caddy on this machine?

Ask when Docker is present. The caddy line's first field is the status. The second field is the label, unless it is empty or `<no value>` or starts with `{`, in which case there is no label. The JSON is the remainder, from the first `{`. The socket section says `socket-present` or `socket-absent`. Our published ports are exactly two keys, `80/tcp` and `443/tcp`, each with one binding, `HostIp` the source address, `HostPort` `80` and `443`. Take the first match.

- `caddy-inspect-exit` is not 0 and the section contains `No such object`, and the socket says `socket-absent`. Caddy is not present. The plan creates it when the listener question allows.
- `caddy-inspect-exit` is not 0 and the section contains `No such object`, and the socket says `socket-present`. Stop. A socket with no container named `caddy` is not this skill's. Change nothing.
- The label is not `caddy`. Stop. The container named `caddy` is not this skill's. Change nothing.
- The ports JSON is missing or is not exactly our published ports. Stop. Name the ports. It is not this skill's. Change nothing.
- The label is `caddy`, the ports match, and the socket says `socket-absent`. Stop. Name the status. A Caddy with no socket is not one this run uses, a stopped container of ours included. This run does not start it. Change nothing.
- The label is `caddy`, the ports match, and the socket says `socket-present`. This skill's Caddy. The plan uses it and does not create another.

A caddy section that is `caddy-not-read` is the Docker-absent case. Do not apply this question there.

### What did the config and the routes show?

Ask when the socket says `socket-present`. The config body is the text after the blank line that ends the `--- config ---` headers. It is null when its only non-whitespace is `null`. The routes body is the text after the blank line that ends the `--- routes ---` headers. Read it as JSON when `routes-exit` is 0. A hostname is present when some element's match list has a host array containing it. The id `workload-<name>` is present when some element's `@id` is that string.

- `config-exit` is not 0, or no `Etag` header was in the config headers. The config was not read. Stop. Change nothing.
- The config body is null. No route exists yet. A routes read that failed is that absence. The plan's first config applies, and only because this read was null. Continue.
- The config body is not null, and the routes body is JSON, and neither the Job 1 hostname nor the id is present. Continue. The plan does not send a first config.
- The config body is not null, and the routes were not JSON or `routes-exit` is not 0. The routes were not read. Stop. Change nothing.
- Job 1, and the hostname or the id is present. Stop. The hostname is already in a route, or this workload's route is already there. Name the gap for changing a deployed workload when the container question also says it is ours. Otherwise say the hostname is already routed. Name Job 2 when the id is present. Change nothing.
- Job 2, and the routes were read. Continue. The removal uses a fresh GET of the id, not this Etag.

### What holds ports 80 and 443?

Read the listeners section. `listeners-exit` not 0 means the listeners were not read: stop, change nothing. A listener holds the source address on 80 or 443 when its local address is `<addr>`, `0.0.0.0`, or `*` and the port is 80 or 443. A different address, a tailnet address included, does not. An `[::]` listener is named in the report and is not this stop. IPv6 ingress is the gap named in the report.

- This skill's Caddy is in the plan as already present, and the only listeners that hold the source address on 80 and 443 are the two its ports publish. Continue.
- Caddy is not present, and no listener holds the source address on 80 or 443. Continue. The plan binds those two, on `<addr>` only.
- Any other hold. Stop. Name the listeners. Something other than this skill's Caddy holds the port. Change nothing.

### What is the workload name on this machine?

Ask when Docker is present. The workload line is read the way the caddy line is. The network section's text is the label, or empty, or `<no value>`. Take the first match.

- `workload-inspect-exit` is not 0 and the section contains `No such object`, and `network-inspect-exit` is not 0 and the section contains `No such network`. The name is free. Job 1 continues. Job 2: the container is already absent. Continue to the route question Job 2 already took.
- The container exists and its label is the workload name. Job 1: stop. Changing it is the gap for changing a deployed workload's image or settings in place. Name Job 2. Do not change it. Job 2: this skill's workload. Continue.
- The container exists and its label is not the workload name. Stop. The name is taken. Do not remove it. Change nothing.
- The container is absent and the network exists, and its label is the workload name. Job 1: stop. A partial deployment is present. Name Job 2. Change nothing. Job 2: continue, and remove that network after the route question.
- The container is absent and the network exists, and its label is not the workload name. Stop. The name is taken. Change nothing.
- The inspect was not read. Stop. Copy the section. Change nothing.

### Is any environment value a secret?

Ask on Job 1 when the stops above did not stop, and only when there is at least one pair. Show every `KEY=VALUE`. Ask the person to confirm that none is a secret.

- The person says none is a secret. The plan and the report may show them. Continue.
- The person says one is a secret, or does not answer. Stop. Name the gap for a workload that needs a secret. Send nothing. Do not put the value in the plan.

### What does the plan contain?

One plan, the calls that apply, in this order. A call that the questions skipped is not in the plan. The plan names the machine, the role, the inspection verbatim, every call, and the way back.

1. The repository job, only when the install branch applies. Purpose `docker-repo`, limit 600, no operands, the script below. It writes `/etc/apt/keyrings/docker.asc` and `/etc/apt/sources.list.d/docker.sources`. That pair is the one configuration write this skill makes. The way back for it is the person's. This skill does not remove Docker or those files.
2. A re-inspection, then the install job, only when that simulation is the allowed install below. Purpose `docker-install`, limit 1800, operands the pinned `Inst` lines.
3. A pull of `caddy:2`, only when Caddy is not present. Purpose `docker-pull`, limit 1800, the reference the operand.
4. The Caddy run below, from that pull's digest, only when Caddy is not present. Then the socket read, a GET of `/config/`, and the first-config POST only when that GET's body is still null.
5. A pull of the workload image. Purpose `docker-pull`, limit 1800. When the reference is `caddy:2` and this run already pulled it, reuse that digest and do not pull again.
6. The network script, then the workload `docker run`, then the verify read.
7. When the verify shows the container running and an `HTTP/` line: `docker update --restart unless-stopped`. When it does not: `docker logs --tail 50`, and stop. No route. Name Job 2. Do not remove the container in this run.
8. GET the routes, then POST the one route with that response's `Etag` as `If-Match`.
9. The curl from the machine, then a closing re-inspection.

Job 2's plan is the removal order in its own question, not this list.

The way back for the workload is Job 2, named and not sent in this run. The way back for a Caddy this plan creates is `docker rm -f caddy`, with the volumes `caddy-config` and `caddy-data` kept, and `/var/lib/caddy-admin` kept, named and not sent unless the person asks, and then it is a new plan, gated again. The way back for Docker is the person's.

A re-inspection between two planned jobs reads the token the next start uses. The calls stay the ones this plan named. A re-inspection whose facts change a later call, a token renewal alone excluded, stops. The changed calls are a new plan, gated again. Do not start them on the old gate.

### What may the install pin?

Ask of the repository job's read-back, after that job is released and before the install job. On an `Inst` line the installed version is the field in square brackets and the candidate is the first field inside the parentheses. The allowed names are `containerd.io`, `docker-ce`, `docker-ce-cli`, `docker-ce-rootless-extras`, `docker-buildx-plugin`, `docker-compose-plugin`, and `pigz`.

- The job's class is not `succeeded`, or `simulate-exit` is not 0, or the read-back has no summary line. Stop. Copy the read-back. Do not install. The repository files may already be written. Say so. Their way back is the person's.
- The summary line does not begin with `0 upgraded, <N> newly installed, 0 to remove`, read as whole numbers, where `<N>` is the count of `Inst` lines and is at least 1. Stop. Copy the section. Do not install.
- An `Inst` line has no candidate, names a package outside the allowed set, or `docker-ce`, `docker-ce-cli`, or `containerd.io` has no `Inst` line. Stop. Name the difference. Do not install.
- More than 56 `Inst` lines. Stop. The start admits at most 56 operands. Do not choose.
- All of those hold. The operands are every `Inst` name pinned to its candidate, `<name>=<candidate>`. Continue. The install job is the one the plan named.

### Is the plan gated?

A run whose inspection shows nothing to change writes nothing and takes no gate. Job 1 always has a change when it reaches this question. Job 2 takes this question only when a removal call remains. Already absent, with no call left, takes no gate.

When there is a change, hand the plan to `experts/DevOps Expert/` with `<live_state>`, in a second context, before any change. `<live_state>` is the inspection output copied verbatim. The plan names every call in order and the way back. A job names its purpose, its unit name, its limit, the token, the script, and the operands. The first config, when the plan has one, is the POST below onto a config whose body read `null`, with `If-Match` set to that GET's `Etag`. It replaces nothing. A route POST is one object appended through the admin API, with `If-Match`, and it is not a whole-config replacement.

The Docker apt source and key, when the plan installs Docker, are that install. They are not a request to change a configuration file, which remains the gap `experts/DevOps Expert/` declares for any other file.

- Safe as planned. Continue. The approval question still applies to each change call.
- Safe with named conditions. Tell the person. A condition that changes the calls goes back into the plan and is gated again. A condition that does not change the calls: send nothing until the person accepts it and says it is met. They decline it: stop with no change call. The report names the conditions and their answer.
- Not as proposed. Stop. No change call.
- The work is a gap this expert declares. Stop. The verdict names it. No change call.

### The repository job

Write the script verbatim to the temporary directory. The first line is exactly `set -eu`. Run `start` with `--purpose docker-repo`, `--limit 600`, `--token` the token the latest inspection read, `--script` that file, and no operands. Send the `argv` it prints, unchanged. Then the job question.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
apt-get update
for p in ca-certificates curl gpg; do
  if ! dpkg-query -W -f '${db:Status-Abbrev}' "$p" 2>/dev/null | grep -q '^ii'; then
    ver=$(apt-cache policy -- "$p" | awk '/^  Candidate:/ { print $2; exit }')
    test -n "$ver"
    test "$ver" != "(none)"
    apt-get install -y --no-remove -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold -- "$p=$ver"
  fi
done
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc.new
g=$(mktemp -d)
fp=$(GNUPGHOME="$g" gpg --show-keys --with-colons /etc/apt/keyrings/docker.asc.new | awk -F: '$1=="fpr"{print $10; exit}')
rm -rf "$g"
printf '%s\n' "key-fingerprint:$fp"
if [ "$fp" != 9DC858229FC7DD38854AE2D88D81803C0EBFCD88 ]; then
  printf '%s\n' key-fingerprint-mismatch
  rm -f /etc/apt/keyrings/docker.asc.new
  exit 20
fi
mv /etc/apt/keyrings/docker.asc.new /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
suite=$(. /etc/os-release && printf '%s\n' "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
arch=$(dpkg --print-architecture)
test -n "$suite"
test -n "$arch"
printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' "$suite" "$arch" > /etc/apt/sources.list.d/docker.sources
cat /etc/apt/sources.list.d/docker.sources
apt-get update
set +e
apt-get install -s -y --no-remove docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sim=$?
set -e
printf '%s\n' "simulate-exit:$sim"
exit 0
```

The fingerprint is checked before the key is moved into place. A mismatch removes the downloaded file and exits 20, and the previous key is left where it was. Prerequisites are installed only when `dpkg-query` does not show them installed, each pinned to the candidate that job reads, with the keep-old-config options. The key download, the `mv` into `/etc/apt/keyrings/docker.asc`, and the one `>` that writes `docker.sources` are the configuration write. The only other redirection in this skill discards what `command -v` prints in the inspection.

### The install job

Write the script verbatim. Run `start` with `--purpose docker-install`, `--limit 1800`, the token the re-inspection after the repository job read, the script, and, after `--`, the pinned operands. Send the `argv` it prints, unchanged. Then the job question. The re-inspection decides: a server version in the docker section means Docker answers. The job's own exit does not.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
apt-get install -y --no-remove -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold -- "$@"
ver=$(docker version --format '{{.Server.Version}}')
printf '%s\n' "server:$ver"
test -n "$ver"
for u in containerd.service docker.service docker.socket; do
  st=$(systemctl is-active -- "$u" || true)
  printf '%s\n' "$u:$st"
  test "$st" = active
done
fwd=$(cat /proc/sys/net/ipv4/ip_forward)
printf '%s\n' "ip_forward:$fwd"
test -n "$fwd"
```

Each unit is checked on its own. A unit that is not `active` fails the job. Do not treat the job's exit alone as Docker being installed. Re-inspect.

### The pull job

Write the script verbatim. Run `start` with `--purpose docker-pull`, `--limit 1800`, the token the latest inspection read, the script, and, after `--`, the one reference. Send the `argv` it prints, unchanged. Then the job question.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
docker pull -- "$1"
printf '%s\n' '--- digest ---'
docker image inspect --format '{{index .RepoDigests 0}}' -- "$1"
```

The digest is the single non-empty line after `--- digest ---`. It matches `^[a-z0-9][a-z0-9._/-]*@sha256:[0-9a-f]{64}$`. That line is the image the run uses. A tag is not used.

- The line matches. That is the digest. Continue.
- The line is missing, and the pull's class was `succeeded` or a finished failure whose read-back may have dropped the end. One direct read, which the person is told is a read: `docker`, `image`, `inspect`, `--format`, `{{index .RepoDigests 0}}`, `--`, and the reference. A single matching line is the digest. Anything else: stop. Do not pull again. Do not run a tag.
- The pull's output says authentication is required, or the registry denied the pull. Stop. Name the gap for a private registry login. Do not ask for a credential. Do not run `docker login`. Copy the read-back.
- Any other miss. Stop. Copy the read-back. Do not run a tag.

### What starts Caddy?

Ask only when the plan creates Caddy. One `vm.command.run`. The script is verbatim. `$1` is `<addr>`. `$2` is the digest. `argv` is `/bin/sh`, `-c`, the script, `sh`, `<addr>`, and the digest.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install -d -m 0700 /var/lib/caddy-admin
chmod 0700 /var/lib/caddy-admin
docker run -d --name caddy --restart unless-stopped --label deploy-workload=caddy -e CADDY_ADMIN=unix//run/caddy-admin/admin.sock -p "$1:80:80" -p "$1:443:443" -v /var/lib/caddy-admin:/run/caddy-admin -v caddy-config:/config -v caddy-data:/data -- "$2" caddy run --resume
```

The directory is mode `0700`. The publish is `<addr>` only, never every address. The command is `caddy run --resume`. The admin listener is `unix//run/caddy-admin/admin.sock`, the host directory bind-mounted at `/run/caddy-admin`.

The `docker run` is one change call. Take the direct-call question of its answer before the socket read. A call that came back `ok`, or `remote_failure` naming this identifier with `exit_code` 0, continues to the socket read. Any other answer does not. Do not start a second Caddy. Name the outcome. When the outcome is unknown until a re-inspection, read once and do not run `docker run` again. The way back named is `docker rm -f caddy` with its volumes kept. Do not send it in this run.

Then the socket script, a read. `<script>` is this text and no other:

```
export LC_ALL=C
if [ -S /var/lib/caddy-admin/admin.sock ]; then printf '%s\n' socket-present; else printf '%s\n' socket-absent; fi
exit 0
```

- The line is `socket-present`. Continue to the first-config question.
- The line is `socket-absent`. Wait a few seconds. Read once more.
- The second read is `socket-present`. Continue.
- The second read is not `socket-present`. Read `docker inspect` for `caddy` and `docker logs --tail 50 -- caddy`. Stop. No route and no workload. The way back named is `docker rm -f caddy` with its volumes kept. Do not send it in this run.

### What is the first config?

Ask when this run's Caddy is up and the plan includes a first config, and again as a fresh GET immediately before the POST. `argv` is `curl`, `-sS`, `-D`, `-`, `--max-time`, `10`, `--unix-socket`, `/var/lib/caddy-admin/admin.sock`, `http://localhost/config/`. The person is told the GET is a read.

The `Etag` value is the header text after the colon, with one leading space removed and a trailing carriage return removed. The body is null when its only non-whitespace is `null`.

- The body is null and an `Etag` is present. POST once. `argv` is `curl`, `-sS`, `-D`, `-`, `--max-time`, `15`, `--unix-socket`, `/var/lib/caddy-admin/admin.sock`, `-H`, `Content-Type: application/json`, `-H`, `If-Match: <etag>`, `-X`, `POST`, `--data-binary`, the body, `http://localhost/config/`. The body is exactly `{"apps":{"http":{"servers":{"workloads":{"listen":[":443"],"protocols":["h1","h2"],"routes":[]}}}}}`.
- The status line is `200`. The first config is in place. Continue.
- The status line is `412`. The call changed nothing. Stop. Do not POST again in this run. Copy the body.
- The body is not null. Do not POST a first config. Stop. The config is no longer the one the plan gated. A later plan is gated again.
- Any other answer. Stop. Copy it. Do not POST again.

### What joins the workload to Caddy?

One `vm.command.run`. `$1` is the workload name. `<script>` is this text and no other:

```
set -eu
export LC_ALL=C
docker network create --label "deploy-workload=$1" -- "wl-$1"
docker network connect "wl-$1" caddy
```

The workload publishes no port. Caddy is connected to `wl-<name>`. The workload is not on the default bridge.

Then one `vm.command.run` whose `argv` is `docker`, `run`, `-d`, `--name`, the name, `--network`, `wl-<name>`, `--restart`, `no`, `--label`, `deploy-workload=<name>`, then each `-e` and `KEY=VALUE`, then each `-v` and `<volume>:<path>`, then `--`, then the digest. No command after the digest. `--restart` stays `no` until the verify question passes.

### What did the verify read show?

One read. The person is told it is a read. `$1` is the name. `$2` is the port. `<script>` is this text and no other:

```
export LC_ALL=C
st=$(docker inspect --format '{{.State.Status}}' -- "$1")
printf '%s\n' "status:$st"
printf '%s\n' '--- answer ---'
docker exec caddy wget -q -S -O /dev/null -T 5 -- "http://$1:$2/"
printf '%s\n' "wget-exit:$?"
exit 0
```

Any line in the answer section that contains `HTTP/` counts as answering. No such line does not. `wget-exit` does not decide.

- The status is `running` and an `HTTP/` line is present. One change: `docker`, `update`, `--restart`, `unless-stopped`, `--`, the name. Then the update question.
- The status is not `running`, or no `HTTP/` line is present. One read: `docker`, `logs`, `--tail`, `50`, `--`, the name. Report failed. Name the status, the `wget-exit`, and the logs. Do not add a route. Do not run `docker update`. Do not remove the container. Name Job 2.

### What did the update answer?

Ask only after that update was sent.

- `outcome` is `ok`, or `outcome` is `remote_failure` and the answer names this identifier and `exit_code` is 0. The restart policy is `unless-stopped`. Take the route question.
- Any other answer. Do not add a route. Report the update's outcome. The container stays `--restart no` when the update did not land. Name Job 2. Do not remove the container.

### What adds the route?

A fresh GET, a read: `curl`, `-sS`, `-D`, `-`, `--max-time`, `10`, `--unix-socket`, `/var/lib/caddy-admin/admin.sock`, `http://localhost/config/apps/http/servers/workloads/routes`.

- The routes body now contains the hostname or the id, and the gated inspection did not. Stop. Do not POST. The config moved. Copy the body.
- An `Etag` is present and the hostname is absent. POST once, to that same path, with `If-Match` set to that `Etag`. The body is exactly `{"@id":"workload-<name>","match":[{"host":["<hostname>"]}],"handle":[{"handler":"reverse_proxy","upstreams":[{"dial":"<name>:<port>"}]}],"terminal":true}`.
- The status line is `200`. The route is in place. Take the curl question.
- The status line is `412`. The call changed nothing: another change reached the routes between the GET and the POST. Read the routes again, once, with the same GET. When the hostname and the id are still absent, POST once more with the new `Etag`. When either is now present, stop: the config moved, copy the body. A second `412` stops: do not POST again in this run, copy the body, the container stays, name what was left.
- Any other answer. Stop. Copy it. Do not POST again. Do not claim the route is in place.

### What did the curl from the machine answer?

Each try is one read. `argv` is `curl`, `-sS`, `-o`, `/dev/null`, `-w`, `%{http_code}`, `--max-time`, `15`, `--resolve`, `<hostname>:443:<addr>`, `https://<hostname>/`. The `-k` form inserts `-k` after `-sS`. The person is told each try is a read. A code of `000` is not an answer. Exit 60 means the certificate did not verify.

A hostname that is `localhost` or ends with `.localhost` is a local name. One strict try, then, when the exit is 60 or the code is `000`, one `-k` try. Do not wait and do not try three times. Say the name is reachable only from the machine. Caddy issues it from its own internal authority. Do not hand it to `experts/IT Expert/` as a public DNS name.

A public name: at most three strict tries, about 20 seconds apart.

- Exit 0 and the code is not `000`. Answered. The certificate verified. Stop retrying.
- Exit 60, and this was not the third try. Wait about 20 seconds. Try again.
- Exit 60 on the third try. One `-k` try. A `-k` code other than `000`: served, and not publicly trusted. A `-k` code of `000`, or no code: not answered.
- Any other result, and fewer than three strict tries have been made. Wait about 20 seconds. Try again.
- The third strict try is not a verified answer and is not exit 60. Not answered. Do not send `-k`. Name the outcome and any `exit_code`.

`busy` is not a try. The machine was not asked. Do not count it. Name it. Do not repeat it as a change. One later read is allowed only when fewer than three strict tries have been made.

### Job 2. Remove one workload this skill deployed

The map, the health, the role, the inspection, the token, and the loaded-job questions are the ones above. The name question and the routes question are the ones above. Take the first match before the gate.

- The container's label is not the workload name, or the network's label is not the workload name and the container is absent. Stop. Do not remove a container or a network this skill did not label. The name is taken, or it is already absent. Already absent, container and network and route: `unchanged`. No gate.
- The socket is absent, and a container named `caddy` exists. Stop. The route was not read. Remove nothing. A route left in a stopped Caddy would return with it.
- The socket is absent, no container named `caddy` exists, and the labelled container or the labelled network exists. The plan removes the container, when its label still matches on a re-read, and then the network. No route is read because no Caddy is present. Say so.
- The socket is present. The plan is: GET `http://localhost/id/workload-<name>`. A `404`, or a body that says the object id is unknown, means the route is already absent. Do not DELETE. A `200` with an `Etag`: DELETE that path with `If-Match` set to that `Etag`. A DELETE `200` removes the route. A DELETE `404` means it was already gone. A `412` changes nothing: stop, remove nothing further, copy the body. Then re-read the label. Then `docker rm -f`, only when that re-read is exactly the workload name. Then the network script below.
- The route GET was not read. Stop. Remove nothing.

The label re-read is a read: `docker`, `inspect`, `--format`, `{{index .Config.Labels "deploy-workload"}}`, `--`, the name. The line is the label.

- The line is the workload name. `docker`, `rm`, `-f`, `--`, the name.
- The line is anything else. Stop. Remove nothing.
- The inspect says no such object. The container is already absent. Continue to the network.

The network script, only after the container is absent. `$1` is the name. It is a change. `<script>` is this text and no other:

```
export LC_ALL=C
docker network disconnect "wl-$1" caddy
printf '%s\n' "disconnect-exit:$?"
docker network rm -- "wl-$1"
printf '%s\n' "network-rm-exit:$?"
exit 0
```

A disconnect that fails because Caddy was not connected still continues to `network rm`. Named volumes are kept. The report says so.

The gate question applies to the whole removal plan before the first of these change calls. The way back named is a new Job 1, not sent in this run. Then the job's direct-call question does not apply: each removal call is sent once, and a failure is not retried. Re-inspect. `changed` means the re-inspection shows the container absent, the network absent, and the route absent or no Caddy present. `unchanged` means that was already true before any removal call. Anything else is failed, with the call's outcome and the re-inspection.

### What did the job do?

Ask for each planned job. Do not send the start until the gate has continued and the person approves that start. Do not repeat a start without a new inspection and a new approval, except after the class `lock-busy`, which started nothing and whose retry the token protects. Do not send the way back because a job failed. Save each job answer in the temporary directory and pass that absolute path to `classify`. `needs_confirmation` is the approval question, taken before classify. On a poll, a read-back, a journal read, or a release, a gateway status other than `needs_confirmation` and other than `vendor_error` is handled as the direct-call gateway bullets, with the module `command`, and it is not classified as a statement about the job. On a start, classify that status: the class `gateway-status` has those same bullets. `vendor_error` is classified on every step. A re-inspection is not a job answer: a gateway status other than `needs_confirmation` on a re-inspection is those same bullets.

What did the start answer?

Send the planned start once. Save the answer. Classify it with `classify --step start --unit` the unit this run's `start` printed. Take the first match.

- The class is `started`. Record the invocation ID in the facts. Poll.
- The class is `existing-job`. Nothing was started. The second-run questions, on a fresh inspection.
- The class is `lock-busy`. Nothing was started. Start again later with the same token. A token that moved is the class `token-changed`. Do not send a different start.
- The class is `enumeration-failed`. Nothing was started. Stop. Change nothing.
- The class is `token-changed`. Nothing was started. The plan is stale. Inspect again and gate again, with a new approval. Never send a start again without both.
- The class is `token-write-failed`. Nothing was started. The token may have changed. Inspect again, and gate again before any start.
- The class is `refused-before-submission`. Nothing was started. The token was renewed. Inspect again, and gate again before any start.
- The class is `gateway-status`. The direct-call gateway bullets, with the module `command`. A `needs_confirmation` status is the approval question.
- The class is `unknown`, a `connect_timeout` or a `remote_failure` with no `start-exit:` line included, and `vendor_error`. Unknown whether it started. Poll by this run's name. A class of `running`, `deactivating`, `succeeded`, `signal`, `stuck`, `failed-exit`, `failed-timeout`, or `failed-other` means it started, and that invocation ID is the one to record. The class `not-loaded` is the history question: the tool's `journal`, and the class `no-entries` is execution history unknown. Re-inspect where a read is possible. Never repeat the change. Never send the start again without a new inspection and a new approval.
- A loaded unit carrying this run's own name is this run's, after a start whose answer was lost. Poll it.

What did the poll read?

Each poll is the tool's `poll`. The wait is at most 40 seconds, passed as `--wait`. At most six polls in a row. Each is a read, and the person is told it is a read. Save the answer. Classify with `classify --step poll --recorded` the invocation ID recorded for this run. When none was recorded, because the start's class was `unknown`, classify without `--recorded`: a poll whose class is neither `not-read` nor `unrecognized`, and whose facts carry an `invocationId` that is not null, records that ID, and every later poll passes it as `--recorded`. Until then each poll is classified without `--recorded`. Take the first match.

- The class is `other-invocation`. Stop. Change nothing. Report both IDs: the one recorded, and the `InvocationID` in the facts.
- The class is `succeeded`, `signal`, `failed-exit`, `failed-timeout`, or `failed-other`. `finished` is true. Read it back by the recorded invocation ID: the tool's `readback`, sent as the `argv` it prints, unchanged. Classify that answer. A class `truncated` is read again with fewer lines. The report names the line count in the facts. A class `read` carries the job's own journal lines, which the report copies. A class `not-read` says the read-back was not read. The person is told the read-back is a read. Then release.
- The class is `stuck`. Stop. Change nothing. Do not release. Re-inspect where a read is possible, and do not treat that read as a reason to repeat the change. The job is the person's, over the provider's console.
- The class is `not-loaded`. Read the journal with the tool's `journal`, sent as the `argv` it prints, unchanged. Classify it with `classify --step journal`. The class `no-entries` is execution history unknown. A class `truncated` is read again with fewer lines. A class `not-read` says the journal was not read. Re-inspect where a read is possible. Never repeat the change.
- The class is `running`, `deactivating`, `not-read`, or `unrecognized`. When six polls have been made, report the state the last poll that was read showed, or that the state is unknown when none of the six was read, with its unit name, invocation ID and limit, and that asking again later reads its result through the second-run rule. Do not call it running unless the class was `running`. Do not start another job. Do not repeat the change. When fewer than six polls have been made, poll again.

What did the release answer?

Release only after a poll whose class was `succeeded`, `signal`, `failed-exit`, `failed-timeout`, or `failed-other`, with the unit and the recorded invocation ID. Build it with the tool's `release` and send the `argv` it prints, unchanged. Tell the person it unloads the finished job and removes no log. Save the answer. Classify with `classify --step release`.

- The class is `released`. The token was renewed. Re-inspect.
- The class is `lock-busy`, `invocation-mismatch`, `not-finished`, or `processes-remain`. Released nothing. The token was left alone. The class `processes-remain` is stuck: the person's, over the provider's console. Stop. Do not repeat the change. Re-inspect where a read is possible.
- The class is `unknown`. Name it. Do not repeat the change. Re-inspect where a read is possible.

A job's success is not the change's success. The re-inspection decides `changed`, `unchanged`, or failed.

### What did a direct call answer?

This question is for a `vm.command.run` that is not a job start, poll, read-back, journal, or release. Send the planned call once. The approval question applies. Do not repeat a change call on a failure or an unclear answer. Do not send the way back because a call failed.

- `outcome` is `ok`, `truncated`, or `remote_failure`, and the answer names this identifier in `machine`. The call came back. Read it the way the question that sent it says. Re-inspect when that question says to.
- `outcome` is `timeout`, `killed`, or `request_timeout`, or `status` is `vendor_error`, or a failure outcome carries no `machine`. The outcome is unknown until the re-inspection. Say that. Re-inspect. Do not repeat the call.
- `outcome` is `busy`. The machine was not asked. Re-inspect. Do not repeat the call.
- `outcome` is `unknown_machine`. Do not repeat the call. Read `vm.inventory.list_hosts` once. Absent: it left the map, point to `skills/Prepare VM/`. Still listed: name the contradiction. Change nothing further.
- `status` is `needs_connect`, `denied`, `invalid_arguments`, or another gateway status other than `needs_confirmation`. The call did not run as a router result. Hand the status to `skills/Connection Troubleshooter/` in `wiser`. On `needs_connect`, the module is `command` unless the answer names one. Re-inspect only when the module that reads the state is connected. Otherwise say the re-inspection could not be made. Do not claim `changed` or `unchanged`. Do not repeat the call.
- Any other answer. Name it verbatim. Re-inspect when a read of the state is still possible. Do not repeat the call.

### What did the re-inspection show?

After a job, re-inspect when the job question says to. After the route, or after Job 2's last removal call, inspect again with the same inspection script. The approval question applies, and the person is told it is a read. A job that exited 0 is not yet `changed`.

The requested state for Job 1: the workload container's status is `running`, its label is the workload name, the routes body contains the id and the hostname, and the curl question got an answer. The certificate verified only when a strict curl exited 0 with a code other than `000`. A `-k` answer is served and not publicly trusted.

- The re-inspection is incomplete, `truncated`, absent, or not a state, under the same rules as the first inspection. Do not claim `changed` or `unchanged`. Report failed, with the change call's outcome and the re-inspection's outcome, any `exit_code`, and the output. Do not repeat the change.
- Job 1's requested state holds, and it did not hold in the before-state. `changed`. The report adds the URL, whether it answered, whether the certificate verified, and the image digest.
- Job 1's container or route holds and the curl did not answer. Failed. Name the curl's outcome and what the re-inspection shows. Do not call it `unchanged`. Do not remove the route or the container. Name Job 2.
- Job 2's requested state holds, and a removal call was sent. `changed`.
- Job 2's requested state held before any removal call. `unchanged`.
- The requested state does not hold. Failed. Name the outcomes and what the re-inspection shows. Do not repeat the change.

### What does the report say?

One report. For each part: what was inspected, what was planned, the gate's verdict or that no gate was taken, each call's action and its `outcome`, any `exit_code`, the output copied verbatim where the report shows it, the re-inspection, and `changed`, `unchanged`, or failed. A change whose outcome was unknown until the re-inspection says that, and then says what the re-inspection decided.

The parts are the ones the plan ran: Docker when the install branch ran, Caddy when it was created or already present, the workload, the route, and the URL. The URL is `https://<hostname>/`. The report says whether it answered and whether the certificate verified, and it names the image digest the container was run from.

For a public name, the report also says what the URL still needs outside the guest: the provider's firewall allowing TCP 80 and 443 to this machine alone, and a DNS record for the hostname. The guest cannot set either. Name that gap. Hand the DNS part to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. The curl used `--resolve` on the machine, so it does not show that the DNS record or the provider firewall is in place. A verified certificate does not stand in for that reading.

For a name under `.localhost`, say it is reachable only from the machine.

Name the IPv6 gap: this skill publishes the IPv4 source address only.

For each job, also: its unit name, its invocation ID and its limit, the last poll's state, the read-back lines verbatim and the line count shown, and the release outcome. Then the re-inspection, as the re-inspection question reports it. A job not read as finished after six polls is reported in the state the last poll that was read showed, or as unknown when none was read, with the unit name, the invocation ID and the limit, and that asking again later reads its result through the second-run rule.

An environment value the person confirmed is not a secret is shown. A secret is not shown and was not sent. No credential is asked for. The source address is not a field of the report. An identifier is the machine field. A hostname inside copied output stays that output. The URL is the field this skill adds.

## Pitfalls

- **The request is ambiguous.** More than one machine, more than one workload, a deploy and a removal together, or an install of Docker with no workload. Ask before any call.
- **A machine that is not on the map, or whose health is not `ok`.** Stop. Not on the map: point to `skills/Prepare VM/`. Not reachable: name the outcome the way `skills/VM Inventory/` does. Change nothing.
- **The router host.** Stop before any change. Name the gap. Do not deploy there because a job would run outside the router's sandbox.
- **A failure with no `machine`, called unreachable or called a finished deploy.** It does not establish whether the router reached the machine. On a read of health, not determined, and stop. On a change, the outcome is unknown until the re-inspection.
- **`vendor_error` treated as the machine's answer.** It does not establish whether the call ran.
- **`busy` treated as a down machine.** The machine was not asked. Do not repeat the change.
- **A value that fails its pattern, sent anyway.** Ask. Never send the other form. The workload name, the image, the port, and every mount stay operands or their own argv elements.
- **A secret in an environment value.** Show the value and ask. A secret is the gap. It is not sent and it is not written into the plan.
- **A host path, or a bind mount, sent as a volume.** The source has to be a named volume. Refuse the path by name.
- **A shell write.** No redirection, no `tee`, and no `sed -i`, except the repository job's key and `docker.sources`, and except the lock and the token inside the starter and the release the tool emits.
- **Docker installed where forwarding is already on, or on a distribution that is not Ubuntu.** Stop. Name the gap. Docker sets the `FORWARD` policy to `DROP`.
- **A pull sent as a direct `docker pull`.** A pull is a job. So are the repository job and the install job. A machine whose systemd is older than 254 does not get either. Name the gap.
- **Caddy published on every address.** The publish is `<addr>:80` and `<addr>:443`, the default route's source address. Never all addresses.
- **A whole-config write.** The first POST to `/config/` happens only when that GET's body was null, and it carries `If-Match`. A route is one POST to the routes path with `If-Match`. A `412` changed nothing: the routes are read again once and the POST is sent once more only when the hostname and the id are still absent; a second `412` stops.
- **A route added for a container that did not answer.** The verify read comes first. No `HTTP/` line, or a status that is not `running`: logs, failed, no route, and Job 2 is named. This run does not remove the container.
- **A container removed that this skill did not label.** Stop. The name is taken.
- **A second job started while one is loaded.** The second-run questions. A running job stops the run. A finished one is released and the run starts over from its inspection, once.
- **A start sent again after `token-changed`, with no new inspection and no new gate.** Nothing was started. Inspect again and gate again before any start.
- **A job's exit 0 reported as the URL answering.** The re-inspection and the curl decide. A stuck job is not released.
- **A `.localhost` name reported as a public URL.** It is reachable only from the machine. Its certificate is not publicly trusted.
- **A public URL reported as finished because the guest curl answered.** Name the provider firewall and the DNS record. Hand the DNS part to `experts/IT Expert/` in `wiser`.
- **IPv6 published, or an `[::]` listener treated as this skill's bind.** Do not publish IPv6. Name the gap.
- **A credential, or `docker login`.** Do not ask. A pull the registry denies names the private-registry gap.
- **The fleet called down.** A router-host failure, or a `list_hosts` `vendor_error`, means connector access to the whole fleet depends on the router host. Workloads keep serving.

## Success

- The report covers one machine and one workload. A request that named more than one was asked, and nothing was called before the answer.
- The machine was on the map and `vm.inventory.health` was `ok` before any inspection or change. Otherwise the report says not on the map and points to `skills/Prepare VM/`, or names the health outcome the way `skills/VM Inventory/` does, and nothing was changed.
- The router host was stopped before any change, and the report names the gap for a workload on the router host.
- Patterns were refused by name before any call. A secret was not sent. A host path was not sent.
- The inspection was one `vm.command.run`, the person was told it is a read, and the workload name was an operand. It carried both token lines and the jobs section.
- A loaded job was handled by the second-run questions before any decision to change: a running one stopped the run, a finished one was released and the run started over from its inspection at most once, and a stuck one was left to the person.
- A change was sent only after `experts/DevOps Expert/` returned safe as planned, or safe with named conditions the person was told, and only after the person approved that call's stop. `skills/Connection Troubleshooter/` in `wiser` was the stop. A declined change had no further call. A `token-changed` start ran nothing, and a later start waited for a new inspection and a new gate.
- Docker was installed only when it was absent, `ID` was `ubuntu`, systemd was 254 or later, and IPv4 forwarding was off globally and on every interface. The repository job and the install job were the two jobs, purposes `docker-repo` and `docker-install`, limits 600 and 1800. The install operands were the simulation's `Inst` lines, each pinned, and only the allowed names. Any other distribution, or a machine that already forwards, named the gap and was not installed.
- Each pull was one job, purpose `docker-pull`, limit 1800, the reference an operand, and the container was run from the digest that job printed. A tag was not run. Systemd older than 254 named the gap and was not pulled.
- Caddy, when created, was the container named `caddy`, label `deploy-workload=caddy`, `--restart unless-stopped`, command `caddy run --resume`, admin socket under `/var/lib/caddy-admin`, published only on the source address at 80 and 443. A Caddy that was not this skill's stopped the run. The first config was sent only when GET `/config/` was null, with `If-Match`.
- The workload published no port. It joined `wl-<name>`, was started with `--restart no`, and was set to `unless-stopped` only after `docker inspect` showed it running and the wget from inside Caddy printed an `HTTP/` line. Otherwise the report failed, with the state and `docker logs --tail 50`, no route was added, and Job 2 was named and not run.
- The route was one POST of the one route object, with `If-Match` from a fresh GET. A `412` was read again once and posted once more only when the hostname and the id were still absent, and a second `412` stopped the run. A removal's `404` on the id was the route already absent.
- The curl from the machine was the one the curl question states. Exit 60 was reported as not publicly trusted, with the `-k` result. A public name was tried at most three times. A `.localhost` name was said to be reachable only from the machine.
- The report names, per part, the inspection, the plan, the gate's verdict or that no gate was taken, each call's outcome, the re-inspection, and `changed`, `unchanged`, or failed. It names the URL, whether it answered, whether the certificate verified, and the image digest. For a public name it names the provider firewall and the DNS record, and the DNS part was handed to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`.
- Per job the report names the unit name, the invocation ID, the limit, the last poll's state, the read-back lines and the line count shown, and the release outcome. A job was polled at most six times, each wait at most 40 seconds. Release followed a poll that read the job finished. A stuck job was not released.
- No credential was asked for. The source address was not printed as a field. IPv6 was not published, and that gap was named.
