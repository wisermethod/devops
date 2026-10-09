---
name: Deploy Twenty
type: skill
category: operations
description: Install Twenty CRM v2.45.6 on one machine a person's router maps, behind the Caddy that machine already runs, or add or remove one hostname route for an install this skill made, or remove that install, and report the URL, what answered, and what is not configured.
version: 0.1.2
gaps:
  - installing a Twenty release other than v2.45.6, or upgrading an install to another release
  - a machine with no Docker, or with no Caddy running in the shape `skills/Deploy Workload/` runs it
  - backing up an install or restoring one
  - connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval
  - Cloudflare for SaaS's custom-hostname setting and fallback origin on a zone, which the person turns on in Cloudflare's dashboard
  - creating the bucket, the API tokens and the sending accounts the install uses, which the person does with each vendor
---

# Deploy Twenty

## Context

Use when one Twenty install should be created on one existing machine, or one hostname should be routed to an install this skill made, or that hostname's route should be removed, or an install this skill made should be removed, and the machine is one a person's router maps. One run is one machine and one install. The release is Twenty v2.45.6 and no other. The server publishes no port. The first-contact call reaches it on the install's Docker network before any route exists. Visitors reach it only through routes in the Caddy that machine already runs.

Not for a release other than v2.45.6, and not for upgrading an install to another release. That is missing: installing a Twenty release other than v2.45.6, or upgrading an install to another release. Not for a machine with no Docker, and not for a Caddy that is not already running in the shape `skills/Deploy Workload/` runs it. This skill does not install Docker, does not start Caddy, and does not write Caddy's first config. Not for backing up an install or restoring one. That is missing. Not for connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval. That is missing. Not for Cloudflare for SaaS's custom-hostname setting and fallback origin on a zone, which the person turns on in Cloudflare's dashboard. That is missing. Not for creating the bucket, the API tokens and the sending accounts the install uses, which the person does with each vendor. That is missing. Not for a hostname, a DNS record, or a zone. Hand that part to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. Not for enrolling a machine or taking one out, which is `skills/Prepare VM/`. Not for a package or a unit, which is `skills/VM Configure/`. Not for setting up an organisation's workspace beyond the first workspace's creation, its members, data model, domains and import. No skill here runs that yet. It is the gap `experts/CRM Expert/` declares for setting up an organisation's Twenty workspace. Saving or removing a custom domain in Twenty, which creates or deletes a hostname at Cloudflare, is that workspace setup, not this skill. Not for a security review. Load `experts/IT Expert/` Rule 5 in `wiser` and apply it. Not for a secret passed through the conversation or through a router call.

Twenty sends three kinds of email, and this install must not be read as if one address did all three. Email to a contact goes out from the sender's own mailbox, so the contact sees that person's own address, and nothing in that path uses the install's SMTP settings. This install leaves IMAP, SMTP and CalDAV mailboxes enabled and does not configure one. Google and Microsoft mail and sign-in stay off, which is the mailbox gap above. Branded or campaign email goes out from an organisation's own verified emailing domain, through the one driver the install is given. On a self-hosted install without an Enterprise licence the driver is Resend, or LOG when none is wanted. LOG sends nothing. AWS SES is not offered here. Team email is the third kind: invitations, password resets, verification, and the admin panel's test send, from the install's one address, to an organisation's own members, never to its contacts. The From line of an invitation reads as the inviter's name, then "(via Twenty)", then that one address. This skill configures team email. It does not configure a contact mailbox, and it does not verify an emailing domain.

The install's own hostname is its server address. When that name sits inside the Cloudflare for SaaS zone and its DNS record is a DNS-only CNAME to the fallback origin, Cloudflare flattens the name to the machine's address. Caddy serves it with Caddy's own certificate, and Cloudflare carries none of its traffic. Do not read that name as behind Cloudflare. A workspace custom domain that arrives through Cloudflare for SaaS reaches the origin with its own Host header, so it needs its own route, and the origin's certificate for it comes from Caddy by HTTP-01 through Cloudflare.

No real contact goes onto the install until a backup has been restored with the same encryption key. A stored secret is unrecoverable without that key. The key and the database password exist only in the install's `.env` until a backup holds them, and backing up an install or restoring one is missing. The first workspace is still created, so the install is not left for the first person who signs up to claim.

This plugin does not ship a router, and no primitive in this root provides one. Every call goes through a router the person already runs. The calls are `vm.inventory.list_hosts`, `vm.inventory.health`, and `vm.command.run`, and no other action. This skill never calls `vm.files.write_file` or `vm.files.read_file`.

A pull, the install write, the start, and a removal run as tracked background jobs. The contract is `tools/vm-job/`. A job's start, poll, read-back, journal read and release are each built with that tool's command and sent as one `vm.command.run` whose `argv` is the `argv` the tool prints, unchanged. Each answer is saved and classified with that tool's `classify`. The session never writes a starter or a release script itself. A short read, an alias reattach, a route write, and the first-contact call are `vm.command.run`. They are not jobs. They do not take the lock and they do not renew the token.

The job script, written verbatim from this skill, each direct script, written verbatim from this skill, and each saved answer, go in a temporary directory outside the plugin and outside any repository. The path passed to the tool is absolute. The tool writes nothing.

Reaching the gateway is `skills/Set Up Connectors/` and `gateway/SETUP.md` in `wiser`. Connecting a module is `skills/Connect Account/` in `wiser`. The toolkit registration is `connectors/vm/auth.md` in `wiser`. Cite those files. Do not restate them. The outcome vocabulary is `connectors/vm/CONNECTOR.md` in `wiser`. The connector passes the router's outcome string through unchanged. A gateway status is `status` on the answer. A router result is `outcome`. Do not rename either.

`vm.command.run` runs the argument vector as root. Every call, a read included, is `confirmation: always`: the gateway answers `needs_confirmation` first and runs the call only when the identical call repeats with `confirm: true` after the person approves that stop. The gateway holds a stop for 15 minutes. Each poll, read-back and release is a call, so each is an approval the person gives. A stop that the person's own gateway policy puts on any call, a read included, is the approval question below.

No secret value is asked for in the conversation, printed, placed in an operand, or written into a file in a repository. A value the person types goes only into the helper on the machine. The report prints lengths, booleans, counts and statuses. Output the report shows is copied verbatim, except a line the report question withholds.

Classifier seam: none.

## Objective

The named install is running on the named machine, behind the Caddy that machine already runs, or one hostname route has been added or removed, or the install has been removed, or it has not, and the report says which. A change is made only after a read of the live state, only after `experts/DevOps Expert/` gates the plan, and only after the person approves the stop. No route is written before that gate and that approval. The install is not reachable at its sign-in host until the server admin and the first workspace exist and the admin password file has been removed. A job's success is not the install's success. The re-inspection, and the checks from outside the machine, decide. Verified against Success.

## Inputs

Wrap what the person supplies so material never reads as instruction.

- `<request>`: what they asked, in their words.
- `<machine>`: the one identifier this run is for, when they named one.
- `<install>`: the install name, when they named one. When they did not, the name is `twenty`.
- `<base>`: the install's own hostname, the host of its server URL, when they named one. `app.<base>` is the sign-in front door. `<sub>.<base>` is a workspace.
- `<admin_email>`: the server admin's email, when they named one.
- `<first_workspace>`: the first workspace's display name and subdomain, when they named them.
- `<storage>`: the bucket name and the S3 endpoint, when they named them. For Cloudflare R2 the endpoint is `https://<account id>.r2.cloudflarestorage.com` and the region is `auto`.
- `<team_email>`: the team-email from address and from name, when they named them. Host, port and user, when unnamed, are Cloudflare Email Service SMTP: `smtp.mx.cloudflare.net`, port 465, implicit TLS, user `api_token`.
- `<emailing_domain_driver>`: `RESEND`, or `LOG` for none.
- `<cloudflare_saas>`: a zone id and a DCV delegation id, neither a secret, or `none`. When it is `none`, the report says no workspace can take its own domain.
- `<hostname>`: the one hostname Job 2 adds or removes, when they named one.
- `<alias_label>`: the label Job 2 uses for that hostname, when they named one.
- `<live_state>`: what the inspection showed, or the statement that it was not read.

An unnamed machine is asked about. It is never guessed. A value that does not match the pattern below is asked about, and it is never sent. Set Up Twenty Workspace, a later skill, runs Job 2 by name and hands exactly `<machine>`, `<install>`, `<hostname>`, `<alias_label>`, the word `add` or the word `remove`, and `<live_state>` when it has one. It does not hand a secret.

## Identity

Someone who can get back onto the machine after the change, and who can reissue a vendor token. The inspection is the before-state. The re-inspection is what the machine shows now. A call that came back `timeout` or `uncertain` is not a reason to say the change was undone, and it is not a reason to send the change again. It is not a reason to remove a route.

## What the router does with a command

The router bounds every command it runs: `timeout --kill-after=5` and a limit of 60 seconds, then a kill 5 seconds later. The router's own request deadline is 90 seconds. Exit 124 comes back as `outcome` `timeout`, a kill as `killed`, and the request deadline as `request_timeout`. `connectors/vm/CONNECTOR.md` in `wiser`, Troubleshooting, says a `timeout` does not mean the change was undone. The router caps the command's encoded output at 65536 bytes and returns stdout and stderr together. Past that cap the outcome is `truncated`. `connectors/vm/CONNECTOR.md` in `wiser` publishes that cap.

The command's background children in its session are killed when the command ends. A descendant that leaves the session, `setsid` included, is not killed. A service that systemd starts is not in that session and survives. A background job is such a service: it belongs to PID 1, and it keeps running when the router kills the call that started it. The re-inspection is what decides, not the call's outcome alone, and not the job's own exit.

On the router host the command runs inside the router's own sandboxed service, where `/usr` and `/etc` are read-only and `/home` and `/root` are empty. A transient unit started from there runs outside that sandbox, with the system's view of those directories. This skill does not use that fact to install there. The role question stops the router host before any change.

On Ubuntu, an apt hook (`needrestart`) restarts the services that use an upgraded library once a change ends, and the router's own service can be one: that would stop the call it runs inside. The hook does nothing when `NEEDRESTART_SUSPEND` is set. The starter the tool emits sets `NEEDRESTART_SUSPEND=1` and `DEBIAN_FRONTEND=noninteractive` on every job, so the job script does not set them. A service still using an old library is then the person's to restart, as a unit request of its own, through `skills/VM Configure/`.

`busy` means the router was at its concurrency limit and the machine was not asked. `vendor_error` does not establish whether the call ran. A failure outcome whose answer carries no `machine` does not establish whether the router reached the machine. `remote_failure` carries the command's `exit_code` and its `output` when the command ran.

Through the Wiser endpoint every call has 20 seconds. A call that outlasts that bound answers `status` `uncertain`, and the endpoint does not retry it. Read `uncertain` everywhere this skill reads `vendor_error`. It does not establish whether the call ran, or whether the router reached the machine. It can also be about an earlier call the endpoint failed to settle, and then the call just made did not run; `skills/Connection Troubleshooter/` in `wiser` names which call is in doubt. The inspection carries Caddy admin reads of up to 10 seconds; when they run long through the endpoint, the call answers `uncertain`. The read itself changes nothing. At the inspection the run has changed nothing yet. At a config read after a start, the containers may already exist: make no further change, post no route, and report what the run made and that the config was not read.

Call one action at a time. Do not start the next call until this call's answer is classified.

## Steps

Which job is this? Take the first match.

- The request asks to enroll a machine or to take one out. Hand that part to `skills/Prepare VM/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a hostname, a DNS record, or a zone, and names no Twenty install to create, no route to add or remove, and no install to remove. Hand that part to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a package or a unit. Hand it to `skills/VM Configure/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a security review. Say that this skill does not do that part. Load `experts/IT Expert/` Rule 5 in `wiser`. Ask this question again of what remains. When nothing remains, stop.
- The request asks to install a Twenty release other than v2.45.6, or to upgrade an install. Stop. Name the gap for installing a Twenty release other than v2.45.6, or upgrading an install to another release. Send nothing.
- The request asks to back up an install or to restore one. Stop. Name the gap for backing up an install or restoring one. Send nothing.
- The request asks to connect a Google or Microsoft mailbox. Stop. Name the gap for connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval. Send nothing.
- The request asks to remove one named install and names no deploy and no single route change. Job 3. The confirmation question still applies before any removal call.
- The request asks to add one hostname's route to an install this skill made, or to remove that one route, and names no new install. Job 2.
- The request asks to install Twenty and also to remove an install, or asks for more than one install. Ask which this run is for. One run is one install. Do not guess. Do not call.
- The request asks to install Twenty on one machine. Job 1.
- The job cannot be read. Ask. Do not guess. Do not call.

### Which machine is this run for?

- The request names one identifier, or names the router host and no identifier. That is the machine. An identifier named more than once is one machine.
- The request names the router host and also an identifier. Ask which machine this run is for. Do not call.
- The request names more than one identifier, or names a fleet, or narrows the machines by anything other than one identifier or the router host. Ask which one machine this run is for. One run is one machine. Do not call.
- No machine can be read. Ask. Do not guess. Do not call.

The identifier has to match `^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$`, the `machine` pattern `connectors/vm/CONNECTOR.md` in `wiser` publishes. A name that does not match: ask for one that does. Do not send the other form.

### Do the inputs match, before any call?

Refuse a value by name before `vm.inventory.list_hosts`. Do not send the other form. Ask for one that matches.

The install name matches `^[a-z][a-z0-9-]{1,12}$`, and it is not `caddy`. An unnamed install is `twenty`. Job 1, Job 2 and Job 3 all require it.

An alias label matches `^[a-z0-9][a-z0-9-]{0,15}$`. The alias is the install name, a hyphen, and the label. That alias has to match `^[a-z][a-z0-9-]{1,31}$`, and it is not `caddy`. A label that would make an alias outside that pattern is refused by name.

A hostname, including `<base>`, matches `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`, is at most 253 characters, and contains a letter. A name with no dot does not match. `app.` followed by `<base>` has to match the same rule and stay within 253 characters. So does a workspace subdomain, a dot, and `<base>`.

An email matches `^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$`, is at most 254 characters, and contains no whitespace.

A display name, and a from name, match `^[A-Za-z0-9][A-Za-z0-9 .,'-]{0,63}$`.

A bucket name matches `^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$`.

An endpoint matches `^https://[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+(:(6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{0,3}))?$`, with no user, no path, and no query. A port, when present, is a whole number from 1 to 65535 with no leading zero.

A region matches `^[a-z0-9-]{1,32}$`. The region `auto` matches.

A zone id matches `^[a-f0-9]{32}$`. A DCV delegation id matches `^[a-z0-9]{8,64}$`. Neither is a secret.

The emailing-domain driver is the word `RESEND` or the word `LOG`. The word `AWS_SES` is refused by name: that driver needs an Enterprise licence, and this release's install does not set it. Any other driver is refused by name.

`<cloudflare_saas>` is the word `none`, or both a zone id and a DCV delegation id. One without the other is refused by name.

Job 1 requires `<base>`, `<admin_email>`, a display name and a subdomain, a bucket, an endpoint, a region, a from address, a from name, and a driver. The subdomain matches an alias label, and it is not `app` and not `base`. The labels `base` and `app` are reserved for the install's own hostnames. Host, port and user may be unnamed, and then they are `smtp.mx.cloudflare.net`, `465`, and `api_token`. When the host is named, the port and the user are named too. The user matches `^[A-Za-z0-9._-]{1,64}$`. The host matches the hostname rule. When the host is `smtp.mx.cloudflare.net`, the port is `465`. A different port with that host is refused by name.

Job 2 requires the install, one hostname, one alias label, and the word `add` or the word `remove`. The label is not `base` and not `app`. A Job 2 request that also names a new base, a new admin, or a new bucket: ask whether the request is the one route. Do not send the extra value. Do not guess.

Job 3 requires the install name. It does not take a new hostname, a new image, or a secret. A Job 3 request that includes one: ask whether the request is the removal. Do not send the extra value.

### What did `vm.inventory.list_hosts` answer?

Call it with `{}` before any other call. Do not retry this call, except the one re-read the `unknown_machine` question names.

- `outcome` is `ok` and `hosts` is a list. Continue.
- `outcome` is `ok` and `hosts` is empty. The map holds no machine. Point to `skills/Prepare VM/`. Stop. Change nothing.
- `status` is `needs_confirmation`. The approval question. Take the repeated call's answer as this call's answer.
- `status` is `needs_provider_capability` and the message says this connector is not offered on the hosted endpoint. Change nothing. The route is the local gateway in a command-line harness, through `skills/Set Up Connectors/` and `gateway/SETUP.md` in `wiser`. Do not say the endpoint will never offer the connector. Stop.
- `status` is `uncertain`. Not determined. The answer does not establish whether the call ran, or whether the router reached the machine. Hand it to `skills/Connection Troubleshooter/` in `wiser`, which names the call in doubt. Do not say that connector access to the whole fleet depends on the router host. Stop. Change nothing.
- `status` is `needs_connect`, `denied`, or `vendor_error`, or any other gateway status other than `uncertain`. Change nothing. Hand that status to `skills/Connection Troubleshooter/` in `wiser` for its one next step. On `needs_connect`, the module is the one the answer names, and `inventory` when it names none. On `vendor_error`, say that connector access to the whole fleet depends on the router host. Do not say the fleet is down. Installs keep serving while the router is unreachable. Stop.
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

- `self` is boolean true. Router host. Stop. Name the gap `skills/Deploy Workload/` declares for a workload on the router host, where Caddy has not been measured beside the router's own public origin. Change nothing.
- `self` is any other value, or it is absent. Fleet member. Continue.

When the row is the router host and health was unreachable, that stop already said that connector access to the whole fleet depends on the router host. Do not say the fleet is down.

### Did a call stop for approval?

`vm.command.run` stops on `needs_confirmation` before it runs. Any other call stops there when the person's gateway policy asks to approve it. `skills/Connection Troubleshooter/` in `wiser` owns that stop: it shows the stop, and it repeats the identical call with `confirm: true` only after the person approves that stop, once.

Before handing over a read, tell the person the call is a read. Before handing over a release, tell the person it unloads the finished job and removes no log. The stop shows every `argv` value. A secret in that text is a reason to decline the stop. This skill's scripts and operands contain no secret value.

- The stop is the call this step sent. Hand it over. Take the repeated call's answer as this call's answer.
- The stop is some other call. Do not confirm it. Stop. Name the difference. Change nothing further.
- The person declines a read that this run needed before any change call. Make no further call. Nothing was changed. Deliver the report of what was read before the decline.
- The person declines a poll or a read-back after a job has started. Make no further call. Report the unit name, the invocation ID and the limit, and that asking again later reads the result through the second-run rule. Do not claim `changed` or `unchanged`.
- The person declines a release. Make no further call. The read-back stands. The job stays loaded. Do not claim `changed` or `unchanged`. A later run releases it through the second-run rule.
- The person declines a change call, the start of a job included. Make no further call. An earlier change in this run keeps the result its re-inspection gave it. Nothing changed after the decline. Deliver the report.

### What did the inspection answer?

One `vm.command.run`, a read, with `machine` set to the identifier and `argv` exactly `/bin/sh`, `-c`, the script, `sh`, and the install name. The install name is the operand. It is not written into the script. The person is told the call is a read. `<script>` is this text and no other:

```
export LC_ALL=C
install=$1
printf '%s\n' '--- token ---'
if [ -r /run/vm-job.token ]; then cat /run/vm-job.token; else printf '%s\n' none; fi
printf '%s\n' '--- jobs ---'
systemctl list-units --all --plain --no-legend 'vm-job-*'
printf '%s\n' "jobs-exit:$?"
printf '%s\n' '--- systemd ---'
systemctl --version
printf '%s\n' '--- tools ---'
for p in docker openssl curl python3 sha256sum realpath; do
  if command -v "$p" >/dev/null 2>&1; then printf '%s\n' "$p:present"; else printf '%s\n' "$p:absent"; fi
done
if command -v docker >/dev/null 2>&1; then docker compose version; printf '%s\n' "compose-exit:$?"; else printf '%s\n' compose-exit:127; fi
printf '%s\n' '--- memory ---'
free -m
printf '%s\n' '--- disk ---'
if command -v docker >/dev/null 2>&1; then
  root=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)
  printf '%s\n' "docker-root:$root"
  if [ -n "$root" ]; then df -B1 -P -- "$root"; printf '%s\n' "disk-exit:$?"; else printf '%s\n' disk-exit:127; fi
else
  printf '%s\n' disk-exit:127
fi
printf '%s\n' '--- docker ---'
if command -v docker >/dev/null 2>&1; then
  docker version --format 'server:{{.Server.Version}}'
  printf '%s\n' "docker-version-exit:$?"
else
  printf '%s\n' docker-absent
  printf '%s\n' docker-version-exit:127
fi
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
printf '%s\n' '--- install ---'
dir=/opt/$install
if [ -d "$dir" ]; then
  printf '%s\n' "dir:present"
  stat -c 'stat:%d %i %a' -- "$dir"
  if [ -f "$dir/INSTALL" ]; then printf '%s\n' '--- marker ---'; cat "$dir/INSTALL"; else printf '%s\n' marker-absent; fi
  if [ -f "$dir/compose.override.yml" ]; then printf '%s\n' '--- aliases ---'; awk '/^[[:space:]]*aliases:/{ print; exit }' "$dir/compose.override.yml"; else printf '%s\n' aliases-absent; fi
else
  printf '%s\n' dir-absent
fi
if command -v docker >/dev/null 2>&1; then
  printf '%s\n' '--- project ---'
  docker ps -aq --no-trunc --filter "label=com.docker.compose.project=$install" --format '{{.ID}} {{.Label "com.docker.compose.service"}} {{.Label "com.docker.compose.project"}}'
  printf '%s\n' "project-exit:$?"
  printf '%s\n' '--- project-volumes ---'
  docker volume ls --filter "label=com.docker.compose.project=$install" --format '{{.Name}}'
  printf '%s\n' "volumes-exit:$?"
  printf '%s\n' '--- project-network ---'
  docker network inspect --format '{{.Id}} {{index .Labels "com.docker.compose.project"}}' -- "${install}-proxy"
  printf '%s\n' "network-exit:$?"
fi
printf '%s\n' '--- token after ---'
if [ -r /run/vm-job.token ]; then cat /run/vm-job.token; else printf '%s\n' none; fi
exit 0
```

Docker's wording for an absent object is read without regard to case. A missing container prints `no such object`. A missing network prints `not found`. A missing volume prints `no such volume`.

The token is the text of each token section, or the line `none`. Both token sections have to be present. The jobs section is the `systemctl` list. `jobs-exit` is the exit of that list. The systemd section's first line begins `systemd ` and the version is the following whole number. The tools section has one line `<name>:present` or `<name>:absent` for `docker`, `openssl`, `curl`, `python3`, `sha256sum`, and `realpath`.

- The answer is not `ok` or `remote_failure` naming this identifier, or the output is `truncated`, or a section the question needs is missing. The inspection was not read. Stop. Change nothing. Do not start a job.
- Both token lines are present and the tools were read. Continue to the token question.

### Did the token hold across the inspection?

- The two token sections are the same text. That text is the token this run may start with. `none` is a token. Continue.
- They differ. A job started or finished during the read. Inspect again, once. A second difference stops the run. Change nothing.

### Is a job already loaded?

Ask when `jobs-exit` is 0. A non-zero `jobs-exit` means the list was not read. Stop. Change nothing.

- The jobs section is empty. No job is loaded. Continue.
- One unit is listed and its name matches `^vm-job-[a-z0-9]+(-[a-z0-9]+)*-[0-9]{8}t[0-9]{6}z-[0-9a-f]{6}$`. That is a loaded job. The second-run questions. Do not start another.
- Anything else. The list was not read as one job or none. Stop. Change nothing.

A loaded job that is running stops the run. Report it as running. A finished one is polled once at wait 0, classified with no `--recorded`, and the invocation ID that poll reads is the one adopted. It is read back and released with that ID, and reported as that run's. This run then starts over from its own inspection and gate, which the renewed token enforces. That start-over happens at most once. A loaded unit carrying this run's own name, after a start whose answer was lost, is this run's. Poll it.

### What is on the machine?

Take the first match.

- `docker:absent`, or `docker-version-exit` is not 0. Stop. Name the gap for a machine with no Docker, or with no Caddy running in the shape `skills/Deploy Workload/` runs it. Change nothing.
- `openssl`, `curl`, `python3`, `sha256sum`, or `realpath` is `absent`. Stop before the gate. Name the missing command. Hand that package to `skills/VM Configure/`. `sha256sum` and `realpath` are coreutils. Change nothing.
- The systemd version is below 254, or the line cannot be read. Stop. Name the gap `skills/Deploy Workload/` declares for installing Docker or pulling an image on a machine whose systemd is older than 254, which a background job needs. Copy the line. Change nothing.
- Docker is present and those tools are present and systemd is 254 or later. Continue.

### Is there room to pull?

The memory line is the `free -m` line whose first field is `Mem:`. The seventh field is available mebibytes. It has to be a whole number of at least 3927, which is 1.5 times the measured peak of a two-workspace stack, 2618 MiB. Do not require swap.

The disk line is the `df -B1 -P` data line for Docker's root, the line that is not the header. The fourth field is available bytes. It has to be a whole number of at least 8589934592, which is 8192 MiB. The three images are about 2.7 GB on disk. 8192 MiB leaves room for the pull and for the database to grow.

- `docker-root` is empty, or `disk-exit` is not 0, or either number cannot be read. Stop. The headroom was not read. Change nothing.
- Available memory is below 3927, or available bytes are below 8589934592. Stop. Name the number that was read and the number required. Change nothing. This is not a gap. The machine is too small for this install.
- Both numbers meet the bar. Continue.

### What is Caddy on this machine?

The caddy line's first field is the status. The second field is the label, unless it is empty or `<no value>` or starts with `{`, in which case there is no label. The JSON is the remainder, from the first `{`. The socket section says `socket-present` or `socket-absent`. The published ports this skill accepts are exactly two keys, `80/tcp` and `443/tcp`, each with one binding, the same `HostIp` on both, `HostPort` `80` and `443`. That `HostIp` is the source address. An empty `HostIp`, or `0.0.0.0`, is not accepted.

- `caddy-inspect-exit` is not 0, or the section contains `no such object`, compared without regard to case. Stop. Name the gap for a machine with no Docker, or with no Caddy running in the shape `skills/Deploy Workload/` runs it. Change nothing.
- The label is not `caddy`. Stop. Name that gap. Change nothing.
- The status is not `running`. Stop. Name the status. This run does not start Caddy. Name that gap. Change nothing.
- The ports JSON is missing, or it is not exactly those two bindings on one acceptable address. Stop. Name the ports. Name that gap. Change nothing.
- The socket says `socket-absent`. Stop. Name that gap. Change nothing.
- The label is `caddy`, the status is `running`, the ports match, and the socket is present. Record the source address for the first-contact operand. Do not print it as a field of the report. Continue.

### What did the config and the routes show?

An admin-API read is a successful read only when curl's exit is 0, the headers from `-D -` contain an HTTP status line of `200`, an `Etag` header is present, and the body parses as the expected JSON. The status line is the first header line. The routes body is a JSON array. The config body is JSON, and `null` is JSON. The id GET's body, when the status is `200`, is one JSON route object. Anything else on a read the skill decides on is not read: stop, change nothing. Two answers are absence, not a failed read: a config body that is null, and an id GET whose status line is `404` or whose body says the object id is unknown.

The `Etag` value is the header text after the colon, with one leading space removed and a trailing carriage return removed. `If-Match` is set to that value. The path field is the first field of that value once one layer of matching double quotes is removed. Measured: `GET /id/workload-<name>` answered `Etag: "/config/apps/http/servers/workloads/routes/0 <hash>"`, and the path field is the object's expanded config path. Measured: Caddy checks an `If-Match` against the config at the path the Etag names. A route POST carries `If-Match` set to the `Etag` from `GET /config/` in the same fresh read whose body passed the shape check, not the routes path's `Etag`, so the write proceeds only when the whole config is unchanged since that read. A `412` on that POST means the config changed anywhere.

The config body is the text after the blank line that ends the `--- config ---` headers. It is null when its only non-whitespace is `null`. The routes body is the text after the blank line that ends the `--- routes ---` headers. The saved body, when a saved section was read, is the text after the blank line that ends the `--- saved ---` headers, up to the `saved-exit` line.

The config is the shape `skills/Deploy Workload/` runs when its top-level keys are exactly `apps`, `apps` holds exactly `http`, `http` holds exactly `servers`, `servers` has exactly one key, `workloads`, and every route of that server and every route in the routes body is exactly the route that skill generates. Anything else, an `admin` block that turns persistence off included: stop, change nothing, and say Caddy carries configuration that skill did not write. The shape is judged when the config body is not null. A null body is not that shape. This skill does not write a first config.

A route is that shape only when it is exactly the generated object. Its keys are exactly `@id`, `match`, `handle`, and `terminal`. `@id` is `workload-` followed by a workload name matching `^[a-z][a-z0-9-]{1,31}$`, and the name is not `caddy`. `match` is exactly one object, that object's only key is `host`, and `host` holds exactly one hostname. That hostname contains no `*`. `handle` is exactly one object, and that object's keys are exactly `handler` and `upstreams`. `handler` is `reverse_proxy`. `upstreams` is exactly one object, and that object's only key is `dial`. `dial` is that same workload name, a colon, and a port. A port here is a whole number from 1 to 65535, written in digits, with no sign and no leading zero. `terminal` is true. Hostnames are compared case-insensitively when the question asks whether a hostname is present. Any other route in the server stops the run.

A hostname is present when some route's host list contains it, compared case-insensitively. The id `workload-<alias>` is present when some route's `@id` is that string.

- The config was not a successful read, or the routes were not a successful read. Stop. Change nothing.
- The config body is null, or the config is not that shape, or a route that was read is not exactly that object. Stop. Name the gap for a machine with no Docker, or with no Caddy running in the shape `skills/Deploy Workload/` runs it. Say Caddy carries configuration that skill did not write, when the body was read and was not the shape. Change nothing.
- The shape holds and the routes were a successful read. Continue.

### What is the install name on this machine?

Job 1. Take the first match.

- `dir-absent`, `project-exit` is 0 and the project section is empty, `volumes-exit` is 0 and the volumes section is empty, and `network-exit` is not 0 and the network section contains `not found`, compared without regard to case. The name is free. Continue.
- The directory is present, or any container, volume, or network was read for this install name. Stop. The name is taken. Do not remove it in this run. Name Job 3 only when the marker section contains the lines `skill=deploy-twenty`, `release=v2.45.6`, and `project=` followed by this install name, each as a whole line. Otherwise say the name is taken by something this skill did not mark. Change nothing.
- A section was not read. Stop. Copy the section. Change nothing.

Job 2 and Job 3. Take the first match.

- The marker section's lines include `skill=deploy-twenty`, `release=v2.45.6`, `compose-sha256=bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d`, and `project=` followed by this install name, each as a whole line, and `stat:` was read. This is an install this skill made. Continue.
- The directory is absent, or the marker is absent, or a line does not match. Stop. This skill does not change an install it did not mark. Change nothing.

### Has the person confirmed Cloudflare for SaaS, before the plan?

Ask on Job 1 when `<cloudflare_saas>` is not `none`. DNS for `<base>` and for `app.<base>` is handed to `experts/IT Expert/` in `wiser` either way, before the plan. This skill does not write a record.

- The person says the zone's Custom Hostnames setting is on, and a proxied record is the fallback origin pointing at this machine. Continue. This skill does not write that setting. When they do not say it, stop. Name the gap for Cloudflare for SaaS's custom-hostname setting and fallback origin on a zone, which the person turns on in Cloudflare's dashboard. Send nothing.
- `<cloudflare_saas>` is `none`. Do not ask. The report says no workspace can take its own domain. Continue.

### What does the plan contain?

One plan, the calls that apply, in this order. A call that the questions skipped is not in the plan. The plan names the machine, the role, the inspection verbatim, every call, and the way back. No route is in the plan before the gate.

Job 1:

1. The pull job. Purpose `twenty-pull`, limit 1800, three operands, the references below, in this order. `twentycrm/twenty@sha256:dca6d82985901468b391c0335aa8f0519a52b9809709e66f2de1dbff04351e53`, then `postgres@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65`, then `redis@sha256:c94085d298b738be22c9ccdc0ac3761fa6649df7dd82ad1d42367f3cb9714935`.
2. The install job. Purpose `twenty-install`, limit 300, the sixteen operands below. It writes the directory and starts nothing.
3. The person runs the helper over a shell they hold on the machine, outside the router. On Oracle, that shell is the route `skills/Prepare VM/providers/oracle.md` names, Cloud Shell's ephemeral private network. The plan names the helper path and the key names. It does not name a secret value.
4. The length read.
5. The start job. Purpose `twenty-start`, limit 1800, one operand, the install name.
6. A read of the server's published ports.
7. The three writer calls that place the first-contact program, then the one first-contact call. That call creates the server admin and the first workspace on the install's Docker network, and posts the `app.<base>` route and the first workspace's route only after `workspace:ok` and the password file is removed. The order is the first-contact question.
8. The base route, one POST, only after first-contact has created the workspace.
9. The checks from outside the machine, then the memory read, then a closing re-inspection.

Job 2's plan is the route question. Job 3's plan is the removal question. Neither sends a pull.

The way back for Job 1 is Job 3, named and not sent in this run. The way back for one route is Job 2 with the word `remove`, named and not sent in this run. Images are not removed by either.

A re-inspection between two planned jobs reads the token the next start uses. The calls stay the ones this plan named. A re-inspection whose facts change a later call, a token renewal alone excluded, stops. The changed calls are a new plan, gated again. Do not start them on the old gate.

### Is the plan gated?

A run whose inspection shows nothing to change writes nothing and takes no gate. Job 1 always has a change when it reaches this question. Job 2 and Job 3 take this question only when a change call remains.

When there is a change, hand the plan to `experts/DevOps Expert/` with `<live_state>`, in a second context, before any change. `<live_state>` is the inspection output copied verbatim. The plan names every call in order and the way back. A job names its purpose, its unit name, its limit, the token, the script, and the operands. A route POST is one object appended through the admin API, with `If-Match` set to the `Etag` from the same `GET /config/` whose body passed the shape check, not the routes path's `Etag`. It is not a whole-config replacement. A `412` on that POST means the config changed anywhere.

- Safe as planned. Continue. The approval question still applies to each change call.
- Safe with named conditions. Tell the person. A condition that changes the calls goes back into the plan and is gated again. A condition that does not change the calls: send nothing until the person accepts it and says it is met. They decline it: stop with no change call. The report names the conditions and their answer.
- Not as proposed. Stop. No change call.
- The work is a gap this expert declares. Stop. The verdict names it. No change call.

### The pull job

Write the script verbatim to the temporary directory. The first line is exactly `set -eu`. Run `start` with `--purpose twenty-pull`, `--limit 1800`, `--token` the token the latest inspection read, `--script` that file, and the three references as operands, in the plan's order. Send the `argv` it prints, unchanged. Then the job question.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
for ref in "$@"; do
  docker pull -- "$ref"
  printf '%s\n' '--- digest ---'
  docker image inspect --format '{{index .RepoDigests 0}}' -- "$ref"
done
```

The pull counts only when the job's class is `succeeded` and, for each reference, the text after the first `]: ` on a `--- digest ---` marker's following line equals that reference. A tag is not accepted. A mismatch stops the run. Do not start the install job. Images already pulled stay. Their removal is not this run.

### The install job

The operands, in order, are the install name, the server URL `https://<base>` with no path and no trailing slash, the region, the bucket, the endpoint, the from address, the from name, the SMTP host, the SMTP port, the SMTP user, the base hostname, the driver, the word `saas` or the word `none`, the zone id or the single character `x` when the word is `none`, the DCV delegation id or `x` when the word is `none`, and the alias list. The alias list is `<install>-base,<install>-app,<install>-<subdomain>` with commas and no spaces. The zone and the DCV id are not secrets. The character `x` is unused when the word is `none`, and it is not written into `.env`.

Write the script verbatim. Run `start` with `--purpose twenty-install`, `--limit 300`, `--token` the token the latest inspection read, `--script` that file, and those operands. Send the `argv` it prints, unchanged. Then the job question.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1 url=$2 region=$3 bucket=$4 endpoint=$5 from=$6 fname=$7
smtphost=$8 smtpport=$9 smtpuser=${10} smtpname=${11} driver=${12}
saas=${13} zone=${14} dcv=${15} aliases=${16}
dir=/opt/$install
if [ -e "$dir" ]; then echo exists; exit 20; fi
mkdir -m 700 "$dir"
cd "$dir"
curl -fsSL --max-time 60 -o compose.yml "https://raw.githubusercontent.com/twentyhq/twenty/6007ad5a7f6cb676fd8a9ff0c2a86a2e3d4c260e/packages/twenty-docker/docker-compose.yml"
got=$(sha256sum compose.yml | awk 'NR==1{print $1}')
[ "$got" = bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d ] || { echo compose-sha-mismatch; exit 21; }
echo compose-sha:ok
envb='      IS_MULTIWORKSPACE_ENABLED: "true"
      DEFAULT_SUBDOMAIN: app
      STORAGE_S3_ACCESS_KEY_ID: ${STORAGE_S3_ACCESS_KEY_ID:-}
      STORAGE_S3_SECRET_ACCESS_KEY: ${STORAGE_S3_SECRET_ACCESS_KEY:-}
      EMAIL_DRIVER: smtp
      EMAIL_FROM_ADDRESS: ${EMAIL_FROM_ADDRESS}
      EMAIL_FROM_NAME: ${EMAIL_FROM_NAME}
      EMAIL_SMTP_HOST: ${EMAIL_SMTP_HOST}
      EMAIL_SMTP_PORT: ${EMAIL_SMTP_PORT}
      EMAIL_SMTP_USER: ${EMAIL_SMTP_USER}
      EMAIL_SMTP_PASSWORD: ${EMAIL_SMTP_PASSWORD:-}
      EMAIL_SMTP_NAME: ${EMAIL_SMTP_NAME}
      EMAILING_DOMAIN_DRIVER: ${EMAILING_DOMAIN_DRIVER}
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      CLOUDFLARE_API_KEY: ${CLOUDFLARE_API_KEY:-}
      CLOUDFLARE_ZONE_ID: ${CLOUDFLARE_ZONE_ID:-}
      CLOUDFLARE_DCV_DELEGATION_ID: ${CLOUDFLARE_DCV_DELEGATION_ID:-}'
cat > compose.override.yml <<EOF
services:
  server:
    image: \${TWENTY_IMAGE}
    ports: !reset []
    healthcheck:
      start_period: 900s
    environment:
$envb
    networks:
      default: {}
      proxy:
        aliases: [$aliases]
  worker:
    image: \${TWENTY_IMAGE}
    environment:
$envb
  db:
    image: \${PG_IMAGE}
  redis:
    image: \${REDIS_IMAGE}
networks:
  proxy:
    name: ${install}-proxy
EOF
umask 077
pg=$(openssl rand -hex 24)
enc=$(openssl rand -base64 32)
{
  printf '%s\n' "TWENTY_IMAGE=twentycrm/twenty@sha256:dca6d82985901468b391c0335aa8f0519a52b9809709e66f2de1dbff04351e53" "PG_IMAGE=postgres@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65" "REDIS_IMAGE=redis@sha256:c94085d298b738be22c9ccdc0ac3761fa6649df7dd82ad1d42367f3cb9714935"
  printf 'SERVER_URL=%s\nSTORAGE_TYPE=s3\nSTORAGE_S3_REGION=%s\nSTORAGE_S3_NAME=%s\nSTORAGE_S3_ENDPOINT=%s\n' "$url" "$region" "$bucket" "$endpoint"
  printf 'PG_DATABASE_PASSWORD=%s\nENCRYPTION_KEY=%s\n' "$pg" "$enc"
  printf 'EMAIL_FROM_ADDRESS=%s\nEMAIL_FROM_NAME="%s"\nEMAIL_SMTP_HOST=%s\nEMAIL_SMTP_PORT=%s\nEMAIL_SMTP_USER=%s\nEMAIL_SMTP_NAME=%s\nEMAILING_DOMAIN_DRIVER=%s\n' "$from" "$fname" "$smtphost" "$smtpport" "$smtpuser" "$smtpname" "$driver"
  if [ "$saas" = saas ]; then printf 'CLOUDFLARE_ZONE_ID=%s\nCLOUDFLARE_DCV_DELEGATION_ID=%s\n' "$zone" "$dcv"; fi
} > .env
unset pg enc
chmod 600 .env
{ echo STORAGE_S3_ACCESS_KEY_ID; echo STORAGE_S3_SECRET_ACCESS_KEY; echo EMAIL_SMTP_PASSWORD
  if [ "$driver" = RESEND ]; then echo RESEND_API_KEY; fi
  if [ "$saas" = saas ]; then echo CLOUDFLARE_API_KEY; fi
  echo ADMIN_PASSWORD; } > secrets.list
chmod 600 secrets.list
cat > set-secrets <<'EOF'
#!/bin/bash
set -eu
cd "$(dirname "$0")"
[ "$(id -u)" -eq 0 ]
umask 077
while IFS= read -r k || [ -n "$k" ]; do
  [ -n "$k" ] || continue
  read -rsp "Type ${k} and press Enter. Nothing will show. " v || true
  echo
  case "$v" in ''|*[[:space:]]*) echo "refused:$k:empty-or-whitespace"; exit 1 ;; esac
  n=${#v}
  if [ "$k" = ADMIN_PASSWORD ]; then printf '%s\n' "$v" > admin.password; chmod 600 admin.password
  else grep -v "^$k=" .env > .env.new || true; printf '%s=%s\n' "$k" "$v" >> .env.new; mv .env.new .env; chmod 600 .env; fi
  unset v
  echo "saved:$k:length:$n"
done < secrets.list
echo helper-done
EOF
chmod 700 set-secrets
printf 'skill=deploy-twenty\nrelease=v2.45.6\ncompose-sha256=%s\nproject=%s\n' "$got" "$install" > INSTALL
chmod 644 INSTALL
docker compose -p "$install" config --quiet
echo "env-keys:$(cut -d= -f1 .env | tr '\n' ' ')"
echo "aliases:$aliases"
echo install-files-written
```

The job generates `PG_DATABASE_PASSWORD` with `openssl rand -hex 24`, which is 48 hex characters, and `ENCRYPTION_KEY` with `openssl rand -base64 32`, which is 44 characters and does not wrap, the trailing newline removed by the command substitution. It writes them into `.env` and prints only key names. A line of the read-back that contains `PG_DATABASE_PASSWORD=`, `ENCRYPTION_KEY=`, `CLOUDFLARE_API_KEY=`, `EMAIL_SMTP_PASSWORD=`, `RESEND_API_KEY=`, `STORAGE_S3_SECRET_ACCESS_KEY=`, `STORAGE_S3_ACCESS_KEY_ID=`, or `ADMIN_PASSWORD=` is withheld. Say that the line was withheld. Do not copy it.

The install counts only when the job's class is `succeeded` and the text after `]: ` includes `compose-sha:ok`, `install-files-written`, and an `env-keys:` line whose names are the keys and not the values. `compose-sha-mismatch` or `exists` is a failed install. Do not start the helper. Do not start containers. The directory may already exist. A new plan is gated before anything further is written. Do not delete the directory in this run. Name Job 3 only when a later inspection shows the marker.

The override maps into both server and worker every variable the shipped compose file does not set: `IS_MULTIWORKSPACE_ENABLED`, `DEFAULT_SUBDOMAIN`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `EMAIL_DRIVER`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, `EMAIL_SMTP_NAME`, `EMAILING_DOMAIN_DRIVER`, `RESEND_API_KEY`, `CLOUDFLARE_API_KEY`, `CLOUDFLARE_ZONE_ID`, and `CLOUDFLARE_DCV_DELEGATION_ID`. It pins the three images by digest, removes the server's published port, gives the server's health check a start period of 900 seconds, and joins the server to the proxy network under the aliases. `STORAGE_TYPE` is `s3`. `STORAGE_S3_REGION`, `STORAGE_S3_NAME`, and `STORAGE_S3_ENDPOINT` are in `.env`, which the shipped compose file already interpolates. `EMAIL_DRIVER` is `smtp`. `EMAIL_SMTP_NAME` is the base hostname. `IS_EMAIL_VERIFICATION_REQUIRED` stays at Twenty's default, off. `IS_IMAP_SMTP_CALDAV_ENABLED` stays at Twenty's default, on. The report says so. Google and Microsoft mail and sign-in stay off. `RESEND_WEBHOOK_SIGNING_SECRET` and `RESEND_DOMAIN_REGION` stay unset. Leaving the signing secret unset means signatures on `/webhooks/messaging/resend` are not verified. Leaving the region unset means Resend provisions a new emailing domain in its default region.

Every compose command passes `-p` and the install name, because the fetched file sets its own project name and this skill does not edit that file. The file's hash would change if it were edited. If a later read shows the project label is not the install name, stop. Do not treat those containers as this install. Do not remove them with Job 3. Report the ids and that they were not removed. A new plan is gated before any removal of them.

### What does the person run?

Ask only after the install job counted. The helper is `/opt/<install>/set-secrets`, mode 700, run with sudo, over the shell the person holds. It prompts with `read -rsp`, one key at a time, for exactly the keys in `secrets.list`: `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `EMAIL_SMTP_PASSWORD`, `RESEND_API_KEY` when the driver is `RESEND`, `CLOUDFLARE_API_KEY` when `<cloudflare_saas>` is not `none`, and `ADMIN_PASSWORD`. `EMAIL_SMTP_PASSWORD` is a Cloudflare API token with Email Sending: Edit, on the account where the from address's domain is onboarded for sending. `RESEND_API_KEY` is a full-access key, because Twenty creates, verifies and deletes domains through it as well as sending. `CLOUDFLARE_API_KEY` is a token with Zone, SSL and Certificates, Edit on that zone. The server admin's password goes to `admin.password`, mode 600, which the first-contact call deletes after the workspace exists.

The helper refuses an empty value or a value that contains whitespace. It writes under umask 077, it never echoes, and it prints `saved:<key>:length:<n>` and then `helper-done`. The person reads those lines back. A value is not repeated into the conversation.

Where the person saved a value to a file on their computer, and `pbcopy` is present, the session may load the clipboard with a command that prints only the length: `n=$(tr -d '\r\n' < "$file" | wc -c | tr -d ' '); tr -d '\r\n' < "$file" | pbcopy; printf 'clipboard-length:%s\n' "$n"`. The person pastes into the helper. Then the session empties the clipboard with `printf '' | pbcopy`. When `pbcopy` is absent, do not invent another command and do not print the file. Ask the person to paste into the helper themselves.

A vendor token is recovered by reissuing it at the vendor and typing it again through the helper. The admin password is recovered by a reset through team email, after team email has been shown to authenticate. The encryption key and the database password have no other copy until a backup holds them. That is why no real contact goes onto the install until a backup has been restored with the same key.

Creating the bucket, the API tokens and the sending accounts is the person's work with each vendor. Name that gap in the report. This skill does not create them.

- The person says the helper printed `helper-done` and one `saved:` line for each key in the plan. Continue to the length read.
- The person says a prompt refused a value, or they did not run it. Do not start containers. The files stay. A later run of the helper is the same plan only when no file changed. Otherwise gate again.

### What did the length read show?

One `vm.command.run`, a read. `argv` is `/bin/sh`, `-c`, the script, `sh`, and the install name. The person is told it is a read. `<script>` is this text and no other:

```
export LC_ALL=C
install=$1
dir=/opt/$install
if [ ! -d "$dir" ]; then echo dir-absent; exit 0; fi
cd "$dir"
printf '%s\n' '--- lengths ---'
if [ -f .env ]; then
  awk -F= '{ print $1, length(substr($0, index($0, "=") + 1)) }' .env
else
  printf '%s\n' env-absent
fi
printf '%s\n' '--- admin-bytes ---'
if [ -f admin.password ]; then wc -c < admin.password; else printf '%s\n' admin-password-absent; fi
printf '%s\n' '--- modes ---'
for f in .env admin.password set-secrets . INSTALL secrets.list compose.yml compose.override.yml; do
  if [ -e "$f" ]; then stat -c '%a %n' -- "$f"; else printf '%s\n' "absent:$f"; fi
done
printf '%s\n' '--- env-new ---'
if [ -e .env.new ]; then printf '%s\n' env-new:present; else printf '%s\n' env-new:absent; fi
exit 0
```

Withhold any line that contains a secret assignment as the install question lists them. Do not cat `.env`.

- `env-new:present`. Stop. Do not print that file. Tell the person to remove `/opt/<install>/.env.new` over the shell they hold, without displaying it. Do not start containers.
- A required key is missing, or its length is 0. Stop. Do not start. The helper has not finished.
- `PG_DATABASE_PASSWORD` length is not 48, or `ENCRYPTION_KEY` length is not 44. Stop. Do not print the value. Do not start.
- `admin.password` is absent, or its byte count is less than 2. A byte count of 1 is only a newline. Stop. Do not start.
- `.env` mode is not 600, `admin.password` mode is not 600, `set-secrets` mode is not 700, or the directory mode is not 700. Stop. Do not start.
- Every required key has a length of at least 1, the two generated lengths match, the admin file's byte count is at least 2, and the modes match. The byte count is the helper's length plus 1, for the trailing newline. Continue.

### The start job

Write the script verbatim. Run `start` with `--purpose twenty-start`, `--limit 1800`, `--token` the token the latest inspection read, `--script` that file, and the install name as the only operand. Then the job question.

`<script>` is this text and no other:

```
set -eu
install=$1
cd "/opt/$install"
docker compose -p "$install" up -d --wait --wait-timeout 1200
net=$(docker network inspect --format '{{.Id}} {{index .Labels "com.docker.compose.project"}}' "${install}-proxy")
echo "network:$net"
nid=${net%% *}
test "${net#* }" = "$install"
caddy=$(docker inspect --format '{{.Id}} {{index .Config.Labels "deploy-workload"}}' caddy)
echo "caddy:$caddy"
cid=${caddy%% *}
test "${caddy#* }" = caddy
if ! docker inspect --format '{{json .NetworkSettings.Networks}}' "$cid" | grep -q "$nid"; then docker network connect "$nid" "$cid"; fi
for svc in server worker db redis; do
  id=$(docker compose -p "$install" ps -aq -- "$svc")
  line=$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} {{.RestartCount}}' "$id")
  echo "container:$svc:$id:$line"
done
for svc in server worker; do
  docker compose -p "$install" exec -T "$svc" sh -c 'u=$PG_DATABASE_URL; u=${u#*://}; u=${u%@*}; u=${u#*:}; echo "length:'"$svc"':PG_DATABASE_URL_PASSWORD:${#u}"; for k in ENCRYPTION_KEY STORAGE_S3_ACCESS_KEY_ID STORAGE_S3_SECRET_ACCESS_KEY EMAIL_SMTP_PASSWORD RESEND_API_KEY CLOUDFLARE_API_KEY CLOUDFLARE_ZONE_ID CLOUDFLARE_DCV_DELEGATION_ID; do eval "n=\${#$k}"; echo "length:'"$svc"':$k:$n"; done'
done
docker compose -p "$install" exec -T server node -e 'const https=require("https"),tls=require("tls"),E=process.env,L=console.log;function get(h,p,k,ok){return new Promise(r=>{if(!k)return r("skipped");const q=https.get({hostname:h,path:p,headers:{Authorization:"Bearer "+k},timeout:2e4},s=>{let b="";s.on("data",d=>b+=d);s.on("end",()=>r(ok(s.statusCode,b)))});q.on("error",()=>r("fail"));q.on("timeout",()=>{q.destroy();r("fail")})})}function smtp(){return new Promise(r=>{let s=0,b="";const c=tls.connect({host:E.EMAIL_SMTP_HOST,port:+E.EMAIL_SMTP_PORT,servername:E.EMAIL_SMTP_HOST});const W=x=>c.write(x+"\r\n");const z=(m)=>{L(m);c.destroy();r()};c.setTimeout(15e3,()=>z("smtp-auth:fail:timeout"));c.on("error",()=>z("smtp-auth:fail:connect"));c.on("data",d=>{b+=d;let i;while((i=b.indexOf("\n"))>=0){const l=b.slice(0,i).replace(/\r/,"");b=b.slice(i+1);const k=l.slice(0,3);if(!s&&k=="220"){s=1;W("EHLO "+E.EMAIL_SMTP_NAME)}else if(s==1&&k=="250"&&l[3]==" "){s=2;W("AUTH LOGIN")}else if(s==2&&k=="334"){s=3;W(Buffer.from(E.EMAIL_SMTP_USER).toString("base64"))}else if(s==3&&k=="334"){s=4;W(Buffer.from(E.EMAIL_SMTP_PASSWORD).toString("base64"))}else if(s==4&&k=="235")z("smtp-auth:ok");else if(s>1&&k[0]>"3")z("smtp-auth:fail:"+k)}})})}(async()=>{const cf=await get("api.cloudflare.com","/client/v4/zones/"+E.CLOUDFLARE_ZONE_ID+"/custom_hostnames",E.CLOUDFLARE_API_KEY,(c,b)=>{const m=b.match(/"total_count": *([0-9]+)/);return c===200&&/"success": *true/.test(b)&&m?"true:"+m[1]:"fail"});L("cloudflare-list:"+cf);const rs=await get("api.resend.com","/domains",E.RESEND_API_KEY,(c,b)=>c===200?String((b.match(/"id"/g)||[]).length):"fail");L("resend-domains:"+rs);await smtp();let A;for(const p of["@aws-sdk/client-s3","/app/packages/twenty-server/node_modules/@aws-sdk/client-s3"]){try{A=require(p);break}catch(e){}}if(!A){L("s3-client:absent");return}const s3=new A.S3Client({region:E.STORAGE_S3_REGION,endpoint:E.STORAGE_S3_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:E.STORAGE_S3_ACCESS_KEY_ID,secretAccessKey:E.STORAGE_S3_SECRET_ACCESS_KEY}});const B=E.STORAGE_S3_NAME,K="dt-probe",D=Buffer.from(K);try{await s3.send(new A.PutObjectCommand({Bucket:B,Key:K,Body:D}));L("s3-put:ok");const g=await s3.send(new A.GetObjectCommand({Bucket:B,Key:K}));const x=Buffer.from(await g.Body.transformToByteArray());L("s3-get:"+(x.equals(D)?"match":"mismatch"));await s3.send(new A.DeleteObjectCommand({Bucket:B,Key:K}));L("s3-delete:ok")}catch(e){L("s3-fail:"+(e.name||"error"))}})().catch(()=>L("checks:fail"))' || echo checks:fail
echo done
```

The start counts only when the job's class is `succeeded`, the text after `]: ` includes `done`, and every check below passes. A check that fails does not get a route. Do not remove the install in this run. Name Job 3. Report the lines.

The checks, read from the text after `]: `, and never from a value:

- `network:` lists an id and the project label equals the install name. `caddy:` lists an id and the label is `caddy`.
- `container:server:`, `container:db:`, and `container:redis:` each show status `running`, health `healthy`, and restart count `0`. `container:worker:` shows status `running`, health `none`, and restart count `0`. The worker has no health check of its own. A restart count above 0 does not pass.
- For server and worker, `PG_DATABASE_URL_PASSWORD` has length exactly 48, which is the job's generated password (`openssl rand -hex 24`), so the compose default `postgres` (8) fails it. `ENCRYPTION_KEY`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, and `EMAIL_SMTP_PASSWORD` each have a length above 0. `RESEND_API_KEY` has a length above 0 when the driver is `RESEND`, and 0 when the driver is `LOG`. `CLOUDFLARE_API_KEY`, `CLOUDFLARE_ZONE_ID`, and `CLOUDFLARE_DCV_DELEGATION_ID` each have a length above 0 when `<cloudflare_saas>` is not `none`, and 0 when it is `none`. The line is `length:<service>:<key>:<n>`. A line that shows a value instead of a number is withheld.
- `cloudflare-list:skipped` passes only when `<cloudflare_saas>` is `none`. Otherwise the line is `cloudflare-list:true:<digits>`. Any other line fails. The count is the zone's custom-hostname total. The token is not printed.
- `resend-domains:skipped` passes only when the driver is `LOG`. Otherwise the line is `resend-domains:` and a whole number, `0` included. `resend-domains:fail` fails.
- `smtp-auth:ok` passes. Any other `smtp-auth:` line fails.
- `s3-put:ok`, `s3-get:match`, and `s3-delete:ok` all three pass. `s3-client:absent`, `s3-get:mismatch`, `s3-fail:`, or `checks:fail` fails.

`node` on the server image's `PATH`, the module path `@aws-sdk/client-s3` or `/app/packages/twenty-server/node_modules/@aws-sdk/client-s3`, `forcePathStyle`, and `transformToByteArray` are not yet proved on this image. A miss prints `checks:fail` or `s3-client:absent` and the check fails closed. Do not invent a different client in this run.

The length idiom inside the containers is not yet proved on the image's shell. A length line that is not `length:<service>:<key>:<digits>` fails the check.

Compose `--wait` treats a worker with no health check as ready once it has started. If the worker line is missing, the check fails.

### What ports does the server publish?

Ask only after the start checks passed. One read. `argv` is `docker`, `inspect`, `--format`, `{{json .HostConfig.PortBindings}}`, `--`, and the server container id from the start read-back. The person is told it is a read.

- The output is `{}` or `null`. The server publishes no port. Continue.
- Anything else. Stop. Do not add a route. The override did not remove the published port. Name Job 3. Do not remove the install in this run.

### What writes the first-contact program?

The program does not fit in one router argument. The connector bounds one `argv` element at 4096 code points, and the program is longer. Three reads-as-writes place it, and a fourth call runs it. The three writes contain no secret and add no route. Each is one `vm.command.run`. `argv` is `/bin/sh`, `-c`, the script, `sh`, and the install name. Send the first, then the second, then the third, once each. Do not send the run until each printed `writer-ok`. The third write parses the assembled program and sets its mode to 600. No `writer-ok` from it means the program was not assembled.

`<script>` for the first write is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
test -d "/opt/$install"
umask 077
cat > "/opt/$install/first-contact.py" << 'FCEND'
import json,os,socket,ssl,sys,time,http.client
a=sys.argv
if len(a)!=11 or a[1] not in ("full","routes-only"):
 print("args:refused"); raise SystemExit(2)
mode,install,addr,apph,appa,subh,suba,email,name,slug=a[1:]
t0=time.monotonic()
stf="/opt/"+install+"/first-contact.state"
path="/opt/"+install+"/admin.password"
owned={"ok":False}
def quiet(t,v,tb):
 print("program:fail")
 print("owned:routes-incomplete" if owned["ok"] else "admin-password-file:kept")
sys.excepthook=quiet
def note(line):
 fd=os.open(stf,os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
 os.fchmod(fd,0o600)
 os.write(fd,(line+"\n").encode()); os.fsync(fd); os.close(fd)
def gate(step):
 if time.monotonic()-t0>35:
  print("deadline:"+step)
  print("owned:routes-incomplete" if owned["ok"] else "admin-password-file:kept")
  raise SystemExit(60)
def private4(s):
 p=s.split(".")
 if len(p)!=4: return False
 try: n=tuple(int(x) for x in p)
 except Exception: return False
 if any(x<0 or x>255 or (len(p[i])>1 and p[i][:1]=="0") for i,x in enumerate(n)): return False
 a0,b=n[0],n[1]
 if a0==10: return True
 if a0==172 and 16<=b<=31: return True
 return a0==192 and b==168
ALPH="abcdefghijklmnopqrstuvwxyz0123456789-"
def shap(c):
 try:
  if [set(c),set(c["apps"]),set(c["apps"]["http"]),set(c["apps"]["http"]["servers"])]!=[{"apps"},{"http"},{"servers"},{"workloads"}]: return False
  rs=c["apps"]["http"]["servers"]["workloads"]["routes"]
  if not isinstance(rs,list): return False
  for rt in rs:
   if set(rt)!={"@id","match","handle","terminal"} or rt["terminal"] is not True: return False
   w=rt["@id"][9:]
   if rt["@id"][:9]!="workload-" or w=="caddy" or not 2<=len(w)<=32 or w[0] not in ALPH[:26] or any(x not in ALPH for x in w): return False
   m=rt["match"]; h=rt["handle"]; u=h[0]["upstreams"]
   if len(m)!=1 or set(m[0])!={"host"} or len(m[0]["host"])!=1 or "*" in m[0]["host"][0]: return False
   if len(h)!=1 or set(h[0])!={"handler","upstreams"} or h[0]["handler"]!="reverse_proxy" or len(u)!=1 or set(u[0])!={"dial"}: return False
   left,port=u[0]["dial"].split(":")
   if left!=w or not port.isdigit() or (len(port)>1 and port[0]=="0") or not 1<=int(port)<=65535: return False
  return True
 except Exception:
  return False
class U(http.client.HTTPConnection):
 def connect(self):
  s=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM); s.settimeout(8); s.connect("/var/lib/caddy-admin/admin.sock"); self.sock=s
def adm(m,p,b=None,h=None):
 c=U("localhost",timeout=8); c.request(m,p,body=b,headers=h or {}); r=c.getresponse(); d=r.read(); st,et=r.status,r.getheader("Etag"); c.close(); return st,et,d
def obj(alias,host):
 return {"@id":"workload-"+alias,"match":[{"host":[host]}],"handle":[{"handler":"reverse_proxy","upstreams":[{"dial":alias+":3000"}]}],"terminal":True}
FCEND
echo writer-ok
```

`<script>` for the second write is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
test -s "/opt/$install/first-contact.py"
umask 077
cat >> "/opt/$install/first-contact.py" << 'FCEND'
def fail(alias,status):
 print("route:%s:%s"%(alias,status))
 try: note("route:%s:%s"%(alias,status))
 except Exception: pass
 print("owned:routes-incomplete"); raise SystemExit(50)
def load():
 gate("route")
 try: st,et,data=adm("GET","/config/")
 except Exception: return None
 if st!=200 or not et: return ("bad","config-%s"%st)
 try: cfg=json.loads(data.decode())
 except Exception: return ("bad","config-not-json")
 if not shap(cfg): return ("bad","shape-refused")
 return ("ok",cfg,et)
def post(alias,host):
 got=load()
 if got is None: fail(alias,"fail")
 if got[0]!="ok": fail(alias,got[1])
 body=json.dumps(obj(alias,host),separators=(",",":")).encode()
 gate("route")
 try: st2,_,_=adm("POST","/config/apps/http/servers/workloads/routes",body,{"Content-Type":"application/json","If-Match":got[2]})
 except Exception: fail(alias,"fail")
 print("route:%s:%s"%(alias,st2))
 try: note("route:%s:%s"%(alias,st2))
 except Exception: pass
 if st2!=200:
  print("owned:routes-incomplete"); raise SystemExit(53)
def present(alias,host):
 got=load()
 if not got or got[0]!="ok": return False
 return obj(alias,host) in got[1]["apps"]["http"]["servers"]["workloads"]["routes"]
def routes(missing):
 for alias,host in ((appa,apph),(suba,subh)):
  if missing and present(alias,host):
   print("route:%s:200"%alias); note("route:%s:200"%alias)
  else: post(alias,host)
def tls():
 left=35-(time.monotonic()-t0)
 if left<=0.2:
  print("tls:pending"); return
 cap=8 if left>8 else left
 ctx=ssl.create_default_context(); raw=None; ok=False
 try:
  raw=socket.create_connection((addr,443),cap); raw.settimeout(cap)
  ss=ctx.wrap_socket(raw,server_hostname=apph); ss.close(); ok=True
 except Exception:
  if raw is not None:
   try: raw.close()
   except Exception: pass
 print("tls:ready" if ok else "tls:pending")
def finish():
 routes(mode=="routes-only"); note("done"); print("done"); tls(); raise SystemExit(0)
srv=os.environ.get("TWENTY_SERVER","")
if mode=="routes-only":
 try: pre=open(stf,encoding="utf-8").read().split()
 except Exception: pre=[]
 if "workspace:ok" not in pre or os.path.exists(path):
  print("routes-only:refused"); raise SystemExit(2)
 owned["ok"]=True; note("start"); print("start"); finish()
if not private4(srv):
 print("server-address:refused"); raise SystemExit(2)
note("start"); print("start")
try: pw=open(path,encoding="utf-8").read()
except Exception:
 print("admin-password:absent"); print("admin-password-file:kept"); raise SystemExit(54)
if pw.endswith("\n"): pw=pw[:-1]
if not pw or any(ch.isspace() for ch in pw):
 print("admin-password:refused"); print("admin-password-file:kept"); raise SystemExit(55)
def gql(host,q,v,tok,step):
 gate(step)
 try:
  c=http.client.HTTPConnection(srv,3000,timeout=8)
  hd={"Content-Type":"application/json","Host":host,"X-Forwarded-Host":host,"X-Forwarded-Proto":"https","Origin":"https://"+host}
  if tok: hd["Authorization"]="Bearer "+tok
  c.request("POST","/metadata",json.dumps({"query":q,"variables":v}).encode(),hd)
  r=c.getresponse(); b=r.read(); code=r.status; c.close()
 except Exception:
  print("graphql:connect-fail"); return None
 if code!=200:
  print("graphql:http:%s"%code); return None
 try: return json.loads(b.decode())
 except Exception:
  print("graphql:not-json"); return None
FCEND
echo writer-ok
```

`<script>` for the third write is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
test -s "/opt/$install/first-contact.py"
umask 077
cat >> "/opt/$install/first-contact.py" << 'FCEND'
def dig(d,*ps):
 cur=d.get("data") if isinstance(d,dict) else None
 for k in ps:
  if not isinstance(cur,dict) or k not in cur: return None
  cur=cur[k]
 return cur
def box(d,root):
 return dig(d,root,"tokens","accessOrWorkspaceAgnosticToken","token")
def known(d):
 e=d.get("errors") if isinstance(d,dict) else None
 if not isinstance(e,list) or not e or not isinstance(e[0],dict): return ""
 m=e[0].get("message"); return m if m=="User already exists" else "withheld"
def keep(msg,code):
 print(msg); print("admin-password-file:kept"); raise SystemExit(code)
F="{tokens{accessOrWorkspaceAgnosticToken{token}}}"
S="mutation($e:String!,$p:String!){signUp(email:$e,password:$p)"+F+"}"
N="mutation($e:String!,$p:String!){signIn(email:$e,password:$p)"+F+"}"
W="mutation($i:SignUpInNewWorkspaceInput){signUpInNewWorkspace(input:$i){loginToken{token} workspace{id}}}"
T="mutation($t:String!,$o:String!){getAuthTokensFromLoginToken(loginToken:$t,origin:$o)"+F+"}"
A="mutation($d:ActivateWorkspaceInput!){activateWorkspace(data:$d){id activationStatus}}"
doc=gql(apph,S,{"e":email,"p":pw},None,"signup"); token=box(doc,"signUp") if doc else None
if isinstance(token,str) and token: print("signup:ok")
elif known(doc)=="User already exists":
 print("signup:exists"); doc=gql(apph,N,{"e":email,"p":pw},None,"signin"); token=box(doc,"signIn") if doc else None
 if not (isinstance(token,str) and token): keep("signin:fail",56)
 print("signin:ok")
else: keep("signup:fail:withheld",56)
doc=gql(apph,W,{"i":{"displayName":name,"subdomain":slug}},token,"workspace")
ws=dig(doc,"signUpInNewWorkspace","workspace","id") if doc else None
login=dig(doc,"signUpInNewWorkspace","loginToken","token") if doc else None
if not (isinstance(ws,str) and ws and isinstance(login,str) and login): keep("workspace:fail",56)
print("workspace:ok"); note("workspace:ok"); pw=""
try: os.remove(path); print("admin-password-file:removed"); note("password-file:removed")
except Exception:
 print("admin-password-file:kept"); raise SystemExit(56)
owned["ok"]=True
doc=gql(subh,T,{"t":login,"o":"https://"+subh},None,"token")
access=box(doc,"getAuthTokensFromLoginToken") if doc else None
act=False
if isinstance(access,str) and access:
 doc=gql(subh,A,{"d":{"displayName":name}},access,"activate")
 act=bool(dig(doc,"activateWorkspace","activationStatus"))
login=access=""
print("activate:ok" if act else "activate:fail"); note("activate:ok" if act else "activate:fail")
finish()
FCEND
python3 -c 'import ast,sys; ast.parse(open(sys.argv[1],encoding="utf-8").read())' "/opt/$install/first-contact.py"
chmod 600 "/opt/$install/first-contact.py"
echo writer-ok
```

- Each answer came back naming this identifier, and each printed `writer-ok`. Continue.
- Any did not. Do not run first-contact. Do not add a route. The directory stays. Name Job 3. A new plan is gated before the writes are sent again.

### What does the first-contact call do?

One `vm.command.run`. It is not a job. It can outlast the endpoint's 20 seconds. Do not send this call again in this run. A later `routes-only` plan is a new plan, gated again, not a repeat of this call.

`argv` is `/bin/sh`, `-c`, the script, `sh`, then the mode, the install name, the source address, the app hostname `app.<base>`, the app alias `<install>-app`, the workspace hostname `<sub>.<base>`, the workspace alias `<install>-<subdomain>`, the admin email, the display name, and the subdomain. The password is not an operand and it is not an environment value. The program reads it from the file. The server's address is not an operand. The mode is `full` on Job 1. The mode `routes-only` is a different plan, gated again, and it is sent only when a fresh read shows the state file contains `workspace:ok`, the admin password file is absent, and one or both of the two routes are absent. It posts only the missing routes, appends to the state file, and never signs anyone up.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
ok=0
i=0
while [ "$i" -lt 3 ]; do
 c=$(docker compose -p "$2" exec -T server curl -sS -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/healthz || true)
 echo "healthz:$c"
 if [ "$c" = 200 ]; then ok=1; break; fi
 i=$((i+1))
 sleep 2
done
test "$ok" = 1
cid=$(docker compose -p "$2" ps -q server)
TWENTY_SERVER=$(docker inspect --format '{{with index .NetworkSettings.Networks "'"$2"'-proxy"}}{{.IPAddress}}{{end}}' "$cid")
export TWENTY_SERVER
exec python3 "/opt/$2/first-contact.py" "$@"
```

The shell checks `/healthz` from inside the server, up to three times. Each curl is limited to 5 seconds, with 2 seconds between tries. The loop can take about 21 seconds. It then reads the server container with `docker compose -p "$2" ps -q server` and that container's address on the network `$2-proxy` with `docker inspect`, and exports the address as `TWENTY_SERVER`. Then it runs the program.

The program records its start time. Before every network operation except the TLS probe, it stops with `deadline:<step>` when more than 35 seconds have passed. The step is `signup`, `signin`, `workspace`, `token`, `activate`, or `route`. Every socket timeout is at most 8 seconds. An operation that starts just before 35 seconds can run 8 seconds more, so with about 21 seconds of healthz loop a slow run can pass the router's 60 second limit and be killed. A kill before `workspace:ok` leaves no route and nothing public. A kill after it leaves an owned install, and the later read classifies it from the state file.

The program writes `/opt/<install>/first-contact.state`, mode 600. The file holds no secret. It appends one line and flushes that line before it continues. A `full` run that gets past the address check appends `start`, then `workspace:ok`, `password-file:removed`, `activate:ok` or `activate:fail`, `route:<alias>:<status>` for each route it settles, and `done`. `done` is written after the route lines and before the TLS probe, so a probe that is killed does not drop a finished route write.

In `full` mode the program refuses `TWENTY_SERVER` unless it is a private IPv4 address in `10.0.0.0/8`, `172.16.0.0/12`, or `192.168.0.0/16`, and no octet has a leading zero. A refusal prints `server-address:refused`, writes no state line, posts no route, and exits nonzero. An accepted address is the server container on the install's Docker network `<install>-proxy`, which is an ordinary bridge and is reachable from the host. The program calls that address with plain HTTP on port 3000. Every request sets `Host` and `X-Forwarded-Host` to the hostname it stands for, `X-Forwarded-Proto` to `https`, and `Origin` to `https://` plus that hostname. `signUp`, `signIn`, and `signUpInNewWorkspace` use `app.<base>`. `getAuthTokensFromLoginToken` and `activateWorkspace` use `<sub>.<base>`. Twenty v2.45.6 trusts those forwarded headers when the peer is in the `TRUST_PROXY` default `loopback, linklocal, uniquelocal`, which covers this bridge. A call that issues a session cookie is allowed only when `Origin` equals the request's own origin. This path is unproved on the live install. A refusal fails before any route exists.

GraphQL is `POST /metadata`. The documents are `signUp`, and `signIn` only when the error message is exactly `User already exists`, then `signUpInNewWorkspace`, then `getAuthTokensFromLoginToken`, then `activateWorkspace`. No token, no password, and no other error message is printed. Any other error is `signup:fail:withheld` or `signin:fail`. The password file stays. No route has been posted.

The program posts no route until it has printed `workspace:ok` and removed the admin password file. It then records activation. `activate:ok` means the workspace was activated. `activate:fail` means the workspace exists and activation did not finish. Either way it goes on to the routes when the deadline has not stopped it. A deadline during activation prints `deadline:activate` and `owned:routes-incomplete`, posts no route, and exits nonzero. `routes-only` does not retry activation.

The route post is a fresh `GET /config/` for the `Etag`, the shape check, and a `POST` with `If-Match` set to that `Etag`. The app route is first, then the workspace route. The body is `{"@id":"workload-<alias>","match":[{"host":["<hostname>"]}],"handle":[{"handler":"reverse_proxy","upstreams":[{"dial":"<alias>:3000"}]}],"terminal":true}`. A post that fails after ownership prints `route:<alias>:<status>` and `owned:routes-incomplete` and exits nonzero. It removes nothing. The program never deletes a route.

After the route lines the program appends `done` and probes TLS for `app.<base>`. The probe is one verified handshake to the source address on port 443, SNI `app.<base>`, with `ssl.create_default_context()`. Its socket timeout is the time left under the 35 seconds, and at most 8 seconds. It prints `tls:ready` or `tls:pending`. It does not print the certificate. It does not change the outcome, and it does not open a socket when no time is left. Certificate issuance is checked later by the outside checks.

`routes-only` posts nothing unless the state file already contains `workspace:ok` and the password file is absent. Otherwise it prints `routes-only:refused`, writes no new state line, and exits nonzero. It never signs anyone up. For each of the two routes, a fresh read that already holds the exact generated object prints `route:<alias>:200`, appends that line, and does not post again. A route that is absent is posted the same way as in `full`. An unexpected exception prints `program:fail` and either `owned:routes-incomplete` or `admin-password-file:kept`, and does not print the exception text. It removes nothing.

What did the call answer? Take the first match.

- The outcome is `uncertain`, `timeout`, `killed`, or `request_timeout`, or `status` is `vendor_error`, or the answer carries no `machine`. Do not classify the call from partial output. Do not send the call again. One later read, no sooner than 70 seconds after the call was sent. The 70 seconds cover the router's 60 second limit, the 5 second kill grace, and a margin. Then ask what the later read showed.
- The outcome is `ok`, `truncated`, or `remote_failure`, the answer names this identifier, and `healthz:200` was not printed. The program did not start. No route was posted. Nothing is public. Stop. A new plan is gated before another call.
- The mode was `routes-only`, the outcome is one of those three, the answer names this identifier, and the output contains `route:<app alias>:200` and `route:<workspace alias>:200`. It contains no `signup:` line, no `owned:routes-incomplete`, no `deadline:`, and no `program:fail`. The missing routes are in place. Do not send the call again. Continue to the base route.
- The outcome is one of those three, the answer names this identifier, and the output contains `workspace:ok`, `admin-password-file:removed`, `route:<app alias>:200`, and `route:<workspace alias>:200`. It does not contain `owned:routes-incomplete`, `deadline:`, or `program:fail`. The workspace exists and both routes are in place. `activate:ok` means it was activated. `activate:fail` means the workspace exists and activation did not finish. `tls:ready` and `tls:pending` do not change this. Do not send the call again. Continue to the base route.
- The output contains `owned:routes-incomplete`. The install is owned. A `routes-only` plan is gated again. Do not send it in this run. Do not remove a route. Removing the install is Job 3.
- The output contains `workspace:ok` and `admin-password-file:kept`. The workspace exists. The password file stays. No route was posted. Stop. A new plan is gated before another call. `routes-only` is not that plan while the password file is present.
- The output contains `server-address:refused` or `routes-only:refused`. No route was posted. A refused address writes no state line. Stop. A new plan is gated before another call.
- The output contains `signup:fail:withheld`, `signin:fail`, `workspace:fail`, `admin-password:absent`, `admin-password:refused`, or `deadline:` together with `admin-password-file:kept`, or `program:fail` together with `admin-password-file:kept`. The failure is before ownership. No route was posted. Nothing is public. The password file stays. Stop. A new plan is gated before another call.
- Any other answer. Do not send the call again. Report the lines that were printed. Do not claim the workspace exists unless `workspace:ok` was printed or a later read's state file contains it. Do not remove a route. Removing the install is Job 3.

What did the later read show?

Ask only after the unknown-outcome bullet. One `vm.command.run`. `argv` is `/bin/sh`, `-c`, the script, `sh`, and the install name. The person is told it is a read. `<script>` is this text and no other:

```
export LC_ALL=C
install=$1
printf '%s\n' '--- process ---'
if pgrep -f "/opt/$install/first-contact[.]py" >/dev/null; then printf '%s\n' process:running; else printf '%s\n' process:absent; fi
printf '%s\n' '--- state ---'
if [ -f "/opt/$install/first-contact.state" ]; then cat "/opt/$install/first-contact.state"; else printf '%s\n' state:absent; fi
printf '%s\n' '--- password ---'
if [ -e "/opt/$install/admin.password" ]; then printf '%s\n' password-file:present; else printf '%s\n' password-file:absent; fi
printf '%s\n' '--- config ---'
curl -sS -D - --max-time 10 --unix-socket /var/lib/caddy-admin/admin.sock http://localhost/config/
printf '%s\n' "config-exit:$?"
exit 0
```

The pattern is `/opt/<install>/first-contact[.]py`. The brackets keep the read's own command line from matching, so the read does not report itself as the program. The read prints the state file and whether the password file exists. It does not print the password file. Take the first match.

- `process:running`. Do not classify the call yet. Read once more, no sooner than 70 seconds after this read, with the same script. If the process is still running, stop. Say the program was still running and the state is not settled. Do not remove a route. Do not send the call again.
- `state:absent`. The program never started. Nothing is public. Stop. A new plan is gated before another call.
- The state has `start` and does not have `workspace:ok`. The program failed before ownership. Nothing is public. The password file stays. Stop. A new plan is gated before another call.
- The state has `workspace:ok` and does not have both `route:<app alias>:200` and `route:<workspace alias>:200`. The install is owned. When the read printed `password-file:absent`, `routes-only` is the next plan, gated again. When the password file is present, stop for a new plan. `routes-only` is not that plan. Do not post from this run. Do not remove a route.
- The state has `done`, or it has both of those route lines at 200. The route writes finished. `activate:ok` means the workspace was activated. Any other activate line, or none, means activation did not finish. Continue to the base route only when both route lines are 200 and the state has `workspace:ok`.
- Any other state text. Stop. Report the lines. Do not remove a route. Removing the install is Job 3.

### What adds the base route?

Ask only after `workspace:ok`. A fresh read of the config and the routes, immediately before the POST. One `vm.command.run`, a read. `argv` is `/bin/sh`, `-c`, the script, `sh`. The person is told it is a read. `<script>` is this text and no other:

```
export LC_ALL=C
printf '%s\n' '--- config ---'
curl -sS -D - --max-time 10 --unix-socket /var/lib/caddy-admin/admin.sock http://localhost/config/
printf '%s\n' "config-exit:$?"
printf '%s\n' '--- routes ---'
curl -sS -D - --max-time 10 --unix-socket /var/lib/caddy-admin/admin.sock http://localhost/config/apps/http/servers/workloads/routes
printf '%s\n' "routes-exit:$?"
printf '%s\n' '--- saved ---'
docker exec caddy cat /config/caddy/autosave.json
printf '%s\n' "saved-exit:$?"
exit 0
```

Judge the config and the routes with the config question. The saved section is read and not required to equal the live config until a removal. Take the first match.

- The config was not a successful read, or the routes were not a successful read. Stop. Do not POST.
- The shape does not hold, or the body is null. Stop. Do not POST. Say Caddy carries configuration that skill did not write, when a body was read.
- The hostname `<base>` or the id `workload-<install>-base` is present, and the gated inspection did not have it. Stop. Do not POST. The config moved. Copy the body, withholding any line the install question withholds.
- Both reads are successful, the shape holds, and the hostname is absent. POST once. `argv` is `curl`, `-sS`, `-D`, `-`, `--max-time`, `15`, `--unix-socket`, `/var/lib/caddy-admin/admin.sock`, `-H`, `Content-Type: application/json`, `-H`, `If-Match: <etag>`, `-X`, `POST`, `--data-binary`, the body, `http://localhost/config/apps/http/servers/workloads/routes`. `<etag>` is that config `Etag`. The body is exactly `{"@id":"workload-<install>-base","match":[{"host":["<base>"]}],"handle":[{"handler":"reverse_proxy","upstreams":[{"dial":"<install>-base:3000"}]}],"terminal":true}`.

What did the POST answer?

- The status line is `200`. The route is in place. Take the outside checks.
- The status line is `412`. The call changed nothing. Read the config and the routes again, once, with the same script. A re-read that is not successful: stop, do not POST again. The shape does not hold: stop, do not POST again. The hostname and the id are still absent: POST once more, with `If-Match` set to the config `Etag` from that re-read. Either is now present: stop, the config moved. A second `412` stops. Do not POST again in this run. The app route and the workspace stay.
- Any other answer. Stop. Copy it. Do not POST again. Do not claim the base route is in place.

### What did the checks from outside the machine answer?

These curls run on the session's side, not through the router. Each is `curl -sS -o /dev/null -w '%{http_code}\n' --max-time 20 https://<host>/healthz`, once for `<base>` and once for `app.<base>`. No `--resolve`, and no `-k`, on the tries that count. A public name is tried at most three times, about 20 seconds apart.

- Exit 0 and the code is `200`. Answered over verified TLS. Stop retrying that host.
- Exit 60, and this was not the third try. Wait about 20 seconds. Try again.
- Exit 60 on the third try. One extra try with `-k` inserted after `-sS`. A `-k` code of `200`: served, and not verified. That try does not pass. Any other `-k` result: not answered.
- Any other result, and fewer than three strict tries have been made. Wait about 20 seconds. Try again.
- The third strict try is not a verified `200` and is not exit 60. Not answered. Do not send `-k`.

The curl does not show that DNS or the provider firewall is in place. Hand the DNS part to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. The guest cannot set either. `skills/Deploy Workload/` names the provider firewall and the DNS record as missing from a guest. Say so. Do not add that gap to this skill's frontmatter.

### What memory does the stack use?

One `vm.command.run`, a read, after the routes. The person is told it is a read. Stack memory is not visible from outside the machine, so this read is on the machine. `argv` is `/bin/sh`, `-c`, the script, `sh`, and the install name. `<script>` is this text and no other:

```
export LC_ALL=C
install=$1
printf '%s\n' '--- ids ---'
docker ps -aq --no-trunc --filter "label=com.docker.compose.project=$install" --format '{{.ID}} {{.Label "com.docker.compose.service"}}'
printf '%s\n' '--- memory ---'
docker stats --no-stream --format '{{.ID}} {{.MemUsage}}'
printf '%s\n' "stats-exit:$?"
exit 0
```

Report `MemUsage` for the ids whose service label is `server`, `worker`, `db`, or `redis`. Do not report other containers. A missing stats line is reported as unread. It does not by itself undo a route.

### Job 2. Add or remove one hostname on an install this skill made

The map, the health, the role, the inspection, the token, the loaded-job, the Caddy, and the marker questions are the ones above. The alias label and the hostname matched before any call. The gate runs before any change call.

Adding. Read the aliases line from the inspection. It is one line. The names inside the brackets, split on commas, are the current aliases. The new alias is not already in that list, and the hostname is not already present. When either is present, stop. Do not post a second route. When the list cannot be read, stop.

The new list is the current names plus the new alias, in that order. One `vm.command.run`. `argv` is `/bin/sh`, `-c`, the script, `sh`, the install name, the server container id, the proxy network id, and then each alias as its own operand. The server id is the container whose service label is `server` and whose project label is the install name. The network id is the id from the network section whose project label is the install name. A missing id stops the run. `<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
server=$2
net=$3
shift 3
cd "/opt/$install"
list=$(printf '%s,' "$@")
list=${list%,}
tmp=$(mktemp)
awk -v a="$list" '
  BEGIN { n = 0 }
  /^[[:space:]]*aliases:/ { print "        aliases: [" a "]"; n++; next }
  { print }
  END { if (n != 1) exit 40 }
' compose.override.yml > "$tmp"
mv "$tmp" compose.override.yml
got=$(awk '/^[[:space:]]*aliases:/{ print; exit }' compose.override.yml)
echo "aliases-line:$got"
case "$got" in
  *"[$list]"*) ;;
  *) echo aliases-mismatch; exit 41 ;;
esac
lab=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$server")
test "$lab" = "$install"
nlab=$(docker network inspect --format '{{index .Labels "com.docker.compose.project"}}' "$net")
test "$nlab" = "$install"
if docker inspect --format '{{json .NetworkSettings.Networks}}' "$server" | grep -q "$net"; then
  docker network disconnect "$net" "$server"
fi
set -- docker network connect
for a in $(printf '%s' "$list" | tr ',' ' '); do
  set -- "$@" --alias "$a"
done
set -- "$@" "$net" "$server"
"$@"
echo alias-reattached
```

- The call came back and printed `alias-reattached`, and `aliases-line:` contains the new list. Then the route POST, using the config question and the same POST form as the base route, with this hostname and this alias, dial `<alias>:3000`. A `412` is handled as the base route handles it.
- The alias call did not print `alias-reattached`. Do not POST. Report the lines. A server left off the proxy network is not reachable. Do not retry in this run. A new plan is gated before another attach.
- The route POST is not 200 after the alias reattach counted. The alias is on the server and the route is not. Report that. Do not remove the alias in this run.

Removing. The route is judged before the alias changes. GET `http://localhost/id/workload-<alias>`. `argv` is `curl`, `-sS`, `-D`, `-`, `--max-time`, `10`, `--unix-socket`, `/var/lib/caddy-admin/admin.sock`, and that URL. The person is told the GET is a read.

The removal check holds only when all three are true. The GET's status line is `200`. The `Etag` path field, as the config question defines it, is `/config/apps/http/servers/workloads/routes/` followed by one or more digits and nothing else. The body is exactly the route this skill generates, with `@id` `workload-<alias>`, host equal to the hostname, compared case-insensitively, and `dial` `<alias>:3000`.

- The check holds. DELETE `http://localhost/id/workload-<alias>` with `If-Match` set to that GET's `Etag`. `argv` is `curl`, `-sS`, `-D`, `-`, `--max-time`, `15`, `--unix-socket`, `/var/lib/caddy-admin/admin.sock`, `-H`, `If-Match: <etag>`, `-X`, `DELETE`, and that URL.
- The status line is `404`, or the body says the object id is unknown. The route is already absent live. Do not DELETE. Read the saved config before the alias update, the same read a DELETE takes, and update the alias only when that file parses and no object in it has `@id` equal to `workload-<alias>`. Otherwise stop. The saved config may still hold the route.
- The check does not hold. Stop. Remove nothing. Copy the body.
- The route was not read. Stop. Remove nothing.

What did the DELETE answer?

- The status line is `200` or `404`. Read the saved config before the alias update. One read. `argv` is `docker`, `exec`, `caddy`, `cat`, `/config/caddy/autosave.json`. The route is gone only when that answer names this identifier and the output parses as JSON and no object in it has `@id` equal to `workload-<alias>`. Otherwise stop. Report the route removed live but still in the saved config. Do not change the alias.
- The status line is `412`. The call changed nothing. Stop. Do not change the alias.
- Any other answer. Stop. Do not change the alias.

The alias update runs only after the saved config was read and the route is absent from it, whether a DELETE was sent or the live GET was already 404. The new list is the current aliases without this one alias. Send the alias script with that list. The list must still contain at least one alias. Removing the last alias stops the run before the script: a server with no alias is not this question. Ask for Job 3.

- The alias call printed `alias-reattached` and the line matches the new list. The route is gone and the alias is gone. Re-inspect.
- The alias call did not. The route stays gone. The alias may still be attached. Report that. Do not DELETE again. Do not retry the alias script in this run.

A failed route POST after a successful add leaves the alias without a route. A failed alias update after a successful DELETE leaves the route gone and the alias in place. Both are reported. Neither is repaired in the same run.

### Has the person confirmed the removal?

Ask on Job 3, before the gate and before any removal call. Job 3 destroys every organisation's data on the install: the database volume, the local volume, and the directory.

- The person's words name the install and say to remove it. Record that confirmation in the plan. Continue to the gate.
- The words do not name the install, or they do not say to remove it. Ask once, naming the install. No answer, or an answer that does not name it: stop. Send nothing.

### Job 3. Remove an install this skill made

The marker question has already said this is an install this skill made. Read identities before the gate, with one read. `argv` is `/bin/sh`, `-c`, the script, `sh`, and the install name. The person is told it is a read. `<script>` is this text and no other:

```
export LC_ALL=C
install=$1
printf '%s\n' '--- ids ---'
docker ps -aq --no-trunc --filter "label=com.docker.compose.project=$install" --format '{{.ID}} {{.Label "com.docker.compose.service"}} {{.Label "com.docker.compose.project"}}'
printf '%s\n' "ids-exit:$?"
printf '%s\n' '--- volumes ---'
names=$(docker volume ls -q --filter "label=com.docker.compose.project=$install")
printf '%s\n' "volume-ls-exit:$?"
if [ -n "$names" ]; then
  # shellcheck disable=SC2086
  docker volume inspect --format '{{.Name}} {{index .Labels "com.docker.compose.project"}} {{.CreatedAt}} {{.Driver}}' $names
  printf '%s\n' "volume-inspect-exit:$?"
else
  printf '%s\n' volumes-none
fi
printf '%s\n' '--- network ---'
docker network inspect --format '{{.Id}} {{index .Labels "com.docker.compose.project"}}' -- "${install}-proxy"
printf '%s\n' "network-exit:$?"
printf '%s\n' '--- caddy ---'
docker inspect --format '{{.Id}} {{index .Config.Labels "deploy-workload"}}' caddy
printf '%s\n' "caddy-exit:$?"
printf '%s\n' '--- dir ---'
stat -c 'stat:%d %i %a' -- "/opt/$install"
printf '%s\n' "stat-exit:$?"
realpath -e -- "/opt/$install"
printf '%s\n' "realpath-exit:$?"
printf '%s\n' '--- mounts ---'
awk -v o="/opt/$install" '$2 == o || index($2, o "/") == 1 { print }' /proc/mounts
printf '%s\n' '--- marker ---'
if [ -f "/opt/$install/INSTALL" ]; then cat "/opt/$install/INSTALL"; else printf '%s\n' marker-absent; fi
printf '%s\n' '--- aliases ---'
if [ -f "/opt/$install/compose.override.yml" ]; then awk '/^[[:space:]]*aliases:/{ print; exit }' "/opt/$install/compose.override.yml"; else printf '%s\n' aliases-absent; fi
exit 0
```

Also read the config with the config script, and keep that body as the before-state. Every route whose `@id` is `workload-` plus an alias from the aliases line is this install's route. Any such route that fails the removal check stops the run. Remove nothing.

The plan removes, in order: each of this install's routes, then the saved-config and live-config comparison, then one removal job for the containers, the network, the volumes, and the directory. Images are not in the plan. `docker compose down` is not sent. A volume named `caddy-config` or `caddy-data` is refused by name. Those volumes are Caddy's, and the certificates in `caddy-data` stay.

The route deletes are the Job 2 DELETE, one alias at a time, each with its own removal check and its own saved-config read. After the last delete, read the config script once more. The live config and the saved config have to parse to the same object, and that object is the before-state with only this install's route objects removed. Every other route stays. A difference stops the run before the removal job. Report the difference. Do not delete a container. Routes already deleted stay deleted.

The removal job is sent only when the directory, the containers, the network, and the volumes were all read as this install's and still match on a fresh identity read taken after the config comparison. If the set differs, something is already absent or was recreated. Stop. Do not delete. A new plan is gated again.

The operands are the install name, the device number, the inode, the network id, the Caddy container id, the container count, each full container id, the volume count, and then each volume as a pair: the volume name, then its `CreatedAt` as one operand. `CreatedAt` may contain spaces. It is one operand, never split. More than 56 operands stops the run. Do not choose which to omit.

The job verifies every identity before it deletes anything. A mismatch exits before a delete. Enumeration that fails is a failure, not an absence. The directory is removed only when its device and inode still match, `realpath` is `/opt/<install>`, and nothing is mounted on or under it. The removal uses `rm -rf --one-file-system`.

Write the script verbatim. Run `start` with `--purpose twenty-remove`, `--limit 600`, `--token` the token the latest inspection read, `--script` that file, and those operands. Then the job question.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
dev=$2
ino=$3
net=$4
caddy=$5
nc=$6
shift 6
d=/opt/$install
mark=$(cat "$d/INSTALL")
printf '%s\n' "$mark" | grep -qx 'skill=deploy-twenty' || { echo marker-mismatch; exit 30; }
printf '%s\n' "$mark" | grep -qx 'release=v2.45.6' || { echo marker-mismatch; exit 30; }
printf '%s\n' "$mark" | grep -qx 'compose-sha256=bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d' || { echo marker-mismatch; exit 30; }
printf '%s\n' "$mark" | grep -qx "project=$install" || { echo marker-mismatch; exit 30; }
test "$(realpath -e "$d")" = "$d"
test "$(stat -c '%d %i' "$d")" = "$dev $ino"
m=$(awk -v o="$d" '$2 == o || index($2, o "/") == 1 { print }' /proc/mounts)
test -z "$m"
: > "$d/id.check"
i=0
while [ "$i" -lt "$nc" ]; do
  printf '%s\n' "$1" >> "$d/id.check"
  shift
  i=$((i + 1))
done
nv=$1
shift
: > "$d/vol.check"
i=0
while [ "$i" -lt "$nv" ]; do
  printf '%s\t%s\n' "$1" "$2" >> "$d/vol.check"
  shift 2
  i=$((i + 1))
done
got=$(docker ps -aq --no-trunc --filter "label=com.docker.compose.project=$install" | sort)
want=$(sort "$d/id.check")
test "$got" = "$want"
while IFS= read -r id; do
  test "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$id")" = "$install"
done < "$d/id.check"
test "$(docker network inspect --format '{{index .Labels "com.docker.compose.project"}}' "$net")" = "$install"
while IFS=$(printf '\t') read -r name created; do
  case "$name" in caddy-config|caddy-data|'') echo volume-refused; exit 31 ;; esac
  line=$(docker volume inspect --format '{{.Name}} {{index .Labels "com.docker.compose.project"}} {{.CreatedAt}} {{.Driver}}' "$name")
  test "$line" = "$name $install $created local"
done < "$d/vol.check"
vgot=$(docker volume ls -q --filter "label=com.docker.compose.project=$install" | sort)
vwant=$(cut -f1 "$d/vol.check" | sort)
test "$vgot" = "$vwant"
echo identities-match
while IFS= read -r id; do
  docker rm -f "$id" >/dev/null
done < "$d/id.check"
echo containers-removed
if docker inspect --format '{{json .NetworkSettings.Networks}}' "$caddy" | grep -q "$net"; then
  docker network disconnect "$net" "$caddy"
fi
docker network rm "$net" >/dev/null
echo network-removed
while IFS=$(printf '\t') read -r name created; do
  docker volume rm "$name" >/dev/null
done < "$d/vol.check"
echo volumes-removed
test "$(stat -c '%d %i' "$d")" = "$dev $ino"
rm -rf --one-file-system "$d"
test ! -e "$d"
echo directory-removed
```

The removal counts only when the job's class is `succeeded` and the text after `]: ` includes `identities-match`, `containers-removed`, `network-removed`, `volumes-removed`, and `directory-removed`, in that order, and a closing re-inspection shows the directory absent, the project containers absent, the project volumes absent, the project network absent, and the live config and the saved config still equal to the post-route before-state. `changed` requires all of that. A job that exits after `identities-match` and before `directory-removed` is not run again. Re-read. A new plan is gated before any further delete.

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
- The class is `unknown`, the facts' `status` is `uncertain`, and the facts' `action` is not `vm.command.run`. The endpoint left an earlier call in doubt and did not send this start. Nothing was started. Do not poll. Hand the answer to `skills/Connection Troubleshooter/` in `wiser`, which names the earlier call. Never send the start again without a new inspection and a new approval.
- The class is `unknown`, a `connect_timeout` or a `remote_failure` with no `start-exit:` line included, and `vendor_error`. Unknown whether it started. Poll by this run's name. A class of `running`, `deactivating`, `succeeded`, `signal`, `stuck`, `failed-exit`, `failed-timeout`, or `failed-other` means it started, and that invocation ID is the one to record. The class `not-loaded` is the history question: the tool's `journal`, and the class `no-entries` is execution history unknown. Re-inspect where a read is possible. Never repeat the change. Never send the start again without a new inspection and a new approval.
- A loaded unit carrying this run's own name is this run's, after a start whose answer was lost. Poll it.

What did the poll read?

Each poll is the tool's `poll`. The wait is at most 10 seconds, passed as `--wait`. At most six polls in a row. Each is a read, and the person is told it is a read. Save the answer. Classify with `classify --step poll --recorded` the invocation ID recorded for this run. When none was recorded, because the start's class was `unknown`, classify without `--recorded`: a poll whose class is neither `not-read` nor `unrecognized`, and whose facts carry an `invocationId` that is not null, records that ID, and every later poll passes it as `--recorded`. Until then each poll is classified without `--recorded`. Take the first match.

- The class is `other-invocation`. Stop. Change nothing. Report both IDs: the one recorded, and the `InvocationID` in the facts.
- The class is `succeeded`, `signal`, `failed-exit`, `failed-timeout`, or `failed-other`. `finished` is true. Read it back by the recorded invocation ID: the tool's `readback`, sent as the `argv` it prints, unchanged. Classify that answer. A class `truncated` is read again with fewer lines. The report names the line count in the facts. A class `read` carries the job's own journal lines, which the report copies, except a line the install question withholds. Each read-back or journal line is a journal line: a timestamp, the host, and the process, then `]: `, then the text the job printed. Every rule in this skill that reads a job's line reads the text after the first `]: `, not the whole line. A class `not-read` says the read-back was not read. The person is told the read-back is a read. Then release.
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

This question is for a `vm.command.run` that is not a job start, poll, read-back, journal, or release. Send the planned call once. The approval question applies. Do not repeat a change call on a failure or an unclear answer. Do not send the way back because a call failed. The first-contact call has its own outcomes, and those win where they differ.

- `outcome` is `ok`, `truncated`, or `remote_failure`, and the answer names this identifier in `machine`. The call came back. Read it the way the question that sent it says. Re-inspect when that question says to.
- `outcome` is `timeout`, `killed`, or `request_timeout`, or `status` is `vendor_error` or `uncertain`, or a failure outcome carries no `machine`. The outcome is unknown until the re-inspection. Say that. Re-inspect. Do not repeat the call.
- `outcome` is `busy`. The machine was not asked. Re-inspect. Do not repeat the call.
- `outcome` is `unknown_machine`. Do not repeat the call. Read `vm.inventory.list_hosts` once. Absent: it left the map, point to `skills/Prepare VM/`. Still listed: name the contradiction. Change nothing further.
- `status` is `needs_connect`, `denied`, `invalid_arguments`, or another gateway status other than `needs_confirmation` and other than `uncertain`. The call did not run as a router result. Hand the status to `skills/Connection Troubleshooter/` in `wiser`. On `needs_connect`, the module is `command` unless the answer names one. Re-inspect only when the module that reads the state is connected. Otherwise say the re-inspection could not be made. Do not claim `changed` or `unchanged`. Do not repeat the call.
- Any other answer. Name it verbatim. Re-inspect when a read of the state is still possible. Do not repeat the call.

### What did the re-inspection show?

After a job, re-inspect when the job question says to. After the base route, after Job 2's last change, or after Job 3's removal job, inspect again with the same inspection script. The approval question applies, and the person is told it is a read. A job that exited 0 is not yet `changed`.

Job 1's requested state: the four containers match the start checks, the app route and the base route are present and are exactly the generated object, `workspace:ok` was printed or the password file is absent after a call whose outcome was unknown, and both outside checks returned `200` over verified TLS. A `-k` answer is served and not verified, and it is not this state.

Job 2 add's requested state: the new route is present and is exactly the generated object, and the aliases line contains the new alias. Job 2 remove's requested state: that route is absent from the live config and from the saved config, and the aliases line does not contain that alias.

Job 3's requested state is the one its question states.

- The re-inspection is incomplete, `truncated`, absent, or not a state. Do not claim `changed` or `unchanged`. Report failed, with the change call's outcome and the re-inspection's outcome. Do not repeat the change.
- The requested state holds, and it did not hold in the before-state. `changed`.
- The requested state held before any change call. `unchanged`.
- The requested state does not hold. Failed. Name what the re-inspection shows. Do not repeat the change.

### What does the report say?

One report. For each part: what was inspected, what was planned, the gate's verdict or that no gate was taken, each call's action and its `outcome`, any `exit_code`, the output copied verbatim where the report shows it, the re-inspection, and `changed`, `unchanged`, or failed. A line that contains `PG_DATABASE_PASSWORD=`, `ENCRYPTION_KEY=`, `CLOUDFLARE_API_KEY=`, `EMAIL_SMTP_PASSWORD=`, `RESEND_API_KEY=`, `STORAGE_S3_SECRET_ACCESS_KEY=`, `STORAGE_S3_ACCESS_KEY_ID=`, or `ADMIN_PASSWORD=` is withheld, and the report says the line was withheld. A secret value is not a report line. Lengths, booleans, counts and statuses are.

The URL is `https://<base>/` and `https://app.<base>/`. The report says whether each `/healthz` answered and whether the certificate verified. It names the image digests. It does not name the source address as a field.

The report says what is configured and what is not. Team email is the install's one address over SMTP, to members, not to contacts. Email to contacts is each person's own mailbox, left enabled for IMAP, SMTP and CalDAV, and not configured. Branded or campaign email is the driver that was set, Resend or LOG. Google and Microsoft stay off. Email verification stays off. The webhook signing secret and the Resend region stay unset, with the cost of leaving each unset. When `<cloudflare_saas>` is `none`, no workspace can take its own domain. When it is set, the report says the Custom Hostnames setting and the fallback origin are the person's, and that a DNS-only CNAME inside that zone to the fallback origin is served directly by Caddy, with Caddy's certificate, and Cloudflare carries none of that name's traffic.

The report says no real contact goes onto the install until a backup has been restored with the same encryption key, and that backing up an install or restoring one is missing. It names every gap that applies: a release other than v2.45.6, a machine without Docker or without Caddy in the shape `skills/Deploy Workload/` runs it, the backup, Google and Microsoft mailboxes, the Cloudflare for SaaS setting when it was not confirmed, and creating the bucket, the tokens and the sending accounts. It names the hand-off for DNS, for a package, for workspace setup beyond the first workspace, and for a security review.

For each job, also: its unit name, its invocation ID and its limit, the last poll's state, the read-back lines the report may show and the line count shown, and the release outcome. A job not read as finished after six polls is reported in the state the last poll that was read showed, or as unknown when none was read.

## Pitfalls

- **A glob written `/*/` in a script this skill sends.** A script carrying `/*` or `*/` can come back `vendor_error` HTTP 400 before it reaches the machine, because something on the connector's path reads that pair as a database-comment attack. Do not put that pair in a script. Do not read a repeated `vendor_error` on an unchanged script as the machine's answer. `uncertain` is not that measurement. It does not establish whether the call ran.
- **The request is ambiguous.** More than one machine, more than one install, an install and a removal together, or a route change that does not name the install. Ask before any call.
- **A machine that is not on the map, or whose health is not `ok`.** Stop. Not on the map: point to `skills/Prepare VM/`. Not reachable: name the outcome the way `skills/VM Inventory/` does. Change nothing.
- **The router host.** Stop before any change. Name the gap `skills/Deploy Workload/` declares for a workload on the router host, where Caddy has not been measured beside the router's own public origin.
- **No Docker, or a Caddy that is not the shape `skills/Deploy Workload/` runs.** Stop. Name the gap for a machine with no Docker, or with no Caddy running in the shape `skills/Deploy Workload/` runs it. Do not install Docker and do not start Caddy.
- **A failure with no `machine`, called unreachable or called a finished install.** It does not establish whether the router reached the machine. On a read of health, not determined, and stop. On a change, the outcome is unknown until the re-inspection.
- **`vendor_error` treated as the machine's answer.** It does not establish whether the call ran.
- **`busy` treated as a down machine.** The machine was not asked. Do not repeat the change.
- **A value that fails its pattern, sent anyway.** Ask. Never send the other form. The install name, the hostnames, the aliases, and every secret stay out of the script text. Secrets are not operands either.
- **A secret in an `argv`, a journal line, or the report.** Withhold the line. The helper prints a length. The checks print a length, a boolean, a count, or a status.
- **A Deploy Workload workload given one of this install's alias names.** The aliases carry the install name as a prefix so they are not free workload names. A workload must not take one of them. `caddy` is not an install name and not an alias.
- **A whole-config write.** This skill does not POST to `/config/`. A route POST, and its one retry after a `412`, carry `If-Match` set to the `Etag` from the same `GET /config/` whose body passed the shape check, not the routes path's `Etag`. A `412` means the config changed anywhere. Whenever the shape is checked, the config's top-level keys are exactly `apps`, `apps` holds exactly `http`, `http` holds exactly `servers`, and `servers` has exactly one key, `workloads`. Anything else stops the run. Every route is exactly the generated object. Any other route stops the run.
- **A route added before the workspace exists.** The first-contact call creates the server admin and the first workspace on the install's Docker network before it posts a route. A failure before `workspace:ok` has posted nothing. Do not post either route in an earlier call. Do not remove the app route to recover. Removing the install is Job 3.
- **A route, a container, or a volume removed that is not this install's.** Job 3 matches the marker, the project label, the full container id, the network id, the volume name and its `CreatedAt`, and the directory's device and inode. A name alone is not ownership. `docker compose down` is not sent. Images stay. `caddy-config` and `caddy-data` stay.
- **Caddy's saved config not read back before the data is deleted.** After the route deletes, the live config and the saved config have to equal the before-state with only this install's routes removed. A difference stops the run before the removal job.
- **A second job started while one is loaded.** The second-run questions. A running job stops the run. A finished one is released and the run starts over from its inspection, once.
- **A start sent again after `token-changed`, with no new inspection and no new gate.** Nothing was started. Inspect again and gate again before any start.
- **A job's exit 0 reported as the URL answering.** The re-inspection and the outside checks decide. A stuck job is not released.
- **The install's address read as an organisation's sender.** Team email is one address for the whole install, to members. A contact is written from the sender's own mailbox. A campaign is sent from the organisation's own verified domain.
- **The base hostname read as behind Cloudflare.** A DNS-only CNAME inside the SaaS zone to the fallback origin is flattened to the machine, served by Caddy, and Cloudflare carries none of its traffic.
- **Real contacts placed before a restore.** The encryption key lives only in `.env` until a backup holds it. Backing up an install or restoring one is missing. No real contact goes on the install until a backup has been restored with the same key.
- **The fleet called down.** A router-host failure, or a `list_hosts` `vendor_error`, means connector access to the whole fleet depends on the router host. A `list_hosts` `uncertain` does not establish whether the call ran, and it does not say that. Installs keep serving.

## Success

- The report covers one machine and one install. A request that named more than one was asked, and nothing was called before the answer.
- The machine was on the map and `vm.inventory.health` was `ok` before any inspection or change. Otherwise the report says not on the map and points to `skills/Prepare VM/`, or names the health outcome the way `skills/VM Inventory/` does, and nothing was changed.
- The router host was stopped before any change, and the report names the gap `skills/Deploy Workload/` declares for a workload on the router host.
- Patterns were refused by name before any call. No secret value was an operand, an argument of a router call, a printed line, or a report line. The helper and the checks printed lengths, booleans, counts and statuses.
- The inspection was one `vm.command.run`, the person was told it is a read, and the install name was the operand. It carried both token lines. A loaded job was handled by the second-run questions before any decision to change.
- Headroom was read before the pull. Below 3927 MiB available, or below 8589934592 bytes free on Docker's filesystem, the run stopped and pulled nothing.
- No Docker, or a Caddy that was not running in the shape `skills/Deploy Workload/` runs, stopped the run, and the report names that gap. This skill did not install Docker and did not start Caddy.
- A change was sent only after `experts/DevOps Expert/` returned safe as planned, or safe with named conditions the person was told, and only after the person approved that call's stop. No route was written before that gate and that approval.
- The pull was one job, purpose `twenty-pull`, limit 1800, the three digest references the operands, and a digest that did not match was not installed. The install job, purpose `twenty-install`, limit 300, wrote the directory, checked the compose file's hash, and started nothing. The start job, purpose `twenty-start`, limit 1800, was not sent until the length read matched.
- The server published no port. The four containers matched the start checks before any route. A failed check added no route.
- The first-contact call created the server admin and the first workspace before it posted a route, in one `vm.command.run`. No route was posted before `workspace:ok` and the password file was removed. The base route was a later call. An `uncertain` or `timeout` on that call was not retried, and no route was removed to recover.
- Job 2 added an alias by reattaching the full list and then posting the route, or removed the route, confirmed the saved config, and then removed the alias. A half-finished pair was reported and not repaired in the same run.
- Job 3 ran only after the person confirmed by naming the install, and the report says the removal destroys every organisation's data on the install. It deleted only objects whose identity was read back, routes first, and it read Caddy's live and saved config back to the before-state with those routes removed, before it deleted data. Images stayed.
- The report names each check's answer, both URLs, what is configured and what is not, the three kinds of email, the base name's direct path when the zone applies, the no-real-contact rule, and every gap that applies.
- Per job the report names the unit name, the invocation ID, the limit, the last poll's state, the read-back lines it may show, and the release outcome. A job was polled at most six times, each wait at most 10 seconds. A stuck job was not released.
- DNS was handed to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. A package was handed to `skills/VM Configure/`. Workspace setup beyond the first workspace was not invented.
