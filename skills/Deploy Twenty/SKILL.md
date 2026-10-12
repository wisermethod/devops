---
name: Deploy Twenty
type: skill
category: operations
description: Install Twenty CRM v2.45.6 on one machine a person's router maps, behind the Caddy that machine already runs, including that install's mail relay when one is named, or add or remove one hostname route for an install this skill made, or remove that install, or take that install offline or bring it back online, or add, rotate or remove one relay login, replace one relay upstream token, add or remove one relay upstream, or write the relay to send or hold, and report the URL, what answered, the relay, and what is not configured.
version: 0.1.21
gaps:
  - installing a Twenty release other than v2.45.6, or upgrading an install to another release
  - a machine with no Docker, or with no Caddy running in the shape `skills/Deploy Workload/` runs it
  - connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval
  - Cloudflare for SaaS's custom-hostname setting and fallback origin on a zone, which the person turns on in Cloudflare's dashboard
  - creating the bucket, the API tokens and the sending accounts the install uses, which the person does with each vendor
  - the inbound domain's MX record and the sending service's receiving and webhook settings, which the person sets with the vendor
  - changing an existing install's emailing-domain driver
  - sending through the relay from an organisation whose Cloudflare account is not on Workers Paid
---

# Deploy Twenty

## Context

Use when one Twenty install should be created on one existing machine, or one hostname should be routed to an install this skill made, or that hostname's route should be removed, or an install this skill made should be removed, or that install should be taken offline or brought back online, or one relay login should be added, rotated or removed, or one relay upstream token replaced, or one relay upstream added or removed, or the relay written to send or hold, and the machine is one a person's router maps. One run is one machine and one install. The release is Twenty v2.45.6 and no other. The server publishes no port. The first-contact call reaches it on the install's Docker network before any route exists. Visitors reach it only through routes in the Caddy that machine already runs.

Not for a release other than v2.45.6, and not for upgrading an install to another release. That is missing: installing a Twenty release other than v2.45.6, or upgrading an install to another release. Not for a machine with no Docker, and not for a Caddy that is not already running in the shape `skills/Deploy Workload/` runs it. This skill does not install Docker, does not start Caddy, and does not write Caddy's first config. Not for backing up an install or restoring one, which is `skills/Back Up Twenty/`. Not for connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval. That is missing. Not for Cloudflare for SaaS's custom-hostname setting and fallback origin on a zone, which the person turns on in Cloudflare's dashboard. That is missing. Not for creating the bucket, the API tokens and the sending accounts the install uses, which the person does with each vendor. That is missing. Not for a hostname, a DNS record, or a zone. Hand that part to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. Not for enrolling a machine or taking one out, which is `skills/Prepare VM/`. Not for a package or a unit, which is `skills/VM Configure/`. Not for setting up an organisation's workspace beyond the first workspace's creation, its members, data model, domains and import. That is `skills/Set Up Twenty Workspace/`, owned by `experts/CRM Expert/`, which adopts the first workspace when it is the organisation's. Saving or removing a custom domain in Twenty, which creates or deletes a hostname at Cloudflare, is that workspace setup, not this skill. Not for a security review. Load `experts/IT Expert/` Rule 5 in `wiser` and apply it. Not for changing an existing install's emailing-domain driver. That is missing: changing an existing install's emailing-domain driver. Not for sending through the relay from an organisation whose Cloudflare account is not on Workers Paid. That is missing: sending through the relay from an organisation whose Cloudflare account is not on Workers Paid. Not for a secret passed through the conversation or through a router call.

Twenty sends three kinds of email, and this install must not be read as if one address did all three. A connected mailbox sends as itself: a member's own mailbox, so the contact sees that person's own address, or an organisation's shared mailbox through the relay, signed by the organisation's own domain at Cloudflare. Nothing in a member's own mailbox path uses the install's SMTP settings. This install leaves IMAP, SMTP and CalDAV mailboxes enabled and does not configure one. Google and Microsoft mail and sign-in stay off, which is the mailbox gap above. That shared mailbox's path is the relay. Twenty's emailing-domain route is separate. This skill sets that route up only when the driver is `RESEND`. Campaigns need it, and they need the feature flag `IS_MESSAGE_CAMPAIGN_ENABLED`, which this skill does not set. Changing an existing install's emailing-domain driver is missing here. Sending through the relay from an organisation whose Cloudflare account is not on Workers Paid is missing here. Branded or campaign email goes out from an organisation's own verified emailing domain, through the one driver the install is given. On a self-hosted install without an Enterprise licence the driver is Resend, or LOG when none is wanted. LOG sends nothing. AWS SES is not offered here. Team email is the third kind: invitations, password resets, verification, and the admin panel's test send, from the install's one address, to an organisation's own members, never to its contacts. The From line of an invitation shows the inviter's name as the display name and that one address, for example `Alpha Tester <crm@effectivemail.com>`. This skill configures team email. It does not configure a contact mailbox, and it does not verify an emailing domain. When the driver is Resend, this skill sets the inbound email domain (`INBOUND_EMAIL_DOMAIN`). The inbound domain's MX record and the sending service's receiving and webhook settings, which the person sets with the vendor, are not set here. That is missing.

The install's own hostname is its server address. When that name sits inside the Cloudflare for SaaS zone and its DNS record is a DNS-only CNAME to the fallback origin, Cloudflare flattens the name to the machine's address. Caddy serves it with Caddy's own certificate, and Cloudflare carries none of its traffic. Do not read that name as behind Cloudflare. A workspace custom domain that arrives through Cloudflare for SaaS reaches the origin with its own Host header, so it needs its own route, and the origin's certificate for it comes from Caddy by HTTP-01 through Cloudflare.

No real contact goes onto the install until a backup has been restored with the same encryption key. A stored secret is unrecoverable without that key. The key and the database password exist only in the install's `.env` until a backup holds them, which is `skills/Back Up Twenty/`. The first workspace is still created, so the install is not left for the first person who signs up to claim.

This plugin does not ship a router, and no primitive in this root provides one. Every call goes through a router the person already runs. The calls are `vm.inventory.list_hosts`, `vm.inventory.health`, and `vm.command.run`, and no other action. This skill never calls `vm.files.write_file` or `vm.files.read_file`.

A pull, the install write, the start, a removal, and a relay hold run as tracked background jobs. The contract is `tools/vm-job/`. A job's start, poll, read-back, journal read and release are each built with that tool's command and sent as one `vm.command.run` whose `argv` is the `argv` the tool prints, unchanged. Each answer is saved and classified with that tool's `classify`. The session never writes a starter or a release script itself. A short read, an alias reattach, a route write, and the first-contact call are `vm.command.run`. They are not jobs. They do not take the lock and they do not renew the token.

The job script, written verbatim from this skill, each direct script, written verbatim from this skill, and each saved answer, go in a temporary directory outside the plugin and outside any repository. The path passed to the tool is absolute. The tool writes nothing.

Reaching the gateway is `skills/Set Up Connectors/` and `gateway/SETUP.md` in `wiser`. Connecting a module is `skills/Connect Account/` in `wiser`. The toolkit registration is `connectors/vm/auth.md` in `wiser`. Cite those files. Do not restate them. The outcome vocabulary is `connectors/vm/CONNECTOR.md` in `wiser`. The connector passes the router's outcome string through unchanged. A gateway status is `status` on the answer. A router result is `outcome`. Do not rename either.

`vm.command.run` runs the argument vector as root. Every call, a read included, is `confirmation: always`: the gateway answers `needs_confirmation` first and runs the call only when the identical call repeats with `confirm: true` after the person approves that stop. The gateway holds a stop for 15 minutes. Each poll, read-back and release is a call, so each is an approval the person gives. A stop that the person's own gateway policy puts on any call, a read included, is the approval question below.

No secret value is asked for in the conversation, printed, placed in an operand, or written into a file in a repository. A value the person types goes only into the helper on the machine. The report prints lengths, booleans, counts and statuses. Output the report shows is copied verbatim, except a line the report question withholds.

When `<relay>` is named, Job 1 also installs that install's mail relay. The relay is a container on the install's own Docker network, with the network alias `smtp-relay`, and it is the only process that holds the upstream sending credentials. Its program comes from `tools/twenty-relay/`. When `<relay>` is absent, Job 1 is the install this skill already describes, and no relay job is sent. When `<relay>` is present and `<for_restore>` is absent, the person's helper also prompts for one token per upstream and writes it under `/opt/<install>/relay/secrets/`, and after the start job the run reads the relay container, checks SMTP from the server and the worker, and checks the outbound allowlist before first contact. `conf/state` stays `hold` through Job 1. Releasing that hold is Job 5, which Job 1 does not send.

Classifier seam: none.

## Objective

The named install is running on the named machine, behind the Caddy that machine already runs, or one hostname route has been added or removed, or the install has been removed, or the install has been taken offline or brought back online, or one relay login, token, upstream or send or hold state has been written, or it has not, and the report says which. A change is made only after a read of the live state, only after `experts/DevOps Expert/` gates the plan, and only after the person approves the stop. No route is written before that gate and that approval. The install is not reachable at its sign-in host until the server admin and the first workspace exist and the admin password file has been removed. A job's success is not the install's success. The re-inspection, and the checks from outside the machine, decide. When `<relay>` is present, the relay's directories and conf files are on the machine, its modules are installed, its service is in the override, and the relay jobs did not start it. When this is not an install for a restore, the relay container is running, each upstream token file is in place, the six relay checks passed, the outbound check printed `outbound:ok`, and `conf/state` is still `hold`. Verified against Success.

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
- `<inbound_domain>`: the hostname inbound mail is addressed to, when the driver is `RESEND`. When the driver is `LOG` it is absent. A value named together with `LOG` is refused by name. When the driver is `RESEND` and this is unnamed, ask. Do not guess.
- `<cloudflare_saas>`: a zone id and a DCV delegation id, neither a secret, or `none`. When it is `none`, the report says no workspace can take its own domain.
- `<hostname>`: the one hostname Job 2 adds or removes, when they named one.
- `<alias_label>`: the label Job 2 uses for that hostname, when they named one.
- `<for_restore>`: the word `restore` when Job 1 is an install for a restore, which stops before the start job. Otherwise absent.
- `<relay>`: the word `relay` followed by one or more upstream names, when Job 1 should install the mail relay. Otherwise absent.
- `<relay_login>`: the one login Job 5 adds, rotates or removes, when they named one.
- `<relay_domain>`: that login's domain, when they named one.
- `<relay_upstream>`: the upstream that login uses, or the one upstream Job 5 adds, removes, or whose token it replaces.
- `<relay_to>`: the word `send` or the word `hold`, when Job 5 writes the relay's state.
- `<live_state>`: what the inspection showed, or the statement that it was not read.

An unnamed machine is asked about. It is never guessed. A value that does not match the pattern below is asked about, and it is never sent. `skills/Set Up Twenty Workspace/` runs Job 2 by name and hands exactly `<machine>`, `<install>`, `<hostname>`, `<alias_label>`, the word `add` or the word `remove`, and `<live_state>` when it has one. It does not hand a secret. Job 4 takes the install name and the word `offline` or the word `online`. Job 5 takes the install name and one relay action, or a report-only read that names no action.

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
- The request asks to back up an install or to restore one. Hand it to `skills/Back Up Twenty/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks to connect a Google or Microsoft mailbox. Stop. Name the gap for connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval. Send nothing.
- The request asks to change an existing install's emailing-domain driver. Stop. Name the gap for changing an existing install's emailing-domain driver. Send nothing.
- The request asks to send through the relay from an organisation whose Cloudflare account is not on Workers Paid. Stop. Name the gap for sending through the relay from an organisation whose Cloudflare account is not on Workers Paid. Send nothing.
- The request asks for a relay login, a relay upstream token, a relay upstream, or the relay's send or hold, and it also asks to install Twenty, to remove an install, to take an install offline or bring one online, or to add or remove a route. Ask which this run is for. One run is one action. Do not guess. Do not call.
- The request asks to remove one named install and names no deploy and no single route change. Job 3. The confirmation question still applies before any removal call.
- The request asks to take one named install offline, or to bring one named install back online, and names no deploy and no removal. Job 4. The confirmation question still applies before any offline or online call.
- The request asks to add one hostname's route to an install this skill made, or to remove that one route, and names no new install. Job 2.
- The request asks only what the relay's state, logins, upstreams, or ambiguous count are, and names no install to create, no route, no removal, and no offline or online change. Job 5. It writes nothing and takes no gate.
- The request asks to add, rotate or remove one relay login, or to replace one relay upstream token, or to add or remove one relay upstream, or to write the relay to send or hold, and names no new install, no removal, no offline or online change, and no route change. Job 5. The confirmation question still applies before any change call.
- The request asks to install Twenty and also to remove an install, or to take an install offline or bring one online, or asks for more than one install. Ask which this run is for. One run is one install. Do not guess. Do not call.
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

The install name matches `^[a-z][a-z0-9]{1,12}$`, with no hyphen, and it is not `caddy`. Every alias is the install name, a hyphen, and a label, so the install part of an alias is the text before its first hyphen, and two installs never generate the same alias. A name with a hyphen is refused by name. An unnamed install is `twenty`. Job 1, Job 2, Job 3, Job 4, and Job 5 all require it.

An alias label matches `^[a-z0-9][a-z0-9-]{0,15}$`. The alias is the install name, a hyphen, and the label. That alias has to match `^[a-z][a-z0-9-]{1,31}$`, and it is not `caddy`. A label that would make an alias outside that pattern is refused by name.

A hostname, including `<base>`, matches `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`, is at most 253 characters, and contains a letter. A name with no dot does not match. `app.` followed by `<base>` has to match the same rule and stay within 253 characters. So does a workspace subdomain, a dot, and `<base>`.

An email matches `^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$`, is at most 254 characters, and contains no whitespace.

A display name, and a from name, match `^[A-Za-z0-9][A-Za-z0-9 .,'-]{0,63}$`.

A bucket name matches `^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$`.

An endpoint matches `^https://[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+(:(6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[1-9][0-9]{0,3}))?$`, with no user, no path, and no query. A port, when present, is a whole number from 1 to 65535 with no leading zero.

A region matches `^[a-z0-9-]{1,32}$`. The region `auto` matches.

A zone id matches `^[a-f0-9]{32}$`. A DCV delegation id matches `^[a-z0-9]{8,64}$`. Neither is a secret.

The emailing-domain driver is the word `RESEND` or the word `LOG`. The word `AWS_SES` is refused by name: that driver needs an Enterprise licence, and this release's install does not set it. Any other driver is refused by name.

`<inbound_domain>` matches the hostname rule. It is required when the driver is `RESEND`. It is refused by name when it equals `<base>`, or when it ends with a dot followed by `<base>`, because Twenty would read that name as a workspace subdomain. When the driver is `LOG`, a named `<inbound_domain>` is refused by name. When the driver is `RESEND` and `<inbound_domain>` is unnamed, ask. Do not guess.

`<cloudflare_saas>` is the word `none`, or both a zone id and a DCV delegation id. One without the other is refused by name.

`<relay>` is absent, or it is the word `relay` followed by one or more upstream names separated by spaces. Each name matches `^[a-z][a-z0-9-]{0,15}$`. A name that does not match is refused by name. The same name twice is refused by name. The word `relay` with no name is refused by name. More than 55 names is refused by name: the relay-files job's first operand is the install name, and a job admits at most 56 operands. When `<relay>` is absent, no relay job is planned and no relay script is sent. `<relay>` with `<for_restore>` makes a restore target for a set that carries a relay: the relay's calls through the relay-service job run as they do on any install, and the token-helper edit is not one of them, so the target holds the relay's directories, program, `node_modules`, the `relay` service in its override and `state` `hold`, with `logins.json` `[]`, no token file and no container; `skills/Back Up Twenty/`'s restore writes the set's logins, upstreams and tokens into it and starts it. The upstream names are the source install's. A request to add a relay to an install that is already past the install job, with no new install, is asked about. These relay jobs, the files, the writers, the install and the service, run only inside Job 1, after the install job has counted. Job 5 changes a relay Job 1 already installed. It does not install one.

Job 1 requires `<base>`, `<admin_email>`, a display name and a subdomain, a bucket, an endpoint, a region, a from address, a from name, and a driver. When the driver is `RESEND`, Job 1 also requires `<inbound_domain>`. The subdomain matches an alias label, and it is not `app` and not `base`. The labels `base` and `app` are reserved for the install's own hostnames. Host, port and user may be unnamed, and then they are `smtp.mx.cloudflare.net`, `465`, and `api_token`. When the host is named, the port and the user are named too. The user matches `^[A-Za-z0-9._-]{1,64}$`. The host matches the hostname rule. When the host is `smtp.mx.cloudflare.net`, the port is `465`. A different port with that host is refused by name. `<relay>` is not required. When it is present, the upstream names are operands of the relay-files job, and, when this is not an install for a restore, of the token-helper edit and of the token length read, and of no other script.

Job 2 requires the install, one hostname, one alias label, and the word `add` or the word `remove`. The label is not `base` and not `app`. A Job 2 request that also names a new base, a new admin, or a new bucket: ask whether the request is the one route. Do not send the extra value. Do not guess.

Job 3 requires the install name. It does not take a new hostname, a new image, or a secret. A Job 3 request that includes one: ask whether the request is the removal. Do not send the extra value.

Job 4 requires the install name and the word `offline` or the word `online`. It does not take a new hostname, a new image, or a secret. A Job 4 request that includes one: ask whether the request is the offline change or the online change. Do not send the extra value.

Job 5 requires the install name and exactly one action, or a report-only read. The action is `add`, `rotate` or `remove` of one login, or `send` or `hold`, or the replacement of one upstream token, or `add` or `remove` of one upstream. A login matches `^[a-z0-9-]{1,32}$`. A login's domain matches the hostname rule and is stored lowercase. An upstream name matches `^[a-z][a-z0-9-]{0,15}$`, the pattern Job 1 writes into `upstreams.json`. A second login for a domain already bound is refused by name before any helper is given. A rotate or a remove whose domain differs from the stored domain is refused by name before any helper is given. Removing an upstream a login names is refused by name. A Job 5 request that includes a new hostname, a new image, or a secret value: ask whether the request is the one relay change. Do not send the extra value. Do not guess. One run is one action.

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
  docker ps -a --no-trunc --filter "label=com.docker.compose.project=$install" --format '{{.ID}} {{.Label "com.docker.compose.service"}} {{.Label "com.docker.compose.project"}}'
  printf '%s\n' "project-exit:$?"
  printf '%s\n' '--- project-volumes ---'
  docker volume ls --filter "label=com.docker.compose.project=$install" --format '{{.Name}}'
  printf '%s\n' "volumes-exit:$?"
  printf '%s\n' '--- project-network ---'
  docker network inspect --format '{{.Id}} {{index .Labels "com.docker.compose.project"}}' -- "${install}-proxy"
  printf '%s\n' "network-exit:$?"
  printf '%s\n' '--- project-networks ---'
  docker network ls --no-trunc --filter "label=com.docker.compose.project=$install" --format '{{.ID}} {{.Name}}'
  printf '%s\n' "networks-exit:$?"
fi
printf '%s\n' '--- token after ---'
if [ -r /run/vm-job.token ]; then cat /run/vm-job.token; else printf '%s\n' none; fi
exit 0
```

Docker's wording for an absent object is read without regard to case. A missing container prints `no such object`. A missing network prints `not found`. A missing volume prints `no such volume`.

The project-network section is the `${install}-proxy` inspect, then `network-exit`. Those lines stay so the checks that read them stay the same. The project-networks section lists every network whose label `com.docker.compose.project` is the install, one line `id name`, then `networks-exit`. Compose creates `<install>_default` and `<install>-proxy`. Both carry that label when they exist. The section is empty when no line sits between its header and `networks-exit`. `networks-exit` 0 on an empty section means none remain.

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

Ask on Job 1, Job 2, Job 3, and Job 4. Job 5 skips this question. It pulls nothing.

The memory line is the `free -m` line whose first field is `Mem:`. The seventh field is available mebibytes. It has to be a whole number of at least 3927, which is 1.5 times the measured peak of a two-workspace stack, 2618 MiB. Do not require swap.

The disk line is the `df -B1 -P` data line for Docker's root, the line that is not the header. The fourth field is available bytes. It has to be a whole number of at least 8589934592, which is 8192 MiB. The three images are about 2.7 GB on disk. 8192 MiB leaves room for the pull and for the database to grow.

- `docker-root` is empty, or `disk-exit` is not 0, or either number cannot be read. Stop. The headroom was not read. Change nothing.
- Available memory is below 3927, or available bytes are below 8589934592. Stop. Name the number that was read and the number required. Change nothing. This is not a gap. The machine is too small for this install.
- Both numbers meet the bar. Continue.

### What is Caddy on this machine?

Ask on Job 1, Job 2, Job 3, and Job 4. Job 5 skips this question. It writes no route and it does not start Caddy.

The caddy line's first field is the status. The second field is the label, unless it is empty or `<no value>` or starts with `{`, in which case there is no label. The JSON is the remainder, from the first `{`. The socket section says `socket-present` or `socket-absent`. The published ports this skill accepts are exactly two keys, `80/tcp` and `443/tcp`, each with one binding, the same `HostIp` on both, `HostPort` `80` and `443`. That `HostIp` is the source address. An empty `HostIp`, or `0.0.0.0`, is not accepted.

- `caddy-inspect-exit` is not 0, or the section contains `no such object`, compared without regard to case. Stop. Name the gap for a machine with no Docker, or with no Caddy running in the shape `skills/Deploy Workload/` runs it. Change nothing.
- The label is not `caddy`. Stop. Name that gap. Change nothing.
- The status is not `running`. Stop. Name the status. This run does not start Caddy. Name that gap. Change nothing.
- The ports JSON is missing, or it is not exactly those two bindings on one acceptable address. Stop. Name the ports. Name that gap. Change nothing.
- The socket says `socket-absent`. Stop. Name that gap. Change nothing.
- The label is `caddy`, the status is `running`, the ports match, and the socket is present. Record the source address for the first-contact operand. Do not print it as a field of the report. Continue.

### What did the config and the routes show?

Ask on Job 1, Job 2, Job 3, and Job 4. Job 5 skips this question. It writes no route.

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

- `dir-absent`, `project-exit` is 0 and the project section is empty, `volumes-exit` is 0 and the volumes section is empty, `network-exit` is not 0 and the network section contains `not found`, compared without regard to case, and `networks-exit` is 0 and the project-networks section is empty, and no route in the config has an `@id` that begins `workload-` followed by the install name and a hyphen. The name is free. Continue.
- Every section was read and a route in the config has an `@id` that begins `workload-` followed by the install name and a hyphen. Stop. That route carries names this install's aliases would take. Name it. Change nothing.
- The directory is present, or any container, volume, or project network was read for this install name. Stop. The name is taken. Do not remove it in this run. Name Job 3 only when the marker section contains the lines `skill=deploy-twenty`, `release=v2.45.6`, and `project=` followed by this install name, each as a whole line. A `compose-sha256=` line and a `stage=` line may be present. They do not by themselves change that. Otherwise say the name is taken by something this skill did not mark. Change nothing.
- A section was not read. Stop. Copy the section. Change nothing.

Job 2. Take the first match.

- The marker section's lines include `skill=deploy-twenty`, `release=v2.45.6`, `compose-sha256=bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d`, and `project=` followed by this install name, each as a whole line, and `stat:` was read. A whole line `stage=created` or `stage=files-written` may be present. It does not replace a required line and it does not fail this check. This is a complete install this skill made. Continue.
- The directory is absent, or the marker is absent, or a required line does not match. Stop. This skill does not change an install it did not mark. Change nothing.

Job 3. Take the first match.

- The marker section's lines include `skill=deploy-twenty`, `release=v2.45.6`, `compose-sha256=bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d`, and `project=` followed by this install name, each as a whole line, and `stat:` was read, and a container, a volume, or a project network was read for this install name. A project network was read when the project-networks section has a line, or when the `${install}-proxy` inspect was read. A whole line `stage=created` or `stage=files-written` may be present. It does not replace a required line and it does not fail this check. This is a complete install this skill made. The full branch. Continue.
- The marker section's lines include `skill=deploy-twenty`, `release=v2.45.6`, and `project=` followed by this install name, each as a whole line, with or without the `compose-sha256` line, and `stat:` was read, and `project-exit` is 0 and the project section is empty, and `volumes-exit` is 0 and the volumes section is empty, and `networks-exit` is 0 and the project-networks section is empty, and `network-exit` is not 0 and the network section contains `not found`, compared without regard to case. A whole line `stage=created` or `stage=files-written` may be present. No route in the config has an `@id` that begins `workload-` followed by the install name and a hyphen. This is the directory and its marker alone. The partial branch. Continue.
- The marker section's lines include `skill=deploy-twenty`, `release=v2.45.6`, and `project=` followed by this install name, no container, volume or project network was read, and a route in the config has an `@id` that begins `workload-` followed by the install name and a hyphen. Stop. Name each such route. They are removed first, by Job 4 offline when the marker also holds the `compose-sha256` line and the aliases line was read, and otherwise by the person. Change nothing.
- A container, a volume, or a project network was read for this install name, and the marker does not contain the whole line `compose-sha256=bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d`. Stop. Name what was read. Change nothing.
- A section this question needs was not read. Stop. Copy the section. Change nothing.
- The directory is absent, or the marker is absent, or a required line does not match. Stop. This skill does not change an install it did not mark. Change nothing.

Job 4. Take the first match.

- The marker section's lines include `skill=deploy-twenty`, `release=v2.45.6`, `compose-sha256=bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d`, and `project=` followed by this install name, each as a whole line, and `stat:` was read, and the aliases line was read. A whole line `stage=created` or `stage=files-written` may be present. It does not replace a required line and it does not fail this check. This is a complete install this skill made. Continue.
- The directory is absent, or the marker is absent, or a required line does not match, or the aliases line was not read. Stop. This skill does not change an install it did not mark. Change nothing.

Job 5. Take the first match.

- The marker section's lines include `skill=deploy-twenty`, `release=v2.45.6`, `compose-sha256=bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d`, and `project=` followed by this install name, each as a whole line, and `stat:` was read. The directory is present. A whole line `stage=created` or `stage=files-written` may be present. It does not replace a required line and it does not fail this check. This is a complete install this skill made. Continue.
- The directory is absent, or the marker is absent, or a required line does not match. Stop. This skill does not change an install it did not mark. Change nothing.

### Who answers to this install's aliases?

Ask on Job 1 once the name is free, and on Job 2 before an alias is added. Caddy reaches this install's server by its aliases, and another container, running or stopped, can already answer to one of those names, by its name, hostname, short ID or an alias another skill gave it, in any case. Send the read `skills/Deploy Workload/` sends for its question who answers to the workload name: the same script, `argv` `/bin/sh`, `-c`, that script, `sh`, and then each name asked about, a read, read by that question's rules for a successful read and for Caddy's links and extra hosts. Caddy is never absent here, since the Caddy question already found it running.

The names asked about are, on Job 1, `<install>-base`, `<install>-app`, and `<install>-<subdomain>`; on Job 2, the one alias being added. Take the first match.

- The read is not successful. Stop. Change nothing.
- Caddy carries a link or an extra host. Stop. Change nothing.
- On Job 1, an `owner:` line names any of those names. Stop. Name the container ID. Those names are taken, and Caddy could reach that container instead of this install's server. Change nothing.
- On Job 2, an `owner:` line names the alias with a container ID other than this install's server. The server is the container whose ID the inspection's project section gave for service `server` and this install. Stop. Name it. Change nothing.
- Otherwise continue.

### Has the person confirmed Cloudflare for SaaS, before the plan?

Ask on Job 1 when `<cloudflare_saas>` is not `none`. DNS for `<base>` and for `app.<base>` is handed to `experts/IT Expert/` in `wiser` either way, before the plan. This skill does not write a record.

- The person says the zone's Custom Hostnames setting is on, and a proxied record is the fallback origin pointing at this machine. Continue. This skill does not write that setting. When they do not say it, stop. Name the gap for Cloudflare for SaaS's custom-hostname setting and fallback origin on a zone, which the person turns on in Cloudflare's dashboard. Send nothing.
- `<cloudflare_saas>` is `none`. Do not ask. The report says no workspace can take its own domain. Continue.

### What does the plan contain?

One plan, the calls that apply, in this order. A call that the questions skipped is not in the plan. The plan names the machine, the role, the inspection verbatim, every call, and the way back. No route is in the plan before the gate.

Job 1:

1. The pull job. Purpose `twenty-pull`, limit 1800, the references below as operands, in this order. `twentycrm/twenty@sha256:dca6d82985901468b391c0335aa8f0519a52b9809709e66f2de1dbff04351e53`, then `postgres@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65`, then `redis@sha256:c94085d298b738be22c9ccdc0ac3761fa6649df7dd82ad1d42367f3cb9714935`. When `<relay>` is present, a fourth operand follows, `node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`. When `<relay>` is absent, the operands are the three. The pull script is the same text either way.
2. The install job. Purpose `twenty-install`, limit 300, sixteen operands when the driver is `LOG` and seventeen when the driver is `RESEND`. It writes the marker before any download or secret, then the rest of the directory, and starts nothing. When the driver is `RESEND`, the plan names `<inbound_domain>`. It says the person adds that name's MX record at Resend's direction, through `experts/IT Expert/` and `skills/Zone Publisher/` in `wiser`, and that the record is the MX record with the lowest priority number for that name. Resend's dashboard shows the host and the priority. Resend recommends a subdomain so the parent domain's own mail records stay as they are.

When `<relay>` is present, the relay's calls are inserted after call 2 has counted and before call 3. They are not a renumbering of calls 3 to 9. In order: the relay-files job, purpose `twenty-relay-files`, limit 60, operands the install name and then each upstream name; then one direct call per relay writer; then the relay-install job, purpose `twenty-relay-install`, limit 420, one operand, the install name; then the relay-service job, purpose `twenty-relay-service`, limit 120, one operand, the install name. The image those calls name is `node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`. `experts/DevOps Expert/` gates each of the three jobs with this same plan, before any of them is sent. The gate covers each job's purpose, unit name, limit, token, script and operands. The writer calls are in that plan. They are not jobs, and they are not a separate gate. A re-inspection that changes a later call is a new plan, gated again. When `<relay>` is absent, those calls are not in the plan. `conf/state` stays the four bytes `hold` through Job 1. No call in this plan writes `send`. Releasing the hold is Job 5, and this run does not send it.

When `<relay>` is present and `<for_restore>` is absent, one more direct call follows the relay-service job and still precedes call 3. It edits `/opt/<install>/set-secrets` so the helper prompts for each upstream token. It is not a job. It does not take the lock. Its `argv` is `/bin/sh`, `-c`, the script, `sh`, the install name, and each upstream name. It stays inside the endpoint's 20 seconds. The same plan gates it with the relay jobs. It is not a separate gate. When `<relay>` is absent, or when `<for_restore>` is present, that call is not in the plan, and the helper stays the text the install job wrote.

3. The person runs the helper over a shell they hold on the machine, outside the router. On Oracle, that shell is the route `skills/Prepare VM/providers/oracle.md` names, Cloud Shell's ephemeral private network. The plan names the helper path and the key names. It does not name a secret value. For each vendor key it says where that value's length will come from: the `clipboard-length:` line the clipboard command below prints when the session loads the value for the paste, a length the vendor documents for that kind of token, or none. A length is not a secret. When the driver is `RESEND`, the key names include `RESEND_WEBHOOK_SIGNING_SECRET` immediately after `RESEND_API_KEY`. The plan tells the person, before the helper, to enable receiving on `<inbound_domain>`, to add the webhook to `https://<base>/webhooks/messaging/resend` for `email.received`, `email.delivered`, `email.failed`, `email.bounced`, and `email.complained`, and to have that webhook's signing secret ready to type. It does not name the secret. When `<relay>` is present and `<for_restore>` is absent, the plan also names each `RELAY_TOKEN_<NAME>` key, one per upstream, and where that token's length will come from, by the same three sources. `<NAME>` is the upstream name with every letter turned to upper case and every `-` turned to `_`. The token file is `/opt/<install>/relay/secrets/<name>.token`. It holds the typed bytes and no trailing newline, so the recorded length is the file's byte count. A restore's plan does not name these keys. The helper is not edited, and the restore brings the token files.
4. The length read. When `<relay>` is present and `<for_restore>` is absent, the token length read follows it, one direct call, before the start job.
5. The start job. Purpose `twenty-start`, limit 1800, one operand, the install name. The start script is the same text whether or not `<relay>` is present. When `<relay>` is present, the relay start read follows the start job, one direct call, before the ports read.
6. A read of the server's published ports. When `<relay>` is present, the relay checks follow that read, then the outbound check, both direct calls, both before the first-contact writers. The first-contact writers are sent only after `outbound:ok`.
7. The writer calls that place the first-contact program, three when the driver is `LOG` and four when the driver is `RESEND`, then the one first-contact call. That call creates the server admin and the first workspace on the install's Docker network, and posts the `app.<base>` route and the first workspace's route only after `workspace:ok` and the password file is removed. The order is the first-contact question.
8. The base route, one POST, only after first-contact has created the workspace.
9. The checks from outside the machine, then the memory read, then a closing re-inspection.

An install for a restore is calls 1 to 4 and no other, then a closing re-inspection. It starts no container, creates no volume or network, posts no route, and creates no admin or workspace, since a restore brings its own. It stops at the resting state below. When `<relay>` is present, the relay's calls through the relay-service job are inserted after call 2 here too. The token-helper edit, the token length read, the start read, the relay checks and the outbound check are not in that plan. The helper does not ask for the relay's upstream tokens, which the restore brings. `conf/state` stays `hold`. Releasing the hold is Job 5, and this run does not send it.

Job 2's plan is the route question. Job 3's plan is the removal question. Job 4's plan is the offline question, or the online question. Job 5's plan names the install, the one action, the calls in that job, and the way back. It sends no pull. A login action names the helper and the read, never a password. A token action names the helper and the read, never a token. `hold` names purpose `twenty-relay-hold`, limit 200, and no operands. `send` names one direct call. A report-only read is not a change plan.

None of Job 2, Job 3, Job 4, or Job 5 sends a pull.

The way back for Job 1 is Job 3, named and not sent in this run. A stop after the install job and before the start job is undone by Job 3's partial branch. The way back for one route is Job 2 with the word `remove`, named and not sent in this run. The way back for Job 4 offline is bringing that install back online, named and not sent in this run. Before Job 3's removal job is sent, the way back for its route deletes is the same: bringing the install back online from Job 3's before-state, named and not sent in this run. Images are not removed by these.

A re-inspection between two planned jobs reads the token the next start uses. The calls stay the ones this plan named. A re-inspection whose facts change a later call, a token renewal alone excluded, stops. The changed calls are a new plan, gated again. Do not start them on the old gate.

### Is the plan gated?

A run whose inspection shows nothing to change writes nothing and takes no gate. Job 1 always has a change when it reaches this question. Job 2, Job 3, Job 4, and Job 5 take this question only when a change call remains. A Job 5 run that only reads the report writes nothing and takes no gate.

When there is a change, hand the plan to `experts/DevOps Expert/` with `<live_state>`, in a second context, before any change. `<live_state>` is the inspection output copied verbatim. The plan names every call in order and the way back. A job names its purpose, its unit name, its limit, the token, the script, and the operands. A route POST is one object appended through the admin API, with `If-Match` set to the `Etag` from the same `GET /config/` whose body passed the shape check, not the routes path's `Etag`. It is not a whole-config replacement. A `412` on that POST means the config changed anywhere.

- Safe as planned. Continue. The approval question still applies to each change call.
- Safe with named conditions. Tell the person. A condition that changes the calls goes back into the plan and is gated again. A condition that does not change the calls: send nothing until the person accepts it and says it is met. They decline it: stop with no change call. The report names the conditions and their answer.
- Not as proposed. Stop. No change call.
- The work is a gap this expert declares. Stop. The verdict names it. No change call.

### The pull job

Write the script verbatim to the temporary directory. The first line is exactly `set -eu`. Run `start` with `--purpose twenty-pull`, `--limit 1800`, `--token` the token the latest inspection read, `--script` that file, and the references as operands, in the plan's order. Three when `<relay>` is absent, and those three plus the node digest when `<relay>` is present. Send the `argv` it prints, unchanged. Then the job question.

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

The pull counts only when the job's class is `succeeded` and, for each reference, the text after the first `]: ` on a `--- digest ---` marker's following line equals that reference. A tag is not accepted. A mismatch stops the run. Do not start the install job. Images already pulled stay. Their removal is not this run. When `<relay>` is present the fourth reference is `node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`, and it is compared the same way. A mismatch on it stops the run before the install job. The pull script above is not edited for the relay. Its text is that block whether `<relay>` is present or absent. The node image sits inside the disk bar the headroom question already requires. That bar does not change.

### The install job

When the driver is `LOG`, the operands, in order, are the install name, the server URL `https://<base>` with no path and no trailing slash, the region, the bucket, the endpoint, the from address, the from name, the SMTP host, the SMTP port, the SMTP user, the base hostname, the driver, the word `saas` or the word `none`, the zone id or the single character `x` when the word is `none`, the DCV delegation id or `x` when the word is `none`, and the alias list. The alias list is `<install>-base,<install>-app,<install>-<subdomain>` with commas and no spaces. The zone and the DCV id are not secrets. The character `x` is unused when the word is `none`, and it is not written into `.env`. In the script those operands are `install`, `u`, `r`, `b`, `e`, `f`, `n`, `h`, `p`, `s`, `m`, `d`, `a`, `z`, `c`, and `l`, in that order. The short names keep each script within 4096 code points. When the driver is `RESEND`, the operands are those sixteen and then `<inbound_domain>`, which the script names `g`. The plan names `<inbound_domain>`, and that operand is how the approval stop names it.

When the driver is `LOG`, write the script below verbatim. When the driver is `RESEND`, write the script after the override paragraph verbatim. Before `start`, check the pairing, since the LOG script itself accepts either driver: the LOG script goes only with the driver `LOG` and sixteen operands, and the RESEND script only with the driver `RESEND` and seventeen operands, the seventeenth `<inbound_domain>`. Any other pairing: stop, send nothing. Do not send the LOG script for a RESEND install, and do not send the RESEND script for a LOG install. Run `start` with `--purpose twenty-install`, `--limit 300`, `--token` the token the latest inspection read, `--script` that file, and that driver's operands. Send the `argv` it prints, unchanged. Then the job question.

When the driver is `LOG`, `<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1 u=$2 r=$3 b=$4 e=$5 f=$6 n=$7
h=$8 p=$9 s=${10} m=${11} d=${12}
a=${13} z=${14} c=${15} l=${16}
dir=/opt/$install
[ -e "$dir" ]&&{ echo exists; exit 20; }
mkdir -m 700 "$dir"
cd "$dir"
printf 'skill=deploy-twenty\nrelease=v2.45.6\nproject=%s\nstage=created\n' "$install">INSTALL
chmod 644 INSTALL
echo marker-written
curl -fsSL --max-time 60 -o compose.yml "https://raw.githubusercontent.com/twentyhq/twenty/6007ad5a7f6cb676fd8a9ff0c2a86a2e3d4c260e/packages/twenty-docker/docker-compose.yml"
got=$(sha256sum compose.yml|awk 'NR==1{print $1}')
[ "$got" = bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d ] || { echo compose-sha-mismatch; exit 21; }
echo compose-sha:ok
printf 'compose-sha256=%s\n' "$got">>INSTALL
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
        aliases: [$l]
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
printf 'SERVER_URL=%s\nSTORAGE_TYPE=s3\nSTORAGE_S3_REGION=%s\nSTORAGE_S3_NAME=%s\nSTORAGE_S3_ENDPOINT=%s\n' "$u" "$r" "$b" "$e"
printf 'PG_DATABASE_PASSWORD=%s\nENCRYPTION_KEY=%s\n' "$pg" "$enc"
printf 'EMAIL_FROM_ADDRESS=%s\nEMAIL_FROM_NAME="%s"\nEMAIL_SMTP_HOST=%s\nEMAIL_SMTP_PORT=%s\nEMAIL_SMTP_USER=%s\nEMAIL_SMTP_NAME=%s\nEMAILING_DOMAIN_DRIVER=%s\n' "$f" "$n" "$h" "$p" "$s" "$m" "$d"
if [ "$a" = saas ]; then printf 'CLOUDFLARE_ZONE_ID=%s\nCLOUDFLARE_DCV_DELEGATION_ID=%s\n' "$z" "$c"; fi
} > .env
unset pg enc
chmod 600 .env
{ echo STORAGE_S3_ACCESS_KEY_ID; echo STORAGE_S3_SECRET_ACCESS_KEY; echo EMAIL_SMTP_PASSWORD
if [ "$d" = RESEND ]; then echo RESEND_API_KEY; fi
if [ "$a" = saas ]; then echo CLOUDFLARE_API_KEY; fi
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
  read -rsp "Type ${k}, then Enter (hidden): " v </dev/tty || true
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
docker compose -p "$install" config --quiet
echo "env-keys:$(cut -d= -f1 .env | tr '\n' ' ')"
echo "aliases:$l"
awk '{c+=sub(/^stage=created$/,"stage=files-written")}1;END{exit c!=1}' INSTALL>INSTALL.new
mv INSTALL.new INSTALL
chmod 644 INSTALL
echo install-files-written
```

The job generates `PG_DATABASE_PASSWORD` with `openssl rand -hex 24`, which is 48 hex characters, and `ENCRYPTION_KEY` with `openssl rand -base64 32`, which is 44 characters and does not wrap, the trailing newline removed by the command substitution. It writes them into `.env` and prints only key names. A line of the read-back that contains `PG_DATABASE_PASSWORD=`, `ENCRYPTION_KEY=`, `CLOUDFLARE_API_KEY=`, `EMAIL_SMTP_PASSWORD=`, `RESEND_API_KEY=`, `RESEND_WEBHOOK_SIGNING_SECRET=`, `STORAGE_S3_SECRET_ACCESS_KEY=`, `STORAGE_S3_ACCESS_KEY_ID=`, or `ADMIN_PASSWORD=` is withheld. Say that the line was withheld. Do not copy it.

The install counts only when the job's class is `succeeded` and the text after `]: ` includes `marker-written`, `compose-sha:ok`, `install-files-written`, and an `env-keys:` line whose names are the keys and not the values. `compose-sha-mismatch` or `exists` is a failed install. Do not start the helper. Do not start containers. The directory may already exist. A new plan is gated before anything further is written. Do not delete the directory in this run. The marker is written before the download and before any secret. It first holds the whole lines `skill=deploy-twenty`, `release=v2.45.6`, `project=` followed by the install name, and `stage=created`. After the compose hash matches, the whole line `compose-sha256=` followed by that hash is appended. At the end `stage=created` is replaced with `stage=files-written`, by writing `INSTALL.new` and then `mv`. A counted install's marker holds `skill=deploy-twenty`, `release=v2.45.6`, `compose-sha256=bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d`, `project=` followed by the install name, and `stage=files-written`, each as a whole line. A job that printed `marker-written` and did not print `install-files-written` left that directory. Name Job 3's partial branch when a later inspection shows the marker and no project container, no project volume, and no project network. Name the full removal only when that inspection also shows the `compose-sha256` line and a container, a volume, or a project network.

The override maps into both server and worker every variable the shipped compose file does not set: `IS_MULTIWORKSPACE_ENABLED`, `DEFAULT_SUBDOMAIN`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `EMAIL_DRIVER`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, `EMAIL_SMTP_NAME`, `EMAILING_DOMAIN_DRIVER`, `RESEND_API_KEY`, `CLOUDFLARE_API_KEY`, `CLOUDFLARE_ZONE_ID`, and `CLOUDFLARE_DCV_DELEGATION_ID`. It pins the three images by digest, removes the server's published port, gives the server's health check a start period of 900 seconds, and joins the server to the proxy network under the aliases. `STORAGE_TYPE` is `s3`. `STORAGE_S3_REGION`, `STORAGE_S3_NAME`, and `STORAGE_S3_ENDPOINT` are in `.env`, which the shipped compose file already interpolates. `EMAIL_DRIVER` is `smtp`. `EMAIL_SMTP_NAME` is the base hostname. `IS_EMAIL_VERIFICATION_REQUIRED` stays at Twenty's default, off. `IS_IMAP_SMTP_CALDAV_ENABLED` stays at Twenty's default, on. The report says so. Google and Microsoft mail and sign-in stay off. That list is what the LOG script maps. `RESEND_DOMAIN_REGION` stays unset either way. Leaving the region unset means Resend provisions a new emailing domain in its default region. When the driver is `LOG`, `RESEND_WEBHOOK_SIGNING_SECRET` stays unset, and leaving it unset means signatures on `/webhooks/messaging/resend` are not verified. When the driver is `RESEND`, the script below maps `INBOUND_EMAIL_DOMAIN` and `RESEND_WEBHOOK_SIGNING_SECRET` into server and worker the same way it maps `RESEND_API_KEY`, including the `:-` default, and the helper types the signing secret. The RESEND override lists the fixed values first, then the empty-default values, and `INBOUND_EMAIL_DOMAIN` and `RESEND_WEBHOOK_SIGNING_SECRET` follow `RESEND_API_KEY` in that empty-default list. `.env` carries `INBOUND_EMAIL_DOMAIN` beside the other email lines. `secrets.list` names `RESEND_WEBHOOK_SIGNING_SECRET` immediately after `RESEND_API_KEY`. The helper text is the same text as the LOG script's helper. The RESEND script refuses a driver other than `RESEND`.

When the driver is `RESEND`, `<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1 u=$2 r=$3 b=$4 e=$5 f=$6 n=$7
h=$8 p=$9 s=${10} m=${11} d=${12}
a=${13} z=${14} c=${15} l=${16}
g=${17}
[ "$d" = RESEND ] || { echo driver-refused; exit 22; }
dir=/opt/$install
[ -e "$dir" ]&&{ echo exists; exit 20; }
mkdir -m 700 "$dir"
cd "$dir"
printf 'skill=deploy-twenty\nrelease=v2.45.6\nproject=%s\nstage=created\n' "$install">INSTALL
chmod 644 INSTALL
echo marker-written
curl -fsSL --max-time 60 -o compose.yml "https://raw.githubusercontent.com/twentyhq/twenty/6007ad5a7f6cb676fd8a9ff0c2a86a2e3d4c260e/packages/twenty-docker/docker-compose.yml"
got=$(sha256sum compose.yml|awk 'NR==1{print $1}')
[ "$got" = bacd817fcef85abbcb6a603a6c093375313460037fae67d73d45c16f6d85bc7d ] || { echo compose-sha-mismatch; exit 21; }
echo compose-sha:ok
printf 'compose-sha256=%s\n' "$got">>INSTALL
envb='      IS_MULTIWORKSPACE_ENABLED: "true"
      DEFAULT_SUBDOMAIN: app
      EMAIL_DRIVER: smtp
      EMAIL_FROM_ADDRESS: ${EMAIL_FROM_ADDRESS}
      EMAIL_FROM_NAME: ${EMAIL_FROM_NAME}
      EMAIL_SMTP_HOST: ${EMAIL_SMTP_HOST}
      EMAIL_SMTP_PORT: ${EMAIL_SMTP_PORT}
      EMAIL_SMTP_USER: ${EMAIL_SMTP_USER}
      EMAIL_SMTP_NAME: ${EMAIL_SMTP_NAME}
      EMAILING_DOMAIN_DRIVER: ${EMAILING_DOMAIN_DRIVER}'
for k in STORAGE_S3_ACCESS_KEY_ID STORAGE_S3_SECRET_ACCESS_KEY EMAIL_SMTP_PASSWORD RESEND_API_KEY INBOUND_EMAIL_DOMAIN RESEND_WEBHOOK_SIGNING_SECRET CLOUDFLARE_API_KEY CLOUDFLARE_ZONE_ID CLOUDFLARE_DCV_DELEGATION_ID; do
envb="$envb
      $k: \${$k:-}"
done
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
        aliases: [$l]
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
printf 'SERVER_URL=%s\nSTORAGE_TYPE=s3\nSTORAGE_S3_REGION=%s\nSTORAGE_S3_NAME=%s\nSTORAGE_S3_ENDPOINT=%s\n' "$u" "$r" "$b" "$e"
printf 'PG_DATABASE_PASSWORD=%s\nENCRYPTION_KEY=%s\n' "$pg" "$enc"
printf 'EMAIL_FROM_ADDRESS=%s\nEMAIL_FROM_NAME="%s"\nEMAIL_SMTP_HOST=%s\nEMAIL_SMTP_PORT=%s\nEMAIL_SMTP_USER=%s\nEMAIL_SMTP_NAME=%s\nEMAILING_DOMAIN_DRIVER=%s\nINBOUND_EMAIL_DOMAIN=%s\n' "$f" "$n" "$h" "$p" "$s" "$m" "$d" "$g"
if [ "$a" = saas ]; then printf 'CLOUDFLARE_ZONE_ID=%s\nCLOUDFLARE_DCV_DELEGATION_ID=%s\n' "$z" "$c"; fi
} > .env
unset pg enc
chmod 600 .env
{ echo STORAGE_S3_ACCESS_KEY_ID; echo STORAGE_S3_SECRET_ACCESS_KEY; echo EMAIL_SMTP_PASSWORD
echo RESEND_API_KEY; echo RESEND_WEBHOOK_SIGNING_SECRET
if [ "$a" = saas ]; then echo CLOUDFLARE_API_KEY; fi
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
  read -rsp "Type ${k}, then Enter (hidden): " v </dev/tty || true
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
docker compose -p "$install" config --quiet
echo "env-keys:$(cut -d= -f1 .env | tr '\n' ' ')"
echo "aliases:$l"
awk '{c+=sub(/^stage=created$/,"stage=files-written")}1;END{exit c!=1}' INSTALL>INSTALL.new
mv INSTALL.new INSTALL
chmod 644 INSTALL
echo install-files-written
```

Every compose command passes `-p` and the install name, because the fetched file sets its own project name and this skill does not edit that file. The file's hash would change if it were edited. If a later read shows the project label is not the install name, stop. Do not treat those containers as this install. Do not remove them with Job 3. Report the ids and that they were not removed. A new plan is gated before any removal of them.

### The relay files job

When `<relay>` is absent, skip this question. When it is present, ask it only after the install job counted.

Write the script verbatim. The first line is exactly `set -eu`. Run `start` with `--purpose twenty-relay-files`, `--limit 60`, `--token` the token the latest inspection read, `--script` that file, the install name, and then each upstream name as its own operand, in the order `<relay>` named them. Send the `argv` it prints, unchanged. Then the job question.

The script creates `/opt/<install>/relay` at mode `0750` owned `0:1000`, then `app`, `conf` and `secrets` at that mode and owner, and `journal` at mode `0750` owned `1000:1000`. It refuses a `relay` path that already exists. It writes three files under `conf`, each through a temporary file in that same directory, mode `0640`, owner `0:1000`, then `mv -T --`. `state` is the four bytes `hold` and no newline. `logins.json` is `[]` and no newline. `upstreams.json` is one JSON array and no newline, one object per upstream name, in operand order. Each object is `name`, `host` `smtp.mx.cloudflare.net`, `port` `465`, `user` `api_token`, and `token_file` `/secrets/<name>.token`. Every upstream this job writes is Cloudflare Email Service SMTP. The name chooses the token file and nothing else. The design's fallback, Resend's SMTP, is the same JSON shape with a different host, and this job does not write a different host. No token file is written. No secret is an operand.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
shift
fail() { printf '%s\n' "relay-files:fail:$1"; exit 1; }
case "$install" in
  *[!a-z0-9]*|""|caddy) fail install ;;
esac
n=${#install}
[ "$n" -ge 2 ] && [ "$n" -le 13 ] || fail install
first=$(printf '%.1s' "$install")
case "$first" in
  [a-z]) ;;
  *) fail install ;;
esac
[ "$#" -ge 1 ] || fail no-upstream
[ "$#" -le 55 ] || fail too-many
printf '%s\n' "$@" | awk 'seen[$0]++ { d = 1 } END { exit d ? 0 : 1 }' && fail duplicate
for name in "$@"; do
  case "$name" in
    *[!a-z0-9-]*|"") fail upstream ;;
  esac
  un=${#name}
  [ "$un" -ge 1 ] && [ "$un" -le 16 ] || fail upstream
  uf=$(printf '%.1s' "$name")
  case "$uf" in
    [a-z]) ;;
    *) fail upstream ;;
  esac
done
root=/opt/$install
[ -d "$root" ] || fail no-install
base=$root/relay
[ ! -e "$base" ] || fail exists
mkdir "$base"
chmod 750 "$base"
chown 0:1000 "$base"
for d in app conf secrets; do
  mkdir "$base/$d"
  chmod 750 "$base/$d"
  chown 0:1000 "$base/$d"
done
mkdir "$base/journal"
chmod 750 "$base/journal"
chown 1000:1000 "$base/journal"
checkdir() {
  mode=$(stat -c '%a' "$1")
  own=$(stat -c '%u:%g' "$1")
  [ "$mode" = 750 ] && [ "$own" = "$2" ] || fail "dir:$3"
}
checkdir "$base" "0:1000" base
checkdir "$base/app" "0:1000" app
checkdir "$base/conf" "0:1000" conf
checkdir "$base/secrets" "0:1000" secrets
checkdir "$base/journal" "1000:1000" journal
json='['
sep=''
for name in "$@"; do
  json="$json$sep{\"name\":\"$name\",\"host\":\"smtp.mx.cloudflare.net\",\"port\":465,\"user\":\"api_token\",\"token_file\":\"/secrets/$name.token\"}"
  sep=','
done
json="$json]"
writef() {
  tmp=$(mktemp "$base/conf/.part.XXXXXX")
  printf '%s' "$2" > "$tmp"
  chmod 640 "$tmp"
  chown 0:1000 "$tmp"
  mv -T -- "$tmp" "$1"
}
writef "$base/conf/state" hold
writef "$base/conf/logins.json" '[]'
writef "$base/conf/upstreams.json" "$json"
checkfile() {
  mode=$(stat -c '%a' "$1")
  own=$(stat -c '%u:%g' "$1")
  [ "$mode" = 640 ] && [ "$own" = "0:1000" ] || fail "file:$2"
  bs=$(wc -c < "$1" | tr -d ' ')
  [ "$bs" = "$3" ] || fail "bytes:$2"
}
st=$(cat "$base/conf/state")
[ "$st" = hold ] || fail state
checkfile "$base/conf/state" state 4
lg=$(cat "$base/conf/logins.json")
[ "$lg" = '[]' ] || fail logins
checkfile "$base/conf/logins.json" logins.json 2
got=$(cat "$base/conf/upstreams.json")
[ "$got" = "$json" ] || fail upstreams
uj=${#json}
checkfile "$base/conf/upstreams.json" upstreams.json "$uj"
printf '%s\n' "relay-dir:base:750:0:1000"
printf '%s\n' "relay-dir:app:750:0:1000"
printf '%s\n' "relay-dir:conf:750:0:1000"
printf '%s\n' "relay-dir:secrets:750:0:1000"
printf '%s\n' "relay-dir:journal:750:1000:1000"
printf '%s\n' "relay-state:hold"
printf '%s\n' "relay-state-bytes:4"
printf '%s\n' "relay-logins:[]"
for name in "$@"; do
  printf '%s\n' "relay-upstream:$name:smtp.mx.cloudflare.net:465:api_token:/secrets/$name.token"
done
printf '%s\n' "relay-files:ok"
```

The relay-files job counts only when its class is `succeeded` and the text after `]: ` includes, in this order, `relay-dir:base:750:0:1000`, `relay-dir:app:750:0:1000`, `relay-dir:conf:750:0:1000`, `relay-dir:secrets:750:0:1000`, `relay-dir:journal:750:1000:1000`, `relay-state:hold`, `relay-state-bytes:4`, `relay-logins:[]`, one `relay-upstream:<name>:smtp.mx.cloudflare.net:465:api_token:/secrets/<name>.token` line for each operand name in that same order, and `relay-files:ok`. A line `relay-files:fail:` is a failed job. `relay-files:fail:exists` means the directory is already there. Do not send the writers. Do not start the relay-install job. Do not delete the directory in this run. A new plan is gated before anything further is written there.

### What sends the relay writers?

Ask only after the relay-files job counted and was released, so no unit is loaded. On the session machine, from this plugin's root, run:

`node tools/twenty-relay/scripts/twenty-relay.js writers --install-name <install>`

The flag is `--install-name`. The tool refuses `--install`. The command prints one JSON object and writes nothing. It needs Node 18 or later, as `tools/twenty-relay/TOOL.md` says. A missing `node` stops the run before any writer is sent. Take `writers`, an ordered list of argv arrays. Send each as one `vm.command.run`, in that order. The argv is that array unchanged: `/bin/sh`, `-c`, and one script. Send nothing else in that call. Do not send a writer the tool did not print.

Each writer is a direct call, not a tracked job. Each script is already at most 4096 code points, which is the connector's bound on one `argv` element, so it is one direct call. The relay-files script cannot carry the writers: the tool produces them, and together they pass 4096 code points. A tracked job per writer would load a unit, and no second `vm-job` may run while one is loaded, so each writer would be its own start, poll, read-back and release. The files job is the one tracked job for the directories and the conf files. That script cannot pause while the session sends the writers, and the conf files do not share a path with the payload, so the job writes the conf files and then the writers fill `/opt/<install>/relay/app`. The first writer creates that directory when it is missing, and it accepts the directory when the files job has already made it a real directory.

A writer counts when the call came back, the answer names this identifier, and, for a writer that finishes a path, the text includes `installed:` followed by that path. The directory writer prints `installed:/opt/<install>/relay/app`. A file's last writer prints `installed:/opt/<install>/relay/app/<file>` for one of `headers.js`, `relay.js`, `package.json` and `package-lock.json`, the names in `sha256`. An earlier chunk of a file prints no `installed:` line. It counts when the call came back and the text has no `writer:part-refused:`, no `writer:sha-mismatch:`, and no `writer:destination-refused:`. A refusal stops the run. Do not send the next writer. That file is sent again from its first writer, and only under a new plan, once the earlier call has ended. Do not re-send one chunk alone. An outcome that is not a call that came back is the direct-call question. Do not send the next writer. Do not start the relay-install job.

Do not re-send the relay-files job when its marker already counted and a read shows the directories and the three conf files. Resend only the file whose writer did not count, from that file's first writer. The relay-install job waits until every writer has counted, in order.

### The relay install job

Ask only after every writer has counted, in order. When `<relay>` is absent, skip this question.

Write the script verbatim. The first line is exactly `set -eu`. Run `start` with `--purpose twenty-relay-install`, `--limit 420`, `--token` the token the latest inspection read, `--script` that file, and the install name as the only operand. The limit is 420 because the script's own `timeout` is 300 seconds, and the `chown`, the `chmod` and the trap run after that timeout returns. Send the `argv` it prints, unchanged. Then the job question.

The script runs `npm ci --ignore-scripts --no-audit --no-fund` in a one-off container of `node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`. `/opt/<install>/relay/app` is mounted read-write at `/relay`, the working directory is `/relay`, and `--network bridge` leaves the network on. `--pull never` uses the image the pull job already fetched and does not pull another. The container name is `<install>-relay-npm`. That is not the service container `<install>-relay`. `docker run` carries `--rm`. A trap runs `docker rm -f` on that name on every exit, a non-zero `npm ci` and a timeout included. `timeout` returns 124 when it fires, and the marker is `relay-install:fail:npm:124`. Then `node_modules` is `chown -R 0:1000` and `chmod -R g-w,o-rwx`. `node_modules/smtp-server/package.json` has `"version"` exactly `3.19.17`. Any other version does not count. The script prints `relay-install:image:` and the pinned image, `relay-install:version:3.19.17`, and `relay-install:ok`.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
image='node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1'
fail() { printf '%s\n' "relay-install:fail:$1"; exit 1; }
case "$install" in
  *[!a-z0-9]*|""|caddy) fail install ;;
esac
n=${#install}
[ "$n" -ge 2 ] && [ "$n" -le 13 ] || fail install
first=$(printf '%.1s' "$install")
case "$first" in
  [a-z]) ;;
  *) fail install ;;
esac
app=/opt/$install/relay/app
[ -f "$app/package.json" ] || fail no-package
[ -f "$app/package-lock.json" ] || fail no-lock
name=${install}-relay-npm
cleanup() {
  docker rm -f -- "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
set +e
timeout 300 docker run --rm --name "$name" --pull never --network bridge \
  -v "$app:/relay" -w /relay \
  "$image" \
  npm ci --ignore-scripts --no-audit --no-fund
rc=$?
set -e
[ "$rc" -eq 0 ] || fail "npm:$rc"
[ -d "$app/node_modules" ] || fail no-modules
chown -R 0:1000 "$app/node_modules" || fail chown
chmod -R g-w,o-rwx "$app/node_modules" || fail chmod
python3 -c 'import json,sys
p=json.load(open(sys.argv[1],encoding="utf-8"))
raise SystemExit(0 if p.get("version")=="3.19.17" else 1)
' "$app/node_modules/smtp-server/package.json" || fail version
printf '%s\n' "relay-install:image:$image"
printf '%s\n' "relay-install:version:3.19.17"
printf '%s\n' "relay-install:ok"
```

The relay-install job counts only when its class is `succeeded` and the text after `]: ` includes `relay-install:image:` followed by `node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`, `relay-install:version:3.19.17`, and `relay-install:ok`. A line `relay-install:fail:` is a failed job. Do not start the relay-service job. The trap removes the named container. `node_modules` may be partial. Do not delete it in this run. A new plan is gated before anything further is written there.

### The relay service job

Ask only after the relay-install job counted. When `<relay>` is absent, skip this question.

Write the script verbatim. The first line is exactly `set -eu`. Run `start` with `--purpose twenty-relay-service`, `--limit 120`, `--token` the token the latest inspection read, `--script` that file, and the install name as the only operand. Send the `argv` it prints, unchanged. Then the job question.

The edit is the mechanism Job 2 uses for its aliases. One `awk` pass reads `compose.override.yml`, writes a temporary file, and `mv` replaces the override. A read-back then prints the values, and `docker compose -p <install> config --quiet` has to accept the result. The LOG override and the RESEND override each have exactly two lines whose text is `    environment:` and exactly one top-level `networks:`, so the same pass can insert one environment line under the server and one under the worker, and insert the `relay` service immediately before `networks:`. The image value is quoted because the digest contains colons, which an unquoted YAML value would read as a mapping. The pass refuses a file that already has a line `  relay:`, or that already contains `OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS` or `OUTBOUND_HTTP_SAFE_MODE_ENABLED`. It does not set `OUTBOUND_HTTP_SAFE_MODE_ENABLED`.

The service key is `relay`. `image` is `node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`. `container_name` is `<install>-relay`. `command` is `node /relay/relay.js`. `user` is `1000:1000`. `read_only` is true. `tmpfs` is `/tmp` at `16m`. `mem_limit` is `128m`. `pids_limit` is `64`. `restart` is `unless-stopped`. The mounts are `/opt/<install>/relay/app` read-only at `/relay`, `/opt/<install>/relay/conf` read-only at `/conf`, `/opt/<install>/relay/secrets` read-only at `/secrets`, and `/opt/<install>/relay/journal` writable at `/journal`. There is no `ports` key. The only network is the project's default network, with the alias `smtp-relay`. The service is not attached to `proxy`. The server's environment and the worker's environment each gain `OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS` set to `smtp-relay`. The job does not run `up`. It does not start a container. The start job is the one that starts containers, and its script is unchanged, so once this override is in place that `docker compose up` starts `relay` with the other services. The start job's checks do not read the relay container.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
image='node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1'
fail() { printf '%s\n' "relay-service:fail:$1"; exit 1; }
case "$install" in *[!a-z0-9]*|""|caddy) fail install;; esac
n=${#install}
[ "$n" -ge 2 ] && [ "$n" -le 13 ] || fail install
case $(printf '%.1s' "$install") in [a-z]);; *) fail install;; esac
dir=/opt/$install
[ -f "$dir/compose.override.yml" ] || fail no-override
cd "$dir"
grep -q '^  relay:' compose.override.yml && fail present
grep -q OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS compose.override.yml && fail outbound-present
grep -q OUTBOUND_HTTP_SAFE_MODE_ENABLED compose.override.yml && fail safe-mode
tmp=$(mktemp)
if ! awk -v install="$install" -v image="$image" '
$0 == "    environment:" {
  print
  print "      OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS: \"smtp-relay\""
  e++
  next
}
$0 == "networks:" {
  print "  relay:"
  print "    image: \"" image "\""
  print "    container_name: " install "-relay"
  print "    command: node /relay/relay.js"
  print "    user: \"1000:1000\""
  print "    read_only: true"
  print "    tmpfs:"
  print "      - \"/tmp:size=16m\""
  print "    mem_limit: 128m"
  print "    pids_limit: 64"
  print "    restart: unless-stopped"
  print "    volumes:"
  print "      - /opt/" install "/relay/app:/relay:ro"
  print "      - /opt/" install "/relay/conf:/conf:ro"
  print "      - /opt/" install "/relay/secrets:/secrets:ro"
  print "      - /opt/" install "/relay/journal:/journal"
  print "    networks:"
  print "      default:"
  print "        aliases:"
  print "          - smtp-relay"
  k++
}
{ print }
END { if (e != 2 || k != 1) exit 40 }
' compose.override.yml > "$tmp"; then
  rm -f "$tmp"
  fail edit
fi
mv "$tmp" compose.override.yml
docker compose -p "$install" config --quiet || fail compose-config
need() { grep -qx -- "$1" compose.override.yml || fail "$2"; }
need "    image: \"$image\"" image
need "    container_name: ${install}-relay" name
need "    command: node /relay/relay.js" command
need '    user: "1000:1000"' user
need "    read_only: true" ro
need '      - "/tmp:size=16m"' tmpfs
need "    mem_limit: 128m" mem
need "    pids_limit: 64" pids
need "    restart: unless-stopped" restart
need "      - /opt/$install/relay/app:/relay:ro" app
need "      - /opt/$install/relay/conf:/conf:ro" conf
need "      - /opt/$install/relay/secrets:/secrets:ro" secrets
need "      - /opt/$install/relay/journal:/journal" journal
need "          - smtp-relay" alias
awk '
$0 == "  server:" { s = 1; w = 0 }
$0 == "  worker:" { w = 1; s = 0 }
$0 == "  db:" { s = 0; w = 0 }
s && $0 == "      OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS: \"smtp-relay\"" { sc++ }
w && $0 == "      OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS: \"smtp-relay\"" { wc++ }
$0 == "  relay:" { r = 1 }
r && $0 == "networks:" { r = 0 }
r && $0 ~ /ports:|proxy/ { bad = 1 }
r && $0 == "      default:" { dn++ }
r && $0 == "          - smtp-relay" { al++ }
/OUTBOUND_HTTP_SAFE_MODE_ENABLED/ { bad = 1 }
END { if (sc != 1 || wc != 1 || dn != 1 || al != 1 || bad) exit 41 }
' compose.override.yml || fail read-back
printf '%s\n' \
  "relay-svc:image:$image" \
  "relay-svc:container_name:${install}-relay" \
  "relay-svc:command:node /relay/relay.js" \
  "relay-svc:user:1000:1000" \
  "relay-svc:read_only:true" \
  "relay-svc:tmpfs:/tmp:size=16m" \
  "relay-svc:mem_limit:128m" \
  "relay-svc:pids_limit:64" \
  "relay-svc:restart:unless-stopped" \
  "relay-svc:mount:/relay:ro" \
  "relay-svc:mount:/conf:ro" \
  "relay-svc:mount:/secrets:ro" \
  "relay-svc:mount:/journal:rw" \
  "relay-svc:ports:none" \
  "relay-svc:network:default" \
  "relay-svc:alias:smtp-relay" \
  "relay-svc:outbound:server" \
  "relay-svc:outbound:worker" \
  relay-service:ok
```

The relay-service job counts only when its class is `succeeded` and the text after `]: ` includes `relay-svc:image:` followed by `node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`, `relay-svc:container_name:` followed by the install name and `-relay`, `relay-svc:command:node /relay/relay.js`, `relay-svc:user:1000:1000`, `relay-svc:read_only:true`, `relay-svc:tmpfs:/tmp:size=16m`, `relay-svc:mem_limit:128m`, `relay-svc:pids_limit:64`, `relay-svc:restart:unless-stopped`, `relay-svc:mount:/relay:ro`, `relay-svc:mount:/conf:ro`, `relay-svc:mount:/secrets:ro`, `relay-svc:mount:/journal:rw`, `relay-svc:ports:none`, `relay-svc:network:default`, `relay-svc:alias:smtp-relay`, `relay-svc:outbound:server`, `relay-svc:outbound:worker`, and `relay-service:ok`. A line `relay-service:fail:` is a failed job. Do not start the helper. Do not start the start job. When the failure is after `mv`, the override may already hold the edit. Do not retry the edit in this run. A new plan is gated before another edit.

### What adds the relay token prompts?

Ask only after the relay-service job has counted, and only when `<relay>` is present and `<for_restore>` is absent. When `<relay>` is absent, do not send this call. The helper and `secrets.list` stay the bytes the install job wrote. When `<for_restore>` is present, do not send this call. The restore brings the token files, and the helper does not prompt for them.

One `vm.command.run`. It is not a job. Send it only inside the endpoint's 20 seconds. `argv` is `/bin/sh`, `-c`, the script, `sh`, the install name, and each upstream name in the order `<relay>` named them. The person is told it edits the helper and writes no token value.

The install job's two scripts are unchanged. An install with no relay still writes the helper this skill already wrote. This call is the writer that adds the prompts. It leaves `secrets.list` byte for byte. It rewrites `set-secrets` only when that file's last two lines are exactly `done < secrets.list` and `echo helper-done`. It keeps every line above those two, drops the final `echo helper-done`, and appends one prompt per upstream, then `echo helper-done` again. Each prompt's key is `RELAY_TOKEN_` plus the upstream name with `a-z` turned to `A-Z` and `-` turned to `_`, which is `tr 'a-z-' 'A-Z_'` under `LC_ALL=C`. The name `main` prompts `RELAY_TOKEN_MAIN` and writes `relay/secrets/main.token`. The name `effective-sc` prompts `RELAY_TOKEN_EFFECTIVE_SC` and writes `relay/secrets/effective-sc.token`. The value is read from `/dev/tty` with `read -rsp`, the same way the other keys are read. An empty value, or a value that contains whitespace, is refused. The file is written with `printf '%s'` and no trailing newline, by `mktemp` in `relay/secrets`, `chmod 640`, `chown 0:1000`, and `mv -T --` onto `<name>.token`. It is not written into `.env`. The helper prints `saved:<key>:length:<n>` for the token. `n` is the byte length under `LC_ALL=C`, which this added loop sets before it reads. The newline after the hidden prompt goes to `/dev/tty`, so the token prompt adds no blank line on standard output. The vendor loop above it is the install job's loop, unchanged, and its blank `echo` lines stay.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
shift
fail() {
  if [ -n "${listtmp:-}" ]; then rm -f -- "$listtmp"; fi
  printf '%s\n' "relay-tokens:fail:$1"
  exit 1
}
case "$install" in *[!a-z0-9]*|""|caddy) fail install;; esac
n=${#install}
[ "$n" -ge 2 ] && [ "$n" -le 13 ] || fail install
case $(printf '%.1s' "$install") in [a-z]);; *) fail install;; esac
[ "$#" -ge 1 ] || fail names
dir=/opt/$install
sec=$dir/relay/secrets
[ -d "$sec" ] || fail no-secrets
[ -f "$dir/set-secrets" ] || fail no-helper
[ -f "$dir/secrets.list" ] || fail no-list
listtmp=$dir/relay-tokens.list.tmp
: > "$listtmp"
for name in "$@"; do
  case "$name" in ""|*[!a-z0-9-]*) fail name;; esac
  wn=${#name}
  [ "$wn" -ge 1 ] && [ "$wn" -le 16 ] || fail name
  case $(printf '%.1s' "$name") in [a-z]);; *) fail name;; esac
  key=$(printf '%s' "$name" | tr 'a-z-' 'A-Z_')
  printf '%s\n' "$name" >> "$listtmp"
  printf '%s\n' "relay-token-key:$name:RELAY_TOKEN_$key"
done
dups=$(sort "$listtmp" | uniq -d || true)
[ -z "$dups" ] || fail duplicate
mv "$listtmp" "$dir/relay-tokens.list"
listtmp=
chmod 600 "$dir/relay-tokens.list"
last=$(tail -n 2 "$dir/set-secrets")
exp='done < secrets.list
echo helper-done'
[ "$last" = "$exp" ] || fail ending
lines=$(wc -l < "$dir/set-secrets")
lines=$(printf '%s' "$lines" | tr -d ' ')
keep=$((lines - 1))
tmp=$(mktemp "$dir/set-secrets.XXXXXX")
trap 'rm -f -- "$tmp"' EXIT
head -n "$keep" "$dir/set-secrets" > "$tmp"
cat >> "$tmp" << 'END'
export LC_ALL=C
while IFS= read -r name || [ -n "$name" ]; do
  [ -n "$name" ] || continue
  k=$(LC_ALL=C printf '%s' "$name" | LC_ALL=C tr 'a-z-' 'A-Z_')
  k=RELAY_TOKEN_$k
  read -rsp "Type ${k}, then Enter (hidden): " v </dev/tty || true
  printf '\n' >/dev/tty
  case "$v" in ''|*[[:space:]]*) printf '%s\n' "refused:$k:empty-or-whitespace"; exit 1 ;; esac
  n=${#v}
  d=relay/secrets
  t=$(mktemp "$d/.token.XXXXXX")
  trap 'rm -f -- "$t"' EXIT
  printf '%s' "$v" > "$t"
  chmod 640 "$t"
  chown 0:1000 "$t"
  mv -T -- "$t" "$d/$name.token"
  trap - EXIT
  unset v
  printf '%s\n' "saved:$k:length:$n"
done < relay-tokens.list
echo helper-done
END
mv "$tmp" "$dir/set-secrets"
trap - EXIT
chmod 700 "$dir/set-secrets"
printf '%s\n' "relay-tokens:helper:ok"
```

The call counts only when `outcome` is `ok`, the answer names this identifier, and the output contains `relay-tokens:helper:ok` and one `relay-token-key:<name>:RELAY_TOKEN_<KEY>` line for each upstream, in operand order. A line `relay-tokens:fail:` does not count. Do not ask the person to run the helper. The helper file is unchanged when the failure is `ending`. A new plan is gated before another edit. An unknown outcome is the direct-call question. Do not send this call again in this run.

### What does the person run?

Ask only after the install job counted, and, when `<relay>` is present, only after the relay-service job has counted and every relay writer has counted. When `<relay>` is present and `<for_restore>` is absent, ask only after the token-helper edit has counted as well. The helper is `/opt/<install>/set-secrets`, mode 700, run with sudo, over the shell the person holds. It reads the key names from `secrets.list` and each value from the person's terminal (`/dev/tty`), never from that list, prompting with `read -rsp`, one key at a time, for exactly the keys in `secrets.list`: `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `EMAIL_SMTP_PASSWORD`, `RESEND_API_KEY` when the driver is `RESEND`, then `RESEND_WEBHOOK_SIGNING_SECRET` when the driver is `RESEND`, `CLOUDFLARE_API_KEY` when `<cloudflare_saas>` is not `none`, and `ADMIN_PASSWORD`. `RESEND_WEBHOOK_SIGNING_SECRET` is typed through this helper and is never an operand. Its value is not printed. `EMAIL_SMTP_PASSWORD` is a Cloudflare API token with Email Sending: Edit, on the account where the from address's domain is onboarded for sending. `RESEND_API_KEY` is a full-access key, because Twenty creates, verifies and deletes domains through it as well as sending. `CLOUDFLARE_API_KEY` is a token with Zone, SSL and Certificates, Edit on that zone. The server admin's password goes to `admin.password`, mode 600, which the first-contact call deletes after the workspace exists. When `<relay>` is present and this is not an install for a restore, the helper then prompts once more per upstream, after the keys in `secrets.list`, for `RELAY_TOKEN_<NAME>` as the token-helper edit names it. The person types the upstream sending token. The helper writes `/opt/<install>/relay/secrets/<name>.token`, mode 640, owner `0:1000`, and does not write that value into `.env`. It prints `saved:RELAY_TOKEN_<NAME>:length:<n>`. The plan's recorded length for that key comes from the same three sources as the other vendor keys: the clipboard command's `clipboard-length:` line, a length the vendor documents, or the `saved:` line the person reads back. The token file has no trailing newline, so that length is the file's byte count.

The helper refuses an empty value or a value that contains whitespace. It writes under umask 077, it never echoes, and it prints `saved:<key>:length:<n>` and then `helper-done`. The person reads those lines back. A value is not repeated into the conversation.

Where the person saved a value to a file on their computer, and `pbcopy` is present, the session may load the clipboard with a command that prints only the length, and records that length against the key before the person pastes, since the length read compares with it: `n=$(tr -d '\r\n' < "$file" | wc -c | tr -d ' '); tr -d '\r\n' < "$file" | pbcopy; printf 'clipboard-length:%s\n' "$n"`. The person pastes into the helper. Then the session empties the clipboard with `printf '' | pbcopy`. When `pbcopy` is absent, do not invent another command and do not print the file. Ask the person to paste into the helper themselves.

A vendor token is recovered by reissuing it at the vendor and typing it again through the helper. The admin password is recovered by a reset through team email, after team email has been shown to authenticate. The encryption key and the database password have no other copy until a backup holds them. That is why no real contact goes onto the install until a backup has been restored with the same key.

Creating the bucket, the API tokens and the sending accounts is the person's work with each vendor. Name that gap in the report. This skill does not create them.

- The person says the helper printed `helper-done` and one `saved:` line for each key in the plan. When the token prompts were added, that includes one `saved:` line for each `RELAY_TOKEN_` key. Continue to the length read.
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
- When the driver is `RESEND`, `RESEND_WEBHOOK_SIGNING_SECRET` is missing or its length is 0. Stop. Do not print the value. Do not start. A length of at least 1 passes. Twenty's source at `6007ad5a` and the Resend pages read for this change do not state a fixed length, so no fuller length is required.
- When the driver is `RESEND`, `INBOUND_EMAIL_DOMAIN` is missing, or its length is not the length of `<inbound_domain>`. Stop. Do not print the value. Do not start.
- A required key is missing, or its length is 0. Stop. Do not start. The helper has not finished.
- A vendor key whose length the session recorded from the clipboard, or the plan named from the vendor, has a different length. Stop. Do not print the value. Do not start. The value was pasted twice, cut short, or is another value. Run the helper again whole; that is the same plan only when no other file changed. A length of at least 1 does not catch this: a team-email token pasted twice was saved at 106 characters and passed it.
- `PG_DATABASE_PASSWORD` length is not 48, or `ENCRYPTION_KEY` length is not 44. Stop. Do not print the value. Do not start.
- `admin.password` is absent, or its byte count is less than 2. A byte count of 1 is only a newline. Stop. Do not start.
- `.env` mode is not 600, `admin.password` mode is not 600, `set-secrets` mode is not 700, or the directory mode is not 700. Stop. Do not start.
- Every required key has a length of at least 1, every vendor key with a recorded or named length has that length, the two generated lengths match, the admin file's byte count is at least 2, and the modes match. When the driver is `RESEND`, that includes `RESEND_WEBHOOK_SIGNING_SECRET` at a length of at least 1, and `INBOUND_EMAIL_DOMAIN` at a length equal to `<inbound_domain>`. The byte count is the helper's length plus 1, for the trailing newline. Continue. For an install for a restore, stop here, at the resting state below.

### What did the relay token read show?

Ask only when the length read continued and `<relay>` is present. An install for a restore stopped at the length read and does not ask this. When `<relay>` is absent, do not send this call. The length read above is the whole of that step, and its script stays the text above.

One `vm.command.run`, a read, inside the endpoint's 20 seconds. `argv` is `/bin/sh`, `-c`, the script, `sh`, the install name, and each upstream name. The person is told it is a read. The script prints each token file's mode, owner and byte count. It does not print the file.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
shift
dir=/opt/$install/relay/secrets
[ "$#" -ge 1 ]
for name in "$@"; do
  case "$name" in ""|*[!a-z0-9-]*) printf '%s\n' "relay-token:fail:name"; exit 1 ;; esac
  wn=${#name}
  [ "$wn" -ge 1 ] && [ "$wn" -le 16 ] || { printf '%s\n' "relay-token:fail:name"; exit 1; }
  case $(printf '%.1s' "$name") in [a-z]);; *) printf '%s\n' "relay-token:fail:name"; exit 1 ;; esac
  f=$dir/$name.token
  if [ ! -f "$f" ]; then
    printf '%s\n' "relay-token:absent:$name"
  else
    st=$(stat -c '%a %u:%g %s' -- "$f")
    printf '%s\n' "relay-token:$name:$st"
  fi
done
printf '%s\n' "relay-token:read:ok"
```

The script exits 0 after it has printed the facts, and exits 1 when an operand is not an upstream name. The bullets below decide. Withhold any line that contains a token value. This script does not print one.

- A line `relay-token:fail:name`. Stop. Do not start.
- A line `relay-token:absent:<name>`. Stop. That token file is missing. Do not start. Do not print a value.
- A line `relay-token:<name>:<mode> <uid>:<gid> <bytes>` whose mode is not `640`, or whose owner is not `0:1000`, or whose byte count is not the recorded length for that upstream's `RELAY_TOKEN_` key. Stop. Do not print a value. Do not start. The byte count is `stat -c '%a %u:%g %s'`. It equals the helper's length, because the token file has no trailing newline.
- The output contains `relay-token:read:ok` and one passing line per upstream. Continue to the start job.
- Any other line. Stop. Do not start.

**The resting state for a restore.** An install for a restore stops after the length read matched: the marker holds `skill=deploy-twenty`, `release=v2.45.6`, the `compose-sha256` line, `project=` the install and `stage=files-written`; the directory holds the generated `.env`, the person's secrets and `admin.password`, which no first contact will remove, so a restore removes it, or Job 3 removes it with the directory; the display name and subdomain only name the install's aliases; there is no container, no volume, no project network and no route. When `<relay>` was named, it also holds `/opt/<install>/relay/` with the program, `node_modules`, `state` `hold`, `logins.json` `[]`, the named upstreams and no token file, and the `relay` service in the override. That state is supported and kept. Its two continuations are a restore of a backup onto it, which is `skills/Back Up Twenty/`'s, and Job 3's partial branch, which removes it. Starting it as an ordinary install later is not a continuation: a new Job 1 under a new name is.

### The start job

Ask only after the length read matched. When `<relay>` is present and `<for_restore>` is absent, ask only after the token length read matched as well. An install for a restore does not reach this question.

Write the script verbatim. Run `start` with `--purpose twenty-start`, `--limit 1800`, `--token` the token the latest inspection read, `--script` that file, and the install name as the only operand. Then the job question.

When `<relay>` is present, the script below is still this text. `docker compose up` starts every service in the project, `relay` included, because the relay-service job has already edited the override. The checks below do not read the relay container.

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
docker compose -p "$install" exec -T server node -e 'const https=require("https"),tls=require("tls"),E=process.env,L=console.log;function get(h,p,k,ok){return new Promise(r=>{if(!k)return r("skipped");const q=https.get({hostname:h,path:p,headers:{Authorization:"Bearer "+k},timeout:2e4},s=>{let b="";s.on("data",d=>b+=d);s.on("end",()=>r(ok(s.statusCode,b)))});q.on("error",()=>r("fail"));q.on("timeout",()=>{q.destroy();r("fail")})})}function smtp(){return new Promise(r=>{let s=0,b="";const c=tls.connect({host:E.EMAIL_SMTP_HOST,port:+E.EMAIL_SMTP_PORT,servername:E.EMAIL_SMTP_HOST});const W=x=>c.write(x+"\r\n");const z=(m)=>{L(m);c.destroy();r()};c.setTimeout(15e3,()=>z("smtp-auth:fail:timeout"));c.on("error",()=>z("smtp-auth:fail:connect"));c.on("data",d=>{b+=d;let i;while((i=b.indexOf("\n"))>=0){const l=b.slice(0,i).replace(/\r/,"");b=b.slice(i+1);const k=l.slice(0,3);if(!s&&k=="220"){s=1;W("EHLO "+E.EMAIL_SMTP_NAME)}else if(s==1&&k=="250"&&l[3]==" "){s=2;W("AUTH LOGIN")}else if(s==2&&k=="334"){s=3;W(Buffer.from(E.EMAIL_SMTP_USER).toString("base64"))}else if(s==3&&k=="334"){s=4;W(Buffer.from(E.EMAIL_SMTP_PASSWORD).toString("base64"))}else if(s==4&&k=="235")z("smtp-auth:ok");else if(s>1&&k[0]>"3")z("smtp-auth:fail:"+k)}})})}(async()=>{const cf=await get("api.cloudflare.com","/client/v4/zones/"+E.CLOUDFLARE_ZONE_ID+"/custom_hostnames",E.CLOUDFLARE_API_KEY,(c,b)=>{const m=b.match(/"total_count": *([0-9]+)/);return c===200&&/"success": *true/.test(b)&&m?"true:"+m[1]:"fail"});L("cloudflare-list:"+cf);const rs=await get("api.resend.com","/domains",E.RESEND_API_KEY,(c,b)=>c===200?String((b.match(/"id"/g)||[]).length):"fail");L("resend-domains:"+rs);await smtp();let A;for(const p of["@aws-sdk/client-s3","/app/packages/twenty-server/node_modules/@aws-sdk/client-s3"]){try{A=require(p);break}catch(e){}}if(!A){L("s3-client:absent");return}const s3=new A.S3Client({region:E.STORAGE_S3_REGION,endpoint:E.STORAGE_S3_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:E.STORAGE_S3_ACCESS_KEY_ID,secretAccessKey:E.STORAGE_S3_SECRET_ACCESS_KEY}});const B=E.STORAGE_S3_NAME,K="dt-probe-"+require("crypto").randomBytes(16).toString("hex"),D=Buffer.from(K);try{let h=0;try{await s3.send(new A.HeadObjectCommand({Bucket:B,Key:K}));h=1}catch(e){}if(h){L("s3-probe:key-exists");return}await s3.send(new A.PutObjectCommand({Bucket:B,Key:K,Body:D}));L("s3-put:ok");const g=await s3.send(new A.GetObjectCommand({Bucket:B,Key:K}));const x=Buffer.from(await g.Body.transformToByteArray());L("s3-get:"+(x.equals(D)?"match":"mismatch"));await s3.send(new A.DeleteObjectCommand({Bucket:B,Key:K}));L("s3-delete:ok")}catch(e){L("s3-fail:"+(e.name||"error"))}})().catch(()=>L("checks:fail"))' || echo checks:fail
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
- `s3-put:ok`, `s3-get:match`, and `s3-delete:ok` all three pass. `s3-client:absent`, `s3-probe:key-exists`, `s3-get:mismatch`, `s3-fail:`, or `checks:fail` fails. The probe's key is `dt-probe-` and 32 random hex characters, new each run. A HEAD that finds that key present stops the probe before it writes, so the probe never overwrites or deletes an object it did not create.

`node` on the server image's `PATH`, the module path `@aws-sdk/client-s3` or `/app/packages/twenty-server/node_modules/@aws-sdk/client-s3`, `forcePathStyle`, and `transformToByteArray` are not yet proved on this image. A miss prints `checks:fail` or `s3-client:absent` and the check fails closed. Do not invent a different client in this run.

The length idiom inside the containers is not yet proved on the image's shell. A length line that is not `length:<service>:<key>:<digits>` fails the check.

Compose `--wait` treats a worker with no health check as ready once it has started. If the worker line is missing, the check fails.

### What did the relay start read show?

Ask only after the start job counted, and only when `<relay>` is present. When `<relay>` is absent, the ports question is next. The start script is unchanged. `docker compose up -d --wait` already starts `relay`, because the override names that service. The start job's own checks do not read the relay container. This call does.

One `vm.command.run`, a read, inside the endpoint's 20 seconds. `argv` is `/bin/sh`, `-c`, the script, `sh`, and the install name. The person is told it is a read.

The script prints `relay-container:<id>:running 0` for the container `<install>-relay`. The status is `running` and the restart count is `0`. It prints `relay-user:1000:1000`. It prints the one Docker network the container is attached to. That network's Compose labels are the install name and `default`, so it is the project's default network, and the container has no other network. It prints `relay-alias:smtp-relay` when `smtp-relay` is one of the container's aliases on that network. It prints `relay-mount:/relay:ro`, `relay-mount:/conf:ro`, `relay-mount:/secrets:ro`, and `relay-mount:/journal:rw`. A writable `/tmp` is the override's tmpfs and is not a failure. Any other mount destination is a failure. It prints the last log line that begins with `config hash=` and contains ` status=loaded`, and that hash is 64 hex characters. Then it prints `relay-start:ok`.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
fail() { printf '%s\n' "relay-start:fail:$1"; exit 1; }
case "$install" in *[!a-z0-9]*|""|caddy) fail install;; esac
cd "/opt/$install"
id=$(docker compose -p "$install" ps -aq -- relay)
[ -n "$id" ] || fail absent
case "$id" in *[!0-9a-f]*|*[!a-f0-9]*) fail id;; esac
st=$(docker inspect --format '{{.State.Status}} {{.RestartCount}}' -- "$id")
printf '%s\n' "relay-container:$id:$st"
[ "$st" = "running 0" ] || fail status
user=$(docker inspect --format '{{.Config.User}}' -- "$id")
printf '%s\n' "relay-user:$user"
[ "$user" = "1000:1000" ] || fail user
nets=$(docker inspect --format '{{range $n, $c := .NetworkSettings.Networks}}{{printf "%s\n" $n}}{{end}}' -- "$id")
count=0
netname=
for net in $nets; do
  count=$((count + 1))
  netname=$net
done
[ "$count" -eq 1 ] || fail networks
labels=$(docker network inspect --format '{{index .Labels "com.docker.compose.project"}} {{index .Labels "com.docker.compose.network"}}' -- "$netname")
printf '%s\n' "relay-net:$netname:$labels"
[ "$labels" = "$install default" ] || fail network
aliases=$(docker inspect --format '{{range $n, $c := .NetworkSettings.Networks}}{{range $c.Aliases}}{{printf "%s\n" .}}{{end}}{{end}}' -- "$id")
okalias=0
for alias in $aliases; do
  if [ "$alias" = smtp-relay ]; then okalias=1; fi
done
[ "$okalias" -eq 1 ] || fail alias
printf '%s\n' "relay-alias:smtp-relay"
mounts=$(docker inspect --format '{{range .Mounts}}{{printf "%s %s\n" .Destination .RW}}{{end}}' -- "$id")
printf '%s\n' "$mounts" | awk '
$1 == "/relay" && $2 == "false" { r++; next }
$1 == "/conf" && $2 == "false" { c++; next }
$1 == "/secrets" && $2 == "false" { s++; next }
$1 == "/journal" && $2 == "true" { j++; next }
$1 == "/tmp" { next }
{ bad = 1 }
END { if (r != 1 || c != 1 || s != 1 || j != 1 || bad) exit 1 }
' || fail mounts
printf '%s\n' "relay-mount:/relay:ro" "relay-mount:/conf:ro" "relay-mount:/secrets:ro" "relay-mount:/journal:rw"
cfg=$(docker logs --tail 400 -- "$id" | awk '
/^config hash=/ && index($0, " status=loaded") { line = $0 }
END { if (line == "") exit 1; print line }
') || fail config
printf '%s\n' "$cfg"
printf '%s\n' "$cfg" | awk '
function hex64(s) {
  if (length(s) != 64) return 0
  return s ~ /^[0-9a-f]+$/
}
$1 == "config" && index($2, "hash=") == 1 {
  if (hex64(substr($2, 6)) && index($0, " status=loaded")) ok = 1
}
END { exit ok ? 0 : 1 }
' || fail config
printf '%s\n' "relay-start:ok"
```

Count the call only when `outcome` is `ok`, the answer names this identifier, and every line below is present.

- `relay-container:<id>:running 0` for `<install>-relay`. A status other than `running`, or a restart count other than `0`, fails.
- `relay-user:1000:1000`.
- `relay-net:<network>:<install> default`, and no second network.
- `relay-alias:smtp-relay`.
- `relay-mount:/relay:ro`, `relay-mount:/conf:ro`, `relay-mount:/secrets:ro`, and `relay-mount:/journal:rw`.
- One `config hash=<64 hex>` line that contains ` status=loaded`.
- `relay-start:ok`.

All of those passed. Continue to the ports read.

A line `relay-start:fail:`, a missing line above, or a line that does not match its bullet, stops the run. Do not treat the ports read as a pass. Do not add a route. Name Job 3. Do not remove the install in this run. An unknown outcome is the direct-call question. Do not send this call again.

### What ports does the server publish?

Ask only after the start checks passed, and, when `<relay>` is present, only after the relay start read passed. One read. `argv` is `docker`, `inspect`, `--format`, `{{json .HostConfig.PortBindings}}`, `--`, and the server container id from the start read-back. The person is told it is a read.

- The output is `{}` or `null`. The server publishes no port. Continue.
- Anything else. Stop. Do not add a route. The override did not remove the published port. Name Job 3. Do not remove the install in this run.

### What did the relay checks show?

Ask only after the ports read passed, and only when `<relay>` is present. When `<relay>` is absent, the first-contact writers are next. Nothing in this question runs, and nothing else changes because `<relay>` is absent.

One `vm.command.run`, inside the endpoint's 20 seconds. `argv` is `/bin/sh`, `-c`, the script, `sh`, and the install name. The call's environment does not set `RELAY_CHECK_HOST` or `RELAY_CHECK_PORT`. Unset, the program connects to `smtp-relay` port `2525`.

The script runs one Node program with `docker compose -p <install> exec -T server node -e`, then the same program with `worker` in place of `server`. The server image has Node on its `PATH`. Each of the three checks opens its own connection. `relay:greet:ok` means the name resolved and the greeting code is `220`. `relay:auth-refused:ok` means `AUTH PLAIN` for the login `nosuchlogin`, with a password that is not a login, was answered `535`. `relay:unauth-refused:ok` means `MAIL FROM` with no AUTH was answered `530`. Any other result is `relay:<check>:fail:<code or reason>`. The reason is the socket error code, `timeout`, or `exec` when `docker compose exec` itself failed. A failed exec still prints the three fail lines, so each check has a line of its own. The program prints the marker and not the password.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
cd "/opt/$install"
prog='const net=require("net");
const host=process.env.RELAY_CHECK_HOST||"smtp-relay";
const port=Number(process.env.RELAY_CHECK_PORT||2525);
function say(s){console.log(s)}
function why(e){return (e&&(e.code||e.message))||"error"}
function conn(){return new Promise((ok,no)=>{const s=net.connect({host:host,port:port},()=>ok(s));s.setTimeout(2000);s.on("error",no);s.on("timeout",()=>{s.destroy();no(new Error("timeout"))})})}
function reader(s){let b="";const q=[];function pump(){while(q.length){const i=b.indexOf("\n");if(i<0)return;const line=b.slice(0,i).replace(/\r$/,"");b=b.slice(i+1);q.shift()(line)}}s.on("data",d=>{b+=d;s.setTimeout(2000);pump()});return function(){return new Promise((ok,no)=>{q.push(ok);pump();s.on("error",no);s.on("timeout",()=>no(new Error("timeout")))})}}
async function greet(){let s;try{s=await conn();const g=await reader(s)();const c=g.slice(0,3);say(c==="220"?"relay:greet:ok":"relay:greet:fail:"+c);s.end()}catch(e){say("relay:greet:fail:"+why(e))}}
async function ehlo(s,next){s.setTimeout(2000);s.write("EHLO relay-check\r\n");let x="";do{x=await next()}while(x.slice(0,4)!=="250 ")}
async function auth(){let s;try{s=await conn();const next=reader(s);await next();await ehlo(s,next);s.setTimeout(2000);const t=Buffer.from("\0nosuchlogin\0wrong-password").toString("base64");s.write("AUTH PLAIN "+t+"\r\n");const a=await next();const c=a.slice(0,3);say(c==="535"?"relay:auth-refused:ok":"relay:auth-refused:fail:"+c);s.end()}catch(e){say("relay:auth-refused:fail:"+why(e))}}
async function mail(){let s;try{s=await conn();const next=reader(s);await next();await ehlo(s,next);s.setTimeout(2000);s.write("MAIL FROM:<a@example.test>\r\n");const m=await next();const c=m.slice(0,3);say(c==="530"?"relay:unauth-refused:ok":"relay:unauth-refused:fail:"+c);s.end()}catch(e){say("relay:unauth-refused:fail:"+why(e))}}
(async()=>{await greet();await auth();await mail()})().catch(e=>{say("relay:greet:fail:"+why(e))});'
for svc in server worker; do
  printf '%s\n' "relay-from:$svc"
  if ! docker compose -p "$install" exec -T "$svc" node -e "$prog"; then
    printf '%s\n' "relay:greet:fail:exec" "relay:auth-refused:fail:exec" "relay:unauth-refused:fail:exec"
  fi
done
```

Count each of these lines as its own bullet. The `relay-from:` line says which container printed the three that follow it.

- After `relay-from:server`, `relay:greet:ok`.
- After `relay-from:server`, `relay:auth-refused:ok`.
- After `relay-from:server`, `relay:unauth-refused:ok`.
- After `relay-from:worker`, `relay:greet:ok`.
- After `relay-from:worker`, `relay:auth-refused:ok`.
- After `relay-from:worker`, `relay:unauth-refused:ok`.

All six passed. Continue to the outbound check.

A line `relay:greet:fail:`, `relay:auth-refused:fail:`, or `relay:unauth-refused:fail:` stops the run. Do not treat the outbound check as a pass. Do not send first contact. Do not add a route. Name Job 3. Do not remove the install in this run. An unknown outcome is the direct-call question. Do not send this call again.

### What did the outbound check show?

Ask only after the six relay checks passed, and only when `<relay>` is present. When `<relay>` is absent, this call is not sent and no other call changes because of it.

One `vm.command.run`, inside the endpoint's 20 seconds. `argv` is `/bin/sh`, `-c`, the script, `sh`, and the install name. The person is told it is a read.

For `server` and for `worker`, the script runs `printenv` in the container. `OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS` equals exactly `smtp-relay`, printed as `outbound-env:<svc>:allowlist:ok`, or `outbound-env:<svc>:allowlist:bad`. `OUTBOUND_HTTP_SAFE_MODE_ENABLED` is unset, printed as `outbound-env:<svc>:safe-mode:unset`, or `outbound-env:<svc>:safe-mode:set` when `printenv` exits 0, an empty value included. The value is not printed. The database read is the `CONFIG_VARIABLE` name query `skills/Back Up Twenty/` uses: `select "key" from core."keyValuePair" where type = 'CONFIG_VARIABLE' and "userId" is null and "workspaceId" is null order by 1`, through `docker compose -p <install> exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d default -At -c`. The limit here is `timeout 15`. Back Up Twenty uses `timeout 60` inside a job. Fifteen seconds keeps this direct call inside the endpoint's 20 seconds. Neither key is among those names: `outbound-db:ok`. A name that is present is `outbound-db:override:<key>`. A psql failure is `outbound-db:fail` and the script exits 1. The script prints `outbound:ok` only when both services printed `allowlist:ok` and `safe-mode:unset` and the database printed `outbound-db:ok`. Any other result exits 1 and does not print `outbound:ok`.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
cd "/opt/$install"
bad=0
for svc in server worker; do
  allow=$(docker compose -p "$install" exec -T "$svc" printenv OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS || true)
  if [ "$allow" = smtp-relay ]; then
    printf '%s\n' "outbound-env:$svc:allowlist:ok"
  else
    printf '%s\n' "outbound-env:$svc:allowlist:bad"
    bad=1
  fi
  if docker compose -p "$install" exec -T "$svc" printenv OUTBOUND_HTTP_SAFE_MODE_ENABLED >/dev/null 2>&1; then
    printf '%s\n' "outbound-env:$svc:safe-mode:set"
    bad=1
  else
    printf '%s\n' "outbound-env:$svc:safe-mode:unset"
  fi
done
if ! names=$(timeout 15 docker compose -p "$install" exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d default -At -c "select \"key\" from core.\"keyValuePair\" where type = 'CONFIG_VARIABLE' and \"userId\" is null and \"workspaceId\" is null order by 1"); then
  printf '%s\n' "outbound-db:fail"
  exit 1
fi
over=$(printf '%s\n' "$names" | awk '$0 == "OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS" || $0 == "OUTBOUND_HTTP_SAFE_MODE_ENABLED" { print }')
if [ -n "$over" ]; then
  printf '%s\n' "$over" | while IFS= read -r name; do
    [ -n "$name" ] || continue
    printf '%s\n' "outbound-db:override:$name"
  done
  bad=1
else
  printf '%s\n' "outbound-db:ok"
fi
if [ "$bad" -eq 0 ]; then
  printf '%s\n' "outbound:ok"
else
  exit 1
fi
```

- The output contains `outbound-env:server:allowlist:ok`, `outbound-env:server:safe-mode:unset`, `outbound-env:worker:allowlist:ok`, `outbound-env:worker:safe-mode:unset`, `outbound-db:ok`, and `outbound:ok`, and it contains no `allowlist:bad`, no `safe-mode:set`, no `outbound-db:override:`, and no `outbound-db:fail`. Continue to the first-contact writers. `conf/state` is still `hold`. This call does not write it, and no earlier call in Job 1 wrote `send`. Job 1 does not release the hold. Releasing it is Job 5, which this run does not send.
- Any other line, or a missing `outbound:ok`. Stop before first contact. Do not add a route. Do not write `send`. Name Job 3. Do not remove the install in this run.
- An unknown outcome. The direct-call question. Do not send this call again. Do not add a route.

### What writes the first-contact program?

Ask only after the ports read passed. When `<relay>` is present, ask only after the outbound check printed `outbound:ok`. When `<relay>` is absent, the ports read is the step this question follows, and the relay checks and the outbound check were not sent.

The program does not fit in one router argument. The connector bounds one `argv` element at 4096 code points, and the program is longer. When the driver is `LOG`, three reads-as-writes place it, and a fourth call runs it. When the driver is `RESEND`, four reads-as-writes place it, and a fifth call runs it. The writes contain no secret and add no route. Each is one `vm.command.run`. `argv` is `/bin/sh`, `-c`, the script, `sh`, and the install name. Send them in the order this question names, once each. Do not send the run until each printed `writer-ok`. The last of the program writes parses the assembled `first-contact.py` and sets its mode to 600. No `writer-ok` from it means the program was not assembled. The RESEND inbound module is parsed and set to 600 by its own write. A `LOG` run does not send the RESEND scripts.

`<script>` for the first write, when the driver is `LOG`, is this text and no other:

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

`<script>` for the second write, when the driver is `LOG`, is this text and no other:

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
def load(alias,host):
 gate("route")
 try: st,et,data=adm("GET","/config/")
 except Exception: return None
 if st!=200 or not et: return ("bad","config-%s"%st)
 try: cfg=json.loads(data.decode())
 except Exception: return ("bad","config-not-json")
 if not shap(cfg): return ("bad","shape-refused")
 want=obj(alias,host)
 for rt in cfg["apps"]["http"]["servers"]["workloads"]["routes"]:
  if (rt["@id"]==want["@id"] or rt["match"][0]["host"][0].lower()==host.lower()) and rt!=want: return ("bad","host-conflict")
 return ("ok",cfg,et)
def post(alias,host):
 got=load(alias,host)
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
 got=load(alias,host)
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
gf=[None]
def gql(host,q,v,tok,step):
 gate(step)
 gf[0]=None
 try:
  c=http.client.HTTPConnection(srv,3000,timeout=8)
  hd={"Content-Type":"application/json","Host":host,"X-Forwarded-Host":host,"X-Forwarded-Proto":"https","Origin":"https://"+host}
  if tok: hd["Authorization"]="Bearer "+tok
  c.request("POST","/metadata",json.dumps({"query":q,"variables":v}).encode(),hd)
 except socket.timeout:
  print("graphql:fail:%s:timeout"%step); gf[0]="t"; return None
 except Exception:
  print("graphql:fail:%s:connect"%step); gf[0]="c"; return None
 try:
  r=c.getresponse(); b=r.read(); code=r.status; c.close()
 except socket.timeout:
  print("graphql:fail:%s:timeout"%step); gf[0]="n"; return None
 except Exception:
  print("graphql:fail:%s:connect"%step); gf[0]="c"; return None
 if code!=200:
  print("graphql:fail:%s:http-%s"%(step,code)); gf[0]="h"; return None
 try: return json.loads(b.decode())
 except Exception:
  print("graphql:fail:%s:not-json"%step); gf[0]="j"; return None
FCEND
echo writer-ok
```

`<script>` for the third write, for either driver, is this text and no other:

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
access=box(doc,"getAuthTokensFromLoginToken") if isinstance(doc,dict) else None
if not (isinstance(access,str) and access):
 login=""; print("activate:skipped:token"); note("activate:skipped:token"); finish()
doc=gql(subh,A,{"d":{"displayName":name}},access,"activate")
st=dig(doc,"activateWorkspace","activationStatus") if isinstance(doc,dict) else None
login=access=""
if st:
 print("activate:ok"); note("activate:ok")
elif gf[0]=="n":
 print("activate:unknown"); note("activate:unknown")
elif isinstance(doc,dict) or gf[0] in ("h","j"):
 print("activate:fail"); note("activate:fail")
finish()
FCEND
python3 -c 'import ast,sys; ast.parse(open(sys.argv[1],encoding="utf-8").read())' "/opt/$install/first-contact.py"
chmod 600 "/opt/$install/first-contact.py"
echo writer-ok
```

When the driver is `RESEND`, the first write is the inbound module below, the second and third writes are the two program scripts below, and the fourth write is the third script above. Do not send the LOG first write or the LOG second write.

`<script>` for the inbound module is this text and no other:

```
set -eu
export LC_ALL=C
# resend-inbound-module
install=$1
test -d "/opt/$install"
umask 077
cat > "/opt/$install/inbound.py" << 'FCEND'
import json,subprocess,http.client
def run(gate,note,srv,apph,inbound,install):
 def stop(k):
  print(k)
  try: note(k)
  except Exception: pass
  print("admin-password-file:kept"); raise SystemExit(57)
 def cenv(svc):
  try:
   p=subprocess.run(["docker","compose","-p",install,"exec","-T",svc,"printenv","INBOUND_EMAIL_DOMAIN"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=8)
  except Exception:
   return None
  if p.returncode!=0: return None
  t=p.stdout.decode()
  if t.endswith("\n"): t=t[:-1]
  return t
 gate("inbound")
 vals=[]
 for svc in ("server","worker"):
  v=cenv(svc)
  if v is None: stop("inbound-domain:unread")
  vals.append(v)
 if vals[0]!=inbound or vals[1]!=inbound: stop("inbound-domain:mismatch")
 print("inbound-domain:ok")
 try: note("inbound-domain:ok")
 except Exception: pass
 gate("webhook")
 host=apph[4:] if apph[:4]=="app." else ""
 if not host: stop("inbound-webhook:fail")
 try:
  c=http.client.HTTPConnection(srv,3000,timeout=8)
  h={"Content-Type":"application/json","Host":host,"X-Forwarded-Host":host,"X-Forwarded-Proto":"https","Origin":"https://"+host}
  c.request("POST","/webhooks/messaging/resend",b"{}",h)
  r=c.getresponse(); body=r.read(); code=r.status; c.close()
 except Exception:
  stop("inbound-webhook:fail")
 kind=""
 if code==404: kind="404"
 elif code==403:
  try: d=json.loads(body.decode())
  except Exception: d=None
  m=d.get("code") if isinstance(d,dict) else ""
  if m=="MESSAGING_WEBHOOK_INVALID_SIGNATURE": kind="refused"
  elif m=="MESSAGING_WEBHOOK_NOT_CONFIGURED": kind="not-configured"
 if kind=="refused":
  print("inbound-webhook:refused")
  try: note("inbound-webhook:refused")
  except Exception: pass
  return
 if kind=="404": stop("inbound-webhook:404")
 if kind=="not-configured": stop("inbound-webhook:not-configured")
 stop("inbound-webhook:fail")
FCEND
python3 -c 'import ast,sys; ast.parse(open(sys.argv[1],encoding="utf-8").read())' "/opt/$install/inbound.py"
chmod 600 "/opt/$install/inbound.py"
echo writer-ok
```

`<script>` for the RESEND first program write is this text and no other:

```
set -eu
export LC_ALL=C
# resend-w1
install=$1
test -d "/opt/$install"
umask 077
cat > "/opt/$install/first-contact.py" << 'FCEND'
import json,os,socket,ssl,sys,time,http.client
a=sys.argv
if len(a)!=12 or a[1] not in ("full","routes-only"):
 print("args:refused"); raise SystemExit(2)
mode,install,addr,apph,appa,subh,suba,email,name,slug,inbound=a[1:]
t0=time.monotonic()
stf="/opt/"+install+"/first-contact.state"
path="/opt/"+install+"/admin.password"
owned={"ok":False}
def quiet(t,v,tb):
 print("program:fail")
 print("owned:routes-incomplete" if owned["ok"] else "admin-password-file:kept")
sys.excepthook=quiet
sys.path.insert(0,"/opt/"+install)
from inbound import run as _ig
def inbound_gate():
 _ig(gate,note,srv,apph,inbound,install)
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

`<script>` for the RESEND second program write is this text and no other:

```
set -eu
export LC_ALL=C
# resend-w2
install=$1
test -s "/opt/$install/first-contact.py"
umask 077
cat >> "/opt/$install/first-contact.py" << 'FCEND'
def fail(alias,status):
 print("route:%s:%s"%(alias,status))
 try: note("route:%s:%s"%(alias,status))
 except Exception: pass
 print("owned:routes-incomplete"); raise SystemExit(50)
def load(alias,host):
 gate("route")
 try: st,et,data=adm("GET","/config/")
 except Exception: return None
 if st!=200 or not et: return ("bad","config-%s"%st)
 try: cfg=json.loads(data.decode())
 except Exception: return ("bad","config-not-json")
 if not shap(cfg): return ("bad","shape-refused")
 want=obj(alias,host)
 for rt in cfg["apps"]["http"]["servers"]["workloads"]["routes"]:
  if (rt["@id"]==want["@id"] or rt["match"][0]["host"][0].lower()==host.lower()) and rt!=want: return ("bad","host-conflict")
 return ("ok",cfg,et)
def post(alias,host):
 got=load(alias,host)
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
 got=load(alias,host)
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
inbound_gate()
try: pw=open(path,encoding="utf-8").read()
except Exception:
 print("admin-password:absent"); print("admin-password-file:kept"); raise SystemExit(54)
if pw.endswith("\n"): pw=pw[:-1]
if not pw or any(ch.isspace() for ch in pw):
 print("admin-password:refused"); print("admin-password-file:kept"); raise SystemExit(55)
gf=[None]
def gql(host,q,v,tok,step):
 gate(step)
 gf[0]=None
 try:
  c=http.client.HTTPConnection(srv,3000,timeout=8)
  hd={"Content-Type":"application/json","Host":host,"X-Forwarded-Host":host,"X-Forwarded-Proto":"https","Origin":"https://"+host}
  if tok: hd["Authorization"]="Bearer "+tok
  c.request("POST","/metadata",json.dumps({"query":q,"variables":v}).encode(),hd)
 except socket.timeout:
  print("graphql:fail:%s:timeout"%step); gf[0]="t"; return None
 except Exception:
  print("graphql:fail:%s:connect"%step); gf[0]="c"; return None
 try:
  r=c.getresponse(); b=r.read(); code=r.status; c.close()
 except socket.timeout:
  print("graphql:fail:%s:timeout"%step); gf[0]="n"; return None
 except Exception:
  print("graphql:fail:%s:connect"%step); gf[0]="c"; return None
 if code!=200:
  print("graphql:fail:%s:http-%s"%(step,code)); gf[0]="h"; return None
 try: return json.loads(b.decode())
 except Exception:
  print("graphql:fail:%s:not-json"%step); gf[0]="j"; return None
FCEND
echo writer-ok
```

- Each answer came back naming this identifier, and each printed `writer-ok`. Continue.
- Any did not. Do not run first-contact. Do not add a route. The directory stays. Name Job 3. A new plan is gated before the writes are sent again.

### What does the first-contact call do?

One `vm.command.run`. It is not a job. It can outlast the endpoint's 20 seconds. Do not send this call again in this run. A later `routes-only` plan is a new plan, gated again, not a repeat of this call.

`argv` is `/bin/sh`, `-c`, the script, `sh`, then the mode, the install name, the source address, the app hostname `app.<base>`, the app alias `<install>-app`, the workspace hostname `<sub>.<base>`, the workspace alias `<install>-<subdomain>`, the admin email, the display name, and the subdomain. When the driver is `RESEND`, one further operand follows, `<inbound_domain>`. The program requires 12 arguments then, and 11 when the driver is `LOG`. `routes-only` on a RESEND install still passes `<inbound_domain>` and does not run the inbound checks again. The password is not an operand and it is not an environment value. The program reads it from the file. The server's address is not an operand. The mode is `full` on Job 1. The mode `routes-only` is a different plan, gated again, and it is sent only when a fresh read shows the state file contains `workspace:ok`, the admin password file is absent, and one or both of the two routes are absent. It posts only the missing routes, appends to the state file, and never signs anyone up.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
cd "/opt/$2"
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

The shell first changes to `/opt/<install>`, so Compose finds the install's project from any working directory the router starts in. It checks `/healthz` from inside the server, up to three times. Each curl is limited to 5 seconds, with 2 seconds between tries. The loop can take about 21 seconds. It then reads the server container with `docker compose -p "$2" ps -q server` and that container's address on the network `$2-proxy` with `docker inspect`, and exports the address as `TWENTY_SERVER`. Then it runs the program.

The program records its start time. Before every network operation except the TLS probe, it stops with `deadline:<step>` when more than 35 seconds have passed. The step is `inbound`, `webhook`, `signup`, `signin`, `workspace`, `token`, `activate`, or `route`. Every socket timeout is at most 8 seconds. An operation that starts just before 35 seconds can run 8 seconds more, so with about 21 seconds of healthz loop a slow run can pass the router's 60 second limit and be killed. A kill before `workspace:ok` leaves no route and nothing public. A kill after it leaves an owned install, and the later read classifies it from the state file.

The program writes `/opt/<install>/first-contact.state`, mode 600. The file holds no secret. It appends one line and flushes that line before it continues. A `full` run that gets past the address check appends `start`. When the driver is `RESEND`, it then appends `inbound-domain:ok` and `inbound-webhook:refused` when those checks pass, or the failing inbound line when one does not, and it does that before it reads the password file. A run that has not stopped there then appends `workspace:ok`, `password-file:removed`, an activation line when it records one, `route:<alias>:<status>` for each route it settles, and `done`. The activation line is `activate:ok`, `activate:fail`, `activate:unknown`, or `activate:skipped:token`. `done` is written after the route lines and before the TLS probe, so a probe that is killed does not drop a finished route write. Every run, `full` or `routes-only`, begins its lines with `start`, and the file keeps every run's lines, so a route line may be an earlier run's.

In `full` mode the program refuses `TWENTY_SERVER` unless it is a private IPv4 address in `10.0.0.0/8`, `172.16.0.0/12`, or `192.168.0.0/16`, and no octet has a leading zero. A refusal prints `server-address:refused`, writes no state line, posts no route, and exits nonzero. An accepted address is the server container on the install's Docker network `<install>-proxy`, which is an ordinary bridge and is reachable from the host. The program calls that address with plain HTTP on port 3000. Every request sets `Host` and `X-Forwarded-Host` to the hostname it stands for, `X-Forwarded-Proto` to `https`, and `Origin` to `https://` plus that hostname. `signUp`, `signIn`, and `signUpInNewWorkspace` use `app.<base>`. `getAuthTokensFromLoginToken` and `activateWorkspace` use `<sub>.<base>`. Twenty v2.45.6 trusts those forwarded headers when the peer is in the `TRUST_PROXY` default `loopback, linklocal, uniquelocal`, which covers this bridge. A call that issues a session cookie is allowed only when `Origin` equals the request's own origin. This path was proved live on Twenty v2.45.6 on 2026-10-09, creating the admin and the first workspace. A refusal fails before any route exists.

When the driver is `RESEND` and the mode is `full`, the next step, before the password file is read, reads `INBOUND_EMAIL_DOMAIN` from the server and from the worker with `docker compose -p <install> exec -T <service> printenv INBOUND_EMAIL_DOMAIN`. It compares each value with `<inbound_domain>` and prints neither value. Both equal: it prints `inbound-domain:ok`. A read that fails prints `inbound-domain:unread`. A value that differs prints `inbound-domain:mismatch`. Either stops the call, prints `admin-password-file:kept`, posts no route, and exits 57. It then sends one `POST` to `http://<server>:3000/webhooks/messaging/resend`, at the server's private address, the same way it calls GraphQL. The body is `{}`. The headers are `Content-Type: application/json`, `Host` and `X-Forwarded-Host` set to `<base>` (the app hostname with the leading `app.` removed), `X-Forwarded-Proto` set to `https`, and `Origin` set to `https://` plus `<base>`. It sends no `svix-id`, `svix-timestamp`, or `svix-signature` header. It prints no body and no secret. Nothing is sent to Resend. Twenty v2.45.6 at `6007ad5a` answers this post from `modules/messaging-webhooks/messaging-webhooks.controller.ts`, which calls `drivers/resend/services/resend-webhook-verifier.service.ts` before it imports any mail. A missing signing secret throws `RESEND_WEBHOOK_SIGNING_SECRET is not configured` with code `MESSAGING_WEBHOOK_NOT_CONFIGURED`. Missing Svix headers throw `Missing Svix signature headers` with code `MESSAGING_WEBHOOK_INVALID_SIGNATURE`. `utils/get-messaging-webhook-exception-status-code.util.ts` maps both codes to HTTP 403. `messaging-webhook.exception.ts` uses one user-facing sentence for both, so the program does not match that sentence. The filter `filters/messaging-webhook-api-exception.filter.ts` sends the body through `HttpExceptionHandlerService`, whose JSON carries `statusCode`, `messages` holding the exception's own message, and `code` when the exception is a `CustomError`, which this one is. The program continues only when the status is 403 and `code` is `MESSAGING_WEBHOOK_INVALID_SIGNATURE`, and then it prints `inbound-webhook:refused`. The same status with `code` `MESSAGING_WEBHOOK_NOT_CONFIGURED` prints `inbound-webhook:not-configured` and stops: the secret did not load. HTTP 404 prints `inbound-webhook:404` and stops: the route did not reach the server. Any other answer prints `inbound-webhook:fail` and stops. A stop prints `admin-password-file:kept`, posts no route, and exits 57. A `LOG` run does not read the domain and does not send this request, and its output does not contain these lines.

GraphQL is `POST /metadata`. The documents are `signUp`, and `signIn` only when the error message is exactly `User already exists`, then `signUpInNewWorkspace`, then `getAuthTokensFromLoginToken`, then `activateWorkspace`. No token, no password, and no other error message is printed. A failed step prints `graphql:fail:<step>:<connect|timeout|http-<code>|not-json>`. The step is the one the helper was called with. The line has no message text and no token. Any other error is `signup:fail:withheld` or `signin:fail`. The password file stays. No route has been posted.

The program posts no route until it has printed `workspace:ok` and removed the admin password file. It then records activation. `activate:ok` means the workspace was activated. `activate:fail` means an answer arrived without `activationStatus`. `activate:unknown` means the activate request was sent and no answer came within the 8 second cap. `activate:skipped:token` means the token step failed, so the activate request was not sent. `activate:unknown` and `activate:skipped:token` mean the workspace exists and its activation is not confirmed. The person's first sign-in either shows the workspace, when it was activated, or Twenty's create-workspace screen, where they finish it. Neither stops the run. A connect failure on the activate step, or a timeout before that request was sent, prints the graphql line and no activation line. The run still goes on to the routes when the deadline has not stopped it. A deadline during activation prints `deadline:activate` and `owned:routes-incomplete`, posts no route, and exits nonzero. `routes-only` does not retry activation.

The route post is a fresh `GET /config/` for the `Etag`, the shape check, and a `POST` with `If-Match` set to that `Etag`. That same read is refused with `route:<alias>:host-conflict` when any route already in it has this route's `@id` or routes this hostname and is not exactly the generated object, so a route another writer added cannot keep this hostname's traffic while this call reports success. The hostname comparison lowercases both sides. The app route is first, then the workspace route. The body is `{"@id":"workload-<alias>","match":[{"host":["<hostname>"]}],"handle":[{"handler":"reverse_proxy","upstreams":[{"dial":"<alias>:3000"}]}],"terminal":true}`. A post that fails after ownership prints `route:<alias>:<status>` and `owned:routes-incomplete` and exits nonzero. It removes nothing. The program never deletes a route.

After the route lines the program appends `done` and probes TLS for `app.<base>`. The probe is one verified handshake to the source address on port 443, SNI `app.<base>`, with `ssl.create_default_context()`. Its socket timeout is the time left under the 35 seconds, and at most 8 seconds. It prints `tls:ready` or `tls:pending`. It does not print the certificate. It does not change the outcome, and it does not open a socket when no time is left. Certificate issuance is checked later by the outside checks.

`routes-only` posts nothing unless the state file already contains `workspace:ok` and the password file is absent. Otherwise it prints `routes-only:refused`, writes no new state line, and exits nonzero. It never signs anyone up. For each of the two routes, a fresh read that already holds the exact generated object prints `route:<alias>:200`, appends that line, and does not post again. A route that is absent is posted the same way as in `full`. An unexpected exception prints `program:fail` and either `owned:routes-incomplete` or `admin-password-file:kept`, and does not print the exception text. It removes nothing.

What did the call answer? Take the first match.

- The outcome is `uncertain`, `timeout`, `killed`, or `request_timeout`, or `status` is `vendor_error`, or the answer carries no `machine`. Do not classify the call from partial output. Do not send the call again. One later read, no sooner than 70 seconds after the call was sent. The 70 seconds cover the router's 60 second limit, the 5 second kill grace, and a margin. Then ask what the later read showed.
- The outcome is `ok`, `truncated`, or `remote_failure`, the answer names this identifier, and `healthz:200` was not printed. The program did not start. No route was posted. Nothing is public. Stop. A new plan is gated before another call.
- The mode was `routes-only`, the outcome is one of those three, the answer names this identifier, and the output contains `route:<app alias>:200` and `route:<workspace alias>:200`. It contains no `signup:` line, no `owned:routes-incomplete`, no `deadline:`, and no `program:fail`. The missing routes are in place. Do not send the call again. Continue to the base route.
- The outcome is one of those three, the answer names this identifier, and the output contains `workspace:ok`, `admin-password-file:removed`, `route:<app alias>:200`, and `route:<workspace alias>:200`. It does not contain `owned:routes-incomplete`, `deadline:`, or `program:fail`. When the driver is `RESEND`, it also contains `inbound-domain:ok` and `inbound-webhook:refused`, both before `workspace:ok`. When the driver is `LOG`, it contains neither `inbound-domain:` nor `inbound-webhook:`, and that absence does not fail this match. The workspace exists and both routes are in place. `activate:ok` means it was activated. `activate:fail` means an answer arrived without `activationStatus`. `activate:unknown` and `activate:skipped:token` mean the workspace exists, its activation is not confirmed, and the person's first sign-in either shows the workspace, when it was activated, or Twenty's create-workspace screen, where they finish it. Neither stops the run. No activation line means the activation is not confirmed. `tls:ready` and `tls:pending` do not change this. Do not send the call again. Continue to the base route.
- The output contains `owned:routes-incomplete`. The install is owned. A `routes-only` plan is gated again. Do not send it in this run. Do not remove a route. Removing the install is Job 3.
- The output contains `workspace:ok` and `admin-password-file:kept`. The workspace exists. The password file stays. No route was posted. Stop. A new plan is gated before another call. `routes-only` is not that plan while the password file is present.
- The output contains `server-address:refused` or `routes-only:refused`. No route was posted. A refused address writes no state line. Stop. A new plan is gated before another call.
- The output contains `signup:fail:withheld`, `signin:fail`, `workspace:fail`, `admin-password:absent`, `admin-password:refused`, `inbound-domain:unread`, `inbound-domain:mismatch`, `inbound-webhook:not-configured`, `inbound-webhook:404`, `inbound-webhook:fail`, or `deadline:` together with `admin-password-file:kept`, or `program:fail` together with `admin-password-file:kept`. The failure is before ownership. `inbound-webhook:not-configured` means the signing secret did not load. `inbound-webhook:404` means the route did not reach the server. No route was posted. Nothing is public. The password file stays. Stop. Job 1 refuses an install directory that exists and `routes-only` needs `workspace:ok`, so neither continues this install. The way on is Job 3's full removal of it, named and gated as Job 3, then a new Job 1 under a new plan once the cause is corrected: for `inbound-webhook:not-configured`, the signing secret is typed again at the new install's helper; for `inbound-domain:mismatch`, `<inbound_domain>` is checked against the plan; for any other line, the line is reported and the cause named before the new plan.
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
- The state has `start` and does not have `workspace:ok`. The program failed before ownership. On a RESEND install those lines may include `inbound-domain:unread`, `inbound-domain:mismatch`, `inbound-webhook:not-configured`, `inbound-webhook:404`, or `inbound-webhook:fail`. Nothing is public. The password file stays. Stop. A new plan is gated before another call.
- The state has `workspace:ok`. The install is owned. Judge the routes from the config this read printed, never from route lines in the state, which may be an earlier run's. Report the lines after the last `start`, which say what the last attempt did.
  - The config read succeeded and holds both exact generated route objects, the app route for `app.<base>` with the app alias and the workspace route for `<sub>.<base>` with the workspace alias. The routes are in place. `activate:ok` in the state means the workspace was activated. `activate:fail` means an answer arrived without `activationStatus`. `activate:unknown` and `activate:skipped:token` mean the workspace exists and its activation is not confirmed. The person's first sign-in either shows the workspace, when it was activated, or Twenty's create-workspace screen, where they finish it. Neither stops the run. No activation line means the activation is not confirmed. Continue to the base route.
  - Anything else: a route is missing, a route for one of these hostnames is not the generated object, or the config was not read. When the read printed `password-file:absent`, `routes-only` is the next plan, gated again. When the password file is present, stop for a new plan. `routes-only` is not that plan. Do not post from this run. Do not remove a route.
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
docker ps -a --no-trunc --filter "label=com.docker.compose.project=$install" --format '{{.ID}} {{.Label "com.docker.compose.service"}}'
printf '%s\n' '--- memory ---'
docker stats --no-stream --format '{{.ID}} {{.MemUsage}}'
printf '%s\n' "stats-exit:$?"
exit 0
```

Report `MemUsage` for the ids whose service label is `server`, `worker`, `db`, or `redis`. Do not report other containers. When `<relay>` is present the id list may also name `relay`. That line is not one of the four, and this read does not judge it. A missing stats line is reported as unread. It does not by itself undo a route.

### Job 2. Add or remove one hostname on an install this skill made

The map, the health, the role, the inspection, the token, the loaded-job, the Caddy, and the marker questions are the ones above. The alias label and the hostname matched before any call. The gate runs before any change call.

Adding. Read the aliases line from the inspection. It is one line. The names inside the brackets, split on commas, are the current aliases. The new alias is not already in that list, the hostname is not already present, and the question who answers to this install's aliases found no other container answering to the new alias. When either is present, stop. Do not post a second route. When the list cannot be read, stop.

The new list is the current names plus the new alias, in that order. One `vm.command.run`. `argv` is `/bin/sh`, `-c`, the script, `sh`, the install name, the server container id, the proxy network id, and then each alias as its own operand. The server id is the container whose service label is `server` and whose project label is the install name. The network id is the id on the `${install}-proxy` inspect line in the project-network section, and that line's project label is the install name. A missing id stops the run. `<script>` is this text and no other:

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

Ask on Job 3, before the gate and before any removal call, the partial branch included. The full removal destroys every organisation's data on the install: the database volume, the local volume, and the directory. It removes the relay with the install. The relay container `<install>-relay`, service `relay`, goes with the project containers, and `/opt/<install>/relay` goes with the directory. The partial branch removes the directory alone, and the relay's files with it. There is no container, no volume, no project network, and no route.

- The person's words name the install and say to remove it. Record that confirmation in the plan. Continue to the gate.
- The words do not name the install, or they do not say to remove it. Ask once, naming the install. No answer, or an answer that does not name it: stop. Send nothing.

### Job 3. Remove an install this skill made

The marker question has already said which branch this is.

The partial branch removes the directory alone, as one job. It does not delete a route, an image, a network, or a volume. A partial install normally has no route, since routes are posted only after `workspace:ok`. The marker question has already refused one whose routes remain in the live config. Before the gate, read the config script, and continue only when the saved config also holds no route whose `@id` begins `workload-` followed by the install name and a hyphen. Otherwise stop, and name each such route. The person's confirmation naming the install still applies before the job is sent. The plan for this branch is that one job and no other change call. The operands are the install name, the device, and the inode, taken from the inspection's `stat:` line. That line is `stat:` followed by the device, the inode, and the mode. The mode is not an operand.

Write the script verbatim. Run `start` with `--purpose twenty-remove-partial`, `--limit 60`, `--token` the token the latest inspection read, `--script` that file, and those operands. Then the job question.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
dev=$2
ino=$3
d=/opt/$install
mark=$(cat "$d/INSTALL")
printf '%s\n' "$mark" | grep -qx 'skill=deploy-twenty' || { echo marker-mismatch; exit 30; }
printf '%s\n' "$mark" | grep -qx 'release=v2.45.6' || { echo marker-mismatch; exit 30; }
printf '%s\n' "$mark" | grep -qx "project=$install" || { echo marker-mismatch; exit 30; }
test "$(realpath -e "$d")" = "$d"
test -d "$d"
test "$(stat -c '%d %i' "$d")" = "$dev $ino"
m=$(awk -v o="$d" '$2 == o || index($2, o "/") == 1 { print }' /proc/mounts)
test -z "$m"
echo identities-match
test "$(stat -c '%d %i' "$d")" = "$dev $ino"
find "$d" -mindepth 1 -maxdepth 1 ! -name INSTALL -exec rm -rf --one-file-system {} +
rm -f -- "$d/INSTALL"
rmdir -- "$d"
test ! -e "$d"
echo directory-removed
```

The partial removal counts only when the job's class is `succeeded` and the text after `]: ` includes `identities-match` and `directory-removed`, in that order, and a closing re-inspection shows the directory absent. The partial branch has no container. `dir-absent` means the relay's files went with the directory. The closing re-inspection shows no service `relay`. `changed` requires both. A job that exits after `identities-match` and before `directory-removed` is not run again. Re-read. A new plan is gated before any further delete.

The full removal applies when the marker question named the full branch. Read identities before the gate, with one read. `argv` is `/bin/sh`, `-c`, the script, `sh`, and the install name. The person is told it is a read. `<script>` is this text and no other:

```
export LC_ALL=C
install=$1
printf '%s\n' '--- ids ---'
docker ps -a --no-trunc --filter "label=com.docker.compose.project=$install" --format '{{.ID}} {{.Label "com.docker.compose.service"}} {{.Label "com.docker.compose.project"}}'
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
nids=$(docker network ls --no-trunc --filter "label=com.docker.compose.project=$install" --format '{{.ID}}')
printf '%s\n' "network-ls-exit:$?"
if [ -n "$nids" ]; then
  # shellcheck disable=SC2086
  docker network inspect --format '{{.Id}} {{.Name}} {{index .Labels "com.docker.compose.project"}}{{range $k, $v := .Containers}} {{$k}}{{end}}' $nids
  printf '%s\n' "network-inspect-exit:$?"
else
  printf '%s\n' networks-none
fi
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

Also read the config with the config script, and keep that body as the before-state. Every route whose `@id` is `workload-` plus an alias from the aliases line is this install's route. The route deletes are Job 4's route delete, in the order the aliases line lists them. A route that fails that delete stops the run. Remove nothing further. Once a route delete has been sent, the report copies this install's route objects from the before-state verbatim, a stopped run included, so that bringing the install back online can post them while its data is still there.

The network section lists every network whose label `com.docker.compose.project` is the install. Each line is the full id, the name, the label, and then the full id of each container attached to that network. Every attached container has to be one of this install's containers in the ids section or the Caddy container. Any other attached container stops the run before the gate: that network is shared, and removing it would cut that container off. Name it. Change nothing. `networks-none` with `network-ls-exit` 0 is an empty set. `network-ls-exit` or `network-inspect-exit` other than 0 means the networks were not read. Compose creates `<install>_default` and `<install>-proxy`. Both carry that label. The operand is the full id, not the name.

The plan removes, in order: each of this install's routes, then the saved-config and live-config comparison, then one removal job for the containers, the volumes, the project networks, and the directory, in that order. Images are not in the plan. `docker compose down` is not sent. A volume named `caddy-config` or `caddy-data` is refused by name. Those volumes are Caddy's, and the certificates in `caddy-data` stay.

After the last route delete, read the config script once more. The live config and the saved config have to parse to the same object, and that object is the before-state with only this install's route objects removed. Every other route stays. A difference stops the run before the removal job. Report the difference. Do not delete a container. Routes already deleted stay deleted.

The removal job is sent only when a fresh identity read, taken after the config comparison, lists the directory and the containers, volumes, and project-labelled networks the operands name. A container count of 0 matches an empty container list. A volume count of 0 matches an empty volume list. An empty list on both sides is a match. The network count is the number of project-labelled networks in that read. A network count of 0 matches an empty network list, as long as a container or a volume remains. If a set differs, stop. Do not delete. A new plan is gated again.

The operands, in order, are the install name, the device number, the inode, the network count, each full network id, the Caddy container id, the container count, each full container id, the volume count, and then each volume as a pair: the volume name, then its `CreatedAt` as one operand. `CreatedAt` may contain spaces. It is one operand, never split. Seven operands are fixed: the install name, the device, the inode, the network count, the Caddy container id, the container count, and the volume count. Each network adds one, each container adds one, and each volume adds two. The total is at most 56, so the networks, the containers, and twice the volumes add up to at most 49. More than 56 operands stops the run. Do not choose which to omit.

The job verifies every identity before it deletes anything. The marker checks require `skill=deploy-twenty`, `release=v2.45.6`, the `compose-sha256` line, and `project=` followed by the install name, each as a whole line. A `stage=` line may be present. Those checks do not reject it. A mismatch exits before a delete. Enumeration that fails is a failure, not an absence. A count of 0 writes no operand for that set and reads no further operand for it, so `set -u` does not see an unset parameter. The enumerated list and the operand list are compared as sorted text. An empty list on both sides compares equal: the comparison returns success when both texts are empty, before `test` sees them, so `set -eu` does not treat that equality as a failed command. Each container's project label equals the install. Each volume's inspect line matches its name, the install, its `CreatedAt`, and the driver `local`. Each project network's label equals the install, and every container attached to it is an operand container or the Caddy container. Any other prints `endpoint-refused` and exits 33, before any removal. It then removes the containers, then the volumes, then the project networks, then the directory. A count of 0 still prints that step's marker. No `docker rm`, `docker volume rm`, or `docker network rm` runs before `identities-match`. For each project network it reads the attached containers again. Caddy has to be the only one left, or it prints `endpoint-refused` and exits 33. It disconnects Caddy when Caddy is attached, then it removes the network. The directory is removed only when its device and inode still match, `realpath` is `/opt/<install>`, and nothing is mounted on or under it. Every entry but `INSTALL` is removed first with `rm -rf --one-file-system`, then `INSTALL`, then the empty directory with `rmdir`. A stop inside that step leaves the directory with its marker, or an empty directory, never a directory of files with no marker.

Write the script verbatim. Run `start` with `--purpose twenty-remove`, `--limit 600`, `--token` the token the latest inspection read, `--script` that file, and those operands. Then the job question.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
must() {
  if [ -z "$1" ] && [ -z "$2" ]; then
    return 0
  fi
  [ "$1" = "$2" ] || { echo set-mismatch; exit 32; }
}
install=$1
dev=$2
ino=$3
nn=$4
shift 4
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
: > "$d/net.check"
i=0
while [ "$i" -lt "$nn" ]; do
  printf '%s\n' "$1" >> "$d/net.check"
  shift
  i=$((i + 1))
done
caddy=$1
nc=$2
shift 2
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
ids=$(docker ps -aq --no-trunc --filter "label=com.docker.compose.project=$install") || { echo enumerate-failed; exit 1; }
got=$(printf '%s\n' "$ids" | sort)
want=$(sort "$d/id.check")
must "$got" "$want"
while IFS= read -r id; do
  test "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$id")" = "$install"
done < "$d/id.check"
vnames=$(docker volume ls -q --filter "label=com.docker.compose.project=$install") || { echo enumerate-failed; exit 1; }
vgot=$(printf '%s\n' "$vnames" | sort)
vwant=$(cut -f1 "$d/vol.check" | sort)
must "$vgot" "$vwant"
while IFS=$(printf '\t') read -r name created; do
  case "$name" in caddy-config|caddy-data|'') echo volume-refused; exit 31 ;; esac
  line=$(docker volume inspect --format '{{.Name}} {{index .Labels "com.docker.compose.project"}} {{.CreatedAt}} {{.Driver}}' "$name")
  test "$line" = "$name $install $created local"
done < "$d/vol.check"
nids=$(docker network ls --no-trunc --filter "label=com.docker.compose.project=$install" --format '{{.ID}}') || { echo enumerate-failed; exit 1; }
ngot=$(printf '%s\n' "$nids" | sort)
nwant=$(sort "$d/net.check")
must "$ngot" "$nwant"
while IFS= read -r id; do
  test "$(docker network inspect --format '{{index .Labels "com.docker.compose.project"}}' "$id")" = "$install"
  eps=$(docker network inspect --format '{{range $k, $v := .Containers}}{{$k}} {{end}}' "$id")
  for e in $eps; do
    [ "$e" = "$caddy" ] || grep -qx -- "$e" "$d/id.check" || { echo endpoint-refused; exit 33; }
  done
done < "$d/net.check"
echo identities-match
while IFS= read -r id; do
  docker rm -f "$id" >/dev/null
done < "$d/id.check"
echo containers-removed
while IFS=$(printf '\t') read -r name created; do
  docker volume rm "$name" >/dev/null
done < "$d/vol.check"
echo volumes-removed
while IFS= read -r id; do
  eps=$(docker network inspect --format '{{range $k, $v := .Containers}}{{$k}} {{end}}' "$id")
  for e in $eps; do [ "$e" = "$caddy" ] || { echo endpoint-refused; exit 33; }; done
  if [ -n "$eps" ]; then docker network disconnect "$id" "$caddy"; fi
  docker network rm "$id" >/dev/null
done < "$d/net.check"
echo network-removed
test "$(stat -c '%d %i' "$d")" = "$dev $ino"
find "$d" -mindepth 1 -maxdepth 1 ! -name INSTALL -exec rm -rf --one-file-system {} +
rm -f -- "$d/INSTALL"
rmdir -- "$d"
test ! -e "$d"
echo directory-removed
```

The full removal counts only when the job's class is `succeeded` and the text after `]: ` includes `identities-match`, `containers-removed`, `volumes-removed`, `network-removed`, and `directory-removed`, in that order, and a closing re-inspection shows the directory absent, the project containers absent, the project volumes absent, the project networks absent, and the live config and the saved config still equal to the post-route before-state. The relay is among what that removal deletes. The closing re-inspection shows no service `relay` in the project section and `dir-absent`, so the relay container and `/opt/<install>/relay` are both gone. The project networks are absent when the project-networks section is empty and the `${install}-proxy` inspect contains `not found`, compared without regard to case. `changed` requires all of that. A job that exits after `identities-match` and before `directory-removed` is not run again. Ask where a stopped removal stopped, after the job question. The job is not re-sent.

### Has the person confirmed taking the install offline, or bringing it back online?

Ask on Job 4, before the gate and before any route call.

- The change is offline. The person's words name the install and say to take it offline. Record that confirmation in the plan. Continue to the gate.
- The change is online. The person's words name the install and say to bring it online. Record that confirmation in the plan. Continue to the gate.
- The words do not name the install, or they do not say the change. Ask once, naming the install and the change. No answer, or an answer that does not name them: stop. Send nothing.

### Job 4. Take an install offline

Keeping the data. The marker question has said this is a complete install this skill made. The confirmation is recorded. The gate runs before any change call. This job changes no alias, no container, no network, no volume, and no file. It stops there by design. The relay keeps running. Neither offline nor online writes `conf/state`, so bringing an install online never releases a hold.

The aliases are the names inside the brackets on the aliases line, split on commas. Every step below uses that order, left to right.

Offline. The config read is the config script. Its config body is kept as the before-state. Every route whose `@id` is `workload-` plus one of those aliases is this install's route. When that read shows none of those objects in the live config and none in the saved config, there is nothing to change. Write nothing. Take no gate.

The route delete, for one alias. GET `http://localhost/id/workload-<alias>`. The argv is the Job 2 GET. The person is told the GET is a read. The removal check is the Job 2 removal check, for this alias and for the hostname that the before-state's route with `@id` `workload-<alias>` carries. A GET that returns a route the before-state does not hold fails the check. Take the first match.

- The check holds. DELETE `http://localhost/id/workload-<alias>` with `If-Match` set to that GET's `Etag`. The argv is the Job 2 DELETE.
- The status line is `404`, or the body says the object id is unknown. The route is already absent live. Do not DELETE.
- The check does not hold. Stop. Remove nothing further. Routes already deleted stay deleted.
- The route was not read. Stop. Remove nothing further.

What did the DELETE answer, when one was sent?

- The status line is `200` or `404`. Read the saved config, the Job 2 saved-config read. The route is gone only when that answer names this identifier and the output parses as JSON and no object in it has `@id` equal to `workload-<alias>`. Otherwise stop. Do not continue to the next alias.
- The status line is `412`. The call changed nothing. Stop. Do not continue to the next alias.
- Any other answer. Stop. Do not continue to the next alias.

When the GET was already `404`, do that same saved-config read and continue only when the route is absent from it. Do this for each alias, in the stated order.

After the last alias, read the config script once more. The live config and the saved config have to parse to the same object, and that object is the before-state with only this install's route objects removed. Every other route stays. A difference stops the run. Report the difference. Do not delete a container, a network, a volume, an alias, or a file.

Then re-inspect with the inspection script. The outside checks are one curl each, the curl in the outside-checks question, for `<base>` and for `app.<base>`, with no retry and no `-k`. A Twenty answer is exit 0 and the code `200`. The requested state is that neither host gives a Twenty answer, this install's routes are absent from the live config and from the saved config, and the aliases line, the project containers, the project volumes, the project networks, and the directory are unchanged from the inspection. The relay container is still running. `conf/state` is the bytes it had. Offline does not write it.

The way back is bringing the install back online, named in the plan and not sent in this run.

Bringing an install back online. The recorded route objects are this install's route objects in a recorded before-state: the one a Job 4 offline plan kept, or the one a Job 3 plan kept before its first route delete. That run's report copies them verbatim. A run that has neither stops. It does not rebuild a route from the alias list, which holds no hostname. The route objects are the ones whose `@id` is `workload-` plus an alias from the aliases line, in the stated order. When every one of those objects is already present and is exactly the recorded object, and no other route has one of their `@id`s or routes one of their hostnames, compared case-insensitively, there is nothing to change. Write nothing. Take no gate. Another route that has one is the conflict bullet below, and stops.

For each recorded object, in the stated order, a fresh config read, the config script. The shape holds. Take the first match.

- A route other than that exact object has its `@id`, or routes its hostname, compared case-insensitively, whether or not the exact object is also present. Stop. Post nothing further. Name the route that holds it. A route already posted stays.
- That exact object is present. Post nothing for it. Continue to the next object.
- Both are absent. One POST of exactly that recorded object, in the base route's POST form, with `If-Match` set to the fresh config `Etag`. A `200` posts it: continue to the next object. A `412` is handled as the base route handles it. Any other answer stops. Do not POST the rest. A route already posted stays.

This posts every such label, `base` and `app` included. It does not touch an alias. A run stopped partway is taken again from a fresh plan with the same recorded objects: an object already present is skipped, and only the missing ones are posted.

After the last POST, re-inspect. The requested state is each recorded route present and exactly the recorded object, and the aliases, containers, networks, volumes, and directory unchanged. The relay container and `conf/state` are unchanged. Online does not write `send`. The outside checks are the outside-checks question for `<base>` and for `app.<base>`.

### Has the person confirmed the relay change?

Ask on Job 5, before the gate and before any change call. A report-only read asks nothing here, writes nothing, and takes no gate.

- The action adds, rotates, or removes one login. The person's words name the install, the login, the domain, and the action. An add or a rotate also names the upstream. Record that confirmation in the plan. Continue to the gate.
- The action writes `send` or `hold`. The person's words name the install and that word. Record that confirmation in the plan. Continue to the gate. A restore target's relay stays held until this job writes `send`.
- The action replaces one upstream token. The person's words name the install and the upstream. Record that confirmation in the plan. Continue to the gate. The token is not named.
- The action adds or removes one upstream. The person's words name the install, the upstream, and the action. Record that confirmation in the plan. Continue to the gate.
- The words do not name the install and the action. Ask once, naming the install and the action. No answer, or an answer that does not name them: stop. Send nothing.

### Job 5. Relay logins and state

One action in a run. The marker question has said this is a complete install this skill made. When the action changes anything, the confirmation is recorded and `experts/DevOps Expert/` has gated the plan before any change call. A report-only read writes nothing and takes no gate.

The relay directory is `/opt/<install>/relay`. When it is absent, a change stops. Job 1 installs the relay. This job does not. A report-only read still sends the report script below, which prints `relay-report:state:absent`.

An organisation's login is bound to its domain once. A second login for a domain is refused by name. Removing a login is what taking an organisation's shared mailbox off the relay means. `rotate` replaces the password and may name another upstream. It never changes the domain.

The tool is `tools/twenty-relay/`. Its commands used here are `login-helper` and `state`. The token helper, the upstream write, and the report read are the scripts in this job. The tool does not print those three.

#### One login

The login read is one direct call, before the helper is given and again after the person has run it. `argv` is `/bin/sh`, `-c`, the script, `sh`, the install name, and the login. The person is told it is a read. It prints each login's name, domain and upstream, an eight-character hash prefix for the named login when the stored hash has one, whether that login is present, each upstream name in `upstreams.json`, and the relay container's latest `config hash=` log line. It prints no salt, no password, and no full hash.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
login=$2
fail() { printf '%s\n' "relay-login:fail:$1"; exit 1; }
case "$install" in *[!a-z0-9]*|""|caddy) fail install;; esac
n=${#install}
[ "$n" -ge 2 ] && [ "$n" -le 13 ] || fail install
case $(printf '%.1s' "$install") in [a-z]);; *) fail install;; esac
case "$login" in ""|*[!a-z0-9-]*) fail login;; esac
ln=${#login}
[ "$ln" -ge 1 ] && [ "$ln" -le 32 ] || fail login
conf=/opt/$install/relay/conf/logins.json
[ -f "$conf" ] || fail no-logins
python3 - "$conf" "$login" <<'PY'
import json, os, sys
path, login = sys.argv[1:3]
rows = json.load(open(path, encoding='utf-8'))
if not isinstance(rows, list):
    sys.stderr.write('not-list\n')
    sys.exit(1)
seen = False
for row in rows:
    if not isinstance(row, dict):
        sys.stderr.write('row\n')
        sys.exit(1)
    name = row.get('login')
    domain = row.get('domain')
    upstream = row.get('upstream')
    for value in (name, domain, upstream):
        if not isinstance(value, str) or value == '' or any(ch in value for ch in ':\n\r'):
            sys.stderr.write('row\n')
            sys.exit(1)
    sys.stdout.write('relay-login:%s:%s:%s\n' % (name, domain, upstream))
    if name == login:
        seen = True
        digest = row.get('sha256')
        prefix = ''
        if isinstance(digest, str) and len(digest) >= 8:
            head = digest[:8]
            if all(ch in '0123456789abcdef' for ch in head):
                prefix = head
        sys.stdout.write('relay-login-hash:%s:%s\n' % (name, prefix))
if seen:
    sys.stdout.write('relay-login:present:%s\n' % login)
else:
    sys.stdout.write('relay-login:absent:%s\n' % login)
up_path = os.path.join(os.path.dirname(path), 'upstreams.json')
try:
    ups = json.load(open(up_path, encoding='utf-8'))
except (OSError, ValueError):
    ups = []
if isinstance(ups, list):
    for row in ups:
        if not isinstance(row, dict):
            continue
        uname = row.get('name')
        if isinstance(uname, str) and uname and all(ch not in uname for ch in ':\n\r'):
            sys.stdout.write('relay-upstream-known:%s\n' % uname)
PY
logs=$(docker logs --tail 400 -- "${install}-relay" 2>&1 || true)
line=$(printf '%s\n' "$logs" | awk '/config hash=/ { kept = $0 } END { if (kept != "") print kept }')
if [ -n "$line" ]; then
  printf '%s\n' "relay-reload:$line"
else
  printf '%s\n' "relay-reload:absent"
fi
printf '%s\n' "relay-login:read:ok"
```

Before the helper, take the first match.

- The read did not print `relay-login:read:ok`. Stop. The helper is not given. Send nothing.
- The action is `add`, and the output has `relay-login:present:<login>`, or a `relay-login:` line whose domain is this domain. Refuse by name. A second login for a bound domain is refused. Write nothing. The helper is not given.
- The action is `rotate` or `remove`, and the output has `relay-login:absent:<login>`, or the line for that login carries another domain. Refuse by name. Write nothing. The helper is not given.
- The action is `add` or `rotate`, and no `relay-upstream-known:` line is the named upstream. Refuse by name. `upstreams.json` lacks that upstream. Write nothing. The helper is not given.
- Otherwise record the eight-character prefix when one was printed. Continue.

Build the helper where the plugin is: `node scripts/twenty-relay.js login-helper --install-name <install> --login <login> --domain <domain> --upstream <upstream> --action add|rotate|remove`. The domain is the hostname lowercased. The command prints one JSON object. Its `helper` field is the text. That text is longer than 4096 code points, so it is never an argument of `vm.command.run`, and it needs a terminal. Give the text to the person. They run it as root on the machine, from their own Oracle Cloud Shell session, the route `skills/Prepare VM/providers/oracle.md` names. The password is printed only in that terminal. This skill does not ask for it, does not repeat it, and does not place it in an operand.

The helper refuses, writing nothing, a second login for a bound domain, a rotate or a remove whose domain differs, and an upstream `upstreams.json` lacks. It writes the new `logins.json` by rename, mode `0640`, owner `0:1000`, and signals `<install>-relay`. Its standard output is `login=`, `domain=`, and `hash=`, the first eight hex characters of the stored hash. Exit 3 means `logins.json` is in place and the relay reads it at its next start or `SIGHUP`. The password was not in that output.

After the person has run it, send the login read again. The action counts only when the call came back and all of these hold. For `add` and `rotate`: a line `relay-login:<login>:<domain>:<upstream>`, a line `relay-login-hash:<login>:` whose prefix equals the helper's `hash=`, and the last `relay-reload:` line contains `status=loaded`. For `remove`: `relay-login:absent:<login>`, no `relay-login:<login>:` line remains, the helper's `hash=` equals the prefix recorded before the helper, and the last `relay-reload:` line contains `status=loaded`. Exit 3 does not count until a later read shows `status=loaded`. Do not give the helper again in this run. The lines shown are the login, the domain, the upstream, the eight-character prefix, and the reload line.

The way back for an add is a remove of that login, named and not sent in this run. A rotate or a remove cannot put the old password back. The person copies the new password from that terminal into Twenty.

#### Send or hold

Build the argv where the plugin is: `node scripts/twenty-relay.js state --install-name <install> --to send` or `--to hold`. The printed `argv` is `/bin/sh`, `-c`, a script, `sh`. The script writes the four bytes `send` or `hold`, with no newline, to `/opt/<install>/relay/conf/state`, mode `0640`, owner `0:1000`, by rename, then reads `/opt/<install>/relay/journal/status`. The relay writes that file as `state=<send|hold> inflight=<n> seq=<n> time=<ISO-8601 UTC>`. For `hold` the script waits up to 130 seconds for a status no older than 15 seconds whose `state` is `hold`, then for `inflight=0` in such a status. It prints `state=`, `inflight=`, and `status-age=`. `inflight` is `unknown` when no fresh status showed the word just written. The relay reads tokens only at start and on `SIGHUP`. This write does not signal it. The state word is read from the file.

`hold` is longer than one direct call may last. It runs as a tracked job. Write the script the tool printed, verbatim, to the temporary directory. Its first line is exactly `set -eu`. Run `start` with `--purpose twenty-relay-hold`, `--limit 200`, `--token` the token the latest inspection read, `--script` that file, and no operands. The install and the word are already in the script. Send the `argv` that start prints, unchanged. Then the job question.

`send` returns at once. It may be one direct call. Send the state command's `argv` unchanged as one `vm.command.run`. It is not a job.

The hold counts only when the job's class is `succeeded` and the text after `]: ` includes `state=hold` and `inflight=0`. `inflight=unknown`, or any other count, is not settled. Do not send the job again. The file may already say `hold`. A hold is often still running after six polls, because the wait is up to 130 seconds and each poll waits at most 10 seconds. Report the state the last poll that was read showed, with the unit name, the invocation ID and the limit. Do not call it settled. Do not start another job. The second-run questions adopt it once it has finished.

The send counts when the call came back and the output includes `state=send`. `inflight` may be `unknown`. Send does not wait for zero.

A restore target's relay stays held until this job writes `send`. Job 1 does not write `send`. Job 4 does not write `conf/state`.

The way back for `send` is `hold`, named and not sent in this run. The way back for `hold` is `send`, named and not sent in this run.

#### One upstream token

The relay reads each token at start and on `SIGHUP`, and a transaction keeps the snapshot it began with. Replacing a token writes the file and then signals the container.

Before the helper, the login read has printed `relay-upstream-known:<name>`. When it has not, refuse by name. `upstreams.json` lacks that upstream. Write nothing. The helper is not given.

The helper is this text and no other. Give it to the person. They run it as root with `bash` on the machine, from their own Oracle Cloud Shell session, the same route as the login helper. It is not sent through the router. It needs a terminal, and the token must not be an operand. It prompts for that one `RELAY_TOKEN_<NAME>` from `/dev/tty`, refuses an empty value or one with whitespace, writes the bytes with no trailing newline, mode `0640`, owner `0:1000`, by rename, then runs `docker kill --signal=HUP -- <install>-relay`, and prints `saved:<key>:length:<n>`. `<NAME>` is the upstream name with every letter turned to upper case and every `-` turned to `_`. The token appears only in that terminal.

```
set -eu
export LC_ALL=C
install=$1
name=$2
die() { printf '%s\n' "$1" >&2; exit 1; }
case "$install" in *[!a-z0-9]*|""|caddy) die "invalid install";; esac
n=${#install}
[ "$n" -ge 2 ] && [ "$n" -le 13 ] || die "invalid install"
case $(printf '%.1s' "$install") in [a-z]);; *) die "invalid install";; esac
case "$name" in ""|*[!a-z0-9-]*) die "invalid upstream";; esac
wn=${#name}
[ "$wn" -ge 1 ] && [ "$wn" -le 16 ] || die "invalid upstream"
case $(printf '%.1s' "$name") in [a-z]);; *) die "invalid upstream";; esac
sec=/opt/$install/relay/secrets
[ -d "$sec" ] || die "no secrets directory"
[ -c /dev/tty ] || die "no terminal"
key=$(printf '%s' "$name" | tr 'a-z-' 'A-Z_')
key=RELAY_TOKEN_$key
read -rsp "Type ${key}, then Enter (hidden): " v </dev/tty || true
printf '\n' >/dev/tty
case "$v" in ''|*[[:space:]]*) printf '%s\n' "refused:$key:empty-or-whitespace"; exit 1 ;; esac
n=${#v}
lockwait=${TWENTY_RELAY_LOCK_WAIT:-30}
lock=/opt/$install/relay/.helper.lock
exec 9>"$lock"
flock -w "$lockwait" 9 || die "another helper is running"
t=$(mktemp "$sec/.token.XXXXXX")
trap 'rm -f -- "$t"' EXIT
printf '%s' "$v" > "$t"
chmod 640 "$t"
chown 0:1000 "$t"
mv -T -- "$t" "$sec/$name.token"
trap - EXIT
unset v
if ! docker kill --signal=HUP -- "${install}-relay"; then
  printf '%s\n' "saved:$key:length:$n"
  printf '%s\n' "the token file is in place; the relay reads it at its next start or SIGHUP" >&2
  exit 3
fi
printf '%s\n' "saved:$key:length:$n"
```

Exit 3 means the token file is in place and the relay reads it at its next start or `SIGHUP`. Do not claim `status=loaded` on that exit.

The read-back is one direct call after the person has run the helper. `argv` is `/bin/sh`, `-c`, the script, `sh`, the install name, and the upstream name. The person is told it is a read. It prints the token file's mode, owner and byte count, and the relay's latest `config hash=` line. It prints no token.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
name=$2
fail() { printf '%s\n' "relay-token:fail:$1"; exit 1; }
case "$install" in *[!a-z0-9]*|""|caddy) fail install;; esac
n=${#install}
[ "$n" -ge 2 ] && [ "$n" -le 13 ] || fail install
case $(printf '%.1s' "$install") in [a-z]);; *) fail install;; esac
case "$name" in ""|*[!a-z0-9-]*) fail name;; esac
wn=${#name}
[ "$wn" -ge 1 ] && [ "$wn" -le 16 ] || fail name
case $(printf '%.1s' "$name") in [a-z]);; *) fail name;; esac
f=/opt/$install/relay/secrets/$name.token
if [ ! -f "$f" ]; then
  printf '%s\n' "relay-token:absent:$name"
  printf '%s\n' "relay-reload:absent"
  exit 1
fi
st=$(stat -c '%a %u:%g %s' -- "$f")
printf '%s\n' "relay-token:$name:$st"
logs=$(docker logs --tail 400 -- "${install}-relay" 2>&1 || true)
line=$(printf '%s\n' "$logs" | awk '/config hash=/ { kept = $0 } END { if (kept != "") print kept }')
if [ -n "$line" ]; then
  printf '%s\n' "relay-reload:$line"
else
  printf '%s\n' "relay-reload:absent"
fi
printf '%s\n' "relay-token:reload:ok"
```

It counts when the call came back, a line `relay-token:<name>:640 0:1000 <bytes>` has a byte count of at least 1 equal to the helper's `length:`, and the last `relay-reload:` line contains `status=loaded`. The way back needs a token the vendor reissues. This run does not put the old bytes back.

#### One upstream

One direct call appends or removes one row of `upstreams.json`, by rename, the same object the relay-files job writes: `name`, host `smtp.mx.cloudflare.net`, port `465`, user `api_token`, and `token_file` `/secrets/<name>.token`. The file is mode `0640`, owner `0:1000`, with no trailing newline. The call does not signal the relay. On an add, the token helper follows, and that helper's signal reloads upstreams and tokens. Then the token read-back.

`argv` is `/bin/sh`, `-c`, the script, `sh`, the install name, `add` or `remove`, and the upstream name.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
action=$2
name=$3
fail() { printf '%s\n' "relay-upstream:fail:$1"; exit 1; }
case "$install" in *[!a-z0-9]*|""|caddy) fail install;; esac
n=${#install}
[ "$n" -ge 2 ] && [ "$n" -le 13 ] || fail install
case $(printf '%.1s' "$install") in [a-z]);; *) fail install;; esac
case "$action" in add|remove) ;; *) fail action;; esac
case "$name" in ""|*[!a-z0-9-]*) fail name;; esac
wn=${#name}
[ "$wn" -ge 1 ] && [ "$wn" -le 16 ] || fail name
case $(printf '%.1s' "$name") in [a-z]);; *) fail name;; esac
base=/opt/$install/relay
conf=$base/conf
dest=$conf/upstreams.json
logins=$conf/logins.json
[ -f "$dest" ] || fail no-upstreams
[ -d "$base/secrets" ] || fail no-secrets
tmp=$(mktemp "$conf/.upstreams.XXXXXX")
rc=0
python3 - "$dest" "$logins" "$tmp" "$action" "$name" <<'PY' || rc=$?
import json, sys
dest, logins, tmp, action, name = sys.argv[1:6]
def load(path):
    try:
        with open(path, encoding='utf-8') as handle:
            return json.load(handle)
    except FileNotFoundError:
        return []
    except ValueError:
        sys.stderr.write('json\n')
        sys.exit(2)
rows = load(dest)
if not isinstance(rows, list):
    sys.stderr.write('not-list\n')
    sys.exit(2)
if action == 'remove':
    bound = load(logins)
    if not isinstance(bound, list):
        bound = []
    if any(isinstance(row, dict) and row.get('upstream') == name for row in bound):
        sys.stderr.write('named\n')
        sys.exit(4)
    kept = [row for row in rows if not (isinstance(row, dict) and row.get('name') == name)]
    if len(kept) == len(rows):
        sys.stderr.write('absent\n')
        sys.exit(5)
    rows = kept
else:
    if any(isinstance(row, dict) and row.get('name') == name for row in rows):
        sys.stderr.write('present\n')
        sys.exit(3)
    rows.append({
        'name': name,
        'host': 'smtp.mx.cloudflare.net',
        'port': 465,
        'user': 'api_token',
        'token_file': '/secrets/' + name + '.token'
    })
text = json.dumps(rows, separators=(',', ':'))
with open(tmp, 'w', encoding='utf-8') as handle:
    handle.write(text)
PY
if [ "$rc" -ne 0 ]; then
  rm -f -- "$tmp"
  if [ "$rc" -eq 3 ]; then fail present; fi
  if [ "$rc" -eq 4 ]; then fail named; fi
  if [ "$rc" -eq 5 ]; then fail absent; fi
  fail write
fi
chmod 640 "$tmp"
chown 0:1000 "$tmp"
mv -T -- "$tmp" "$dest"
if [ "$action" = add ]; then
  printf '%s\n' "relay-upstream:$name:smtp.mx.cloudflare.net:465:api_token:/secrets/$name.token"
fi
printf '%s\n' "relay-upstream:$action:ok"
```

Before an add, refuse by name when `relay-upstream-known:<name>` was printed. Write nothing. The add counts when the call came back and the output includes `relay-upstream:<name>:smtp.mx.cloudflare.net:465:api_token:/secrets/<name>.token` and `relay-upstream:add:ok`. The upstream is configured only when the token read-back then counts.

Removing an upstream is refused while a login names it. Before the call, refuse by name when a `relay-login:` line carries that upstream. Send nothing. The script also refuses: it prints `relay-upstream:fail:named` and writes nothing, and the token file stays. The remove counts when the call came back, the output includes `relay-upstream:remove:ok`, and a login read after it has no login on that upstream and no `relay-upstream-known:` line for that name. The token file is left in place.

The way back for an add is a remove, only when no login names the upstream, named and not sent in this run. The way back for a remove is an add of the same name, named and not sent in this run, then a token.

#### The relay in the report

One direct call of the report script on every run whose relay directory is present, on every Job 1 run where `<relay>` was named, on every Job 5 run, and after Job 3's removal. `argv` is `/bin/sh`, `-c`, the script, `sh`, the install name, and the offset. The offset is the `relay-journal:end:` number the last report of this install recorded, or `0` when none was recorded. The person is told it is a read. The call writes nothing, including `conf/state`. On Job 1 it follows `outbound:ok`, or the resting state on a restore.

`<script>` is this text and no other:

```
set -eu
export LC_ALL=C
install=$1
from=$2
fail() { printf '%s\n' "relay-report:fail:$1"; exit 1; }
case "$install" in *[!a-z0-9]*|""|caddy) fail install;; esac
n=${#install}
[ "$n" -ge 2 ] && [ "$n" -le 13 ] || fail install
case $(printf '%.1s' "$install") in [a-z]);; *) fail install;; esac
case "$from" in ""|*[!0-9]*) fail offset;; esac
base=/opt/$install/relay
if [ ! -d "$base" ]; then
  printf '%s\n' "relay-report:state:absent"
  printf '%s\n' "relay-report:logins:none"
  printf '%s\n' "relay-report:upstreams:none"
  printf '%s\n' "relay-ambiguous:0"
  printf '%s\n' "relay-journal:end:0"
  printf '%s\n' "relay-report:ok"
  exit 0
fi
rep=$(mktemp)
trap 'rm -f -- "$rep"' EXIT
python3 - "$base" "$from" > "$rep" <<'PY'
import json, os, sys
base, from_text = sys.argv[1], sys.argv[2]
start = int(from_text)
conf = os.path.join(base, 'conf')
state_path = os.path.join(conf, 'state')
try:
    word = open(state_path, 'rb').read()
except OSError:
    word = b''
if word == b'send':
    state = 'send'
else:
    state = 'hold'
sys.stdout.write('relay-report:state:%s\n' % state)
try:
    rows = json.load(open(os.path.join(conf, 'logins.json'), encoding='utf-8'))
except (OSError, ValueError):
    rows = []
wrote = False
if isinstance(rows, list):
    for row in rows:
        if not isinstance(row, dict):
            continue
        login = row.get('login')
        domain = row.get('domain')
        upstream = row.get('upstream')
        if not all(isinstance(value, str) and value and all(ch not in value for ch in ':\n\r') for value in (login, domain, upstream)):
            sys.stderr.write('row\n')
            sys.exit(1)
        sys.stdout.write('relay-report:login:%s:%s:%s\n' % (login, domain, upstream))
        wrote = True
if not wrote:
    sys.stdout.write('relay-report:logins:none\n')
try:
    ups = json.load(open(os.path.join(conf, 'upstreams.json'), encoding='utf-8'))
except (OSError, ValueError):
    ups = []
named = False
if isinstance(ups, list):
    for row in ups:
        if isinstance(row, dict) and isinstance(row.get('name'), str):
            sys.stdout.write('relay-upstream-name:%s\n' % row['name'])
            named = True
if not named:
    sys.stdout.write('relay-report:upstreams:none\n')
def count_from(path, lo):
    try:
        data = open(path, 'rb').read()
    except OSError:
        return None, 0
    if lo > len(data):
        return None, len(data)
    text = data[lo:].decode('utf-8', 'replace')
    n = sum(1 for line in text.splitlines() if 'outcome=ambiguous' in line)
    return n, len(data)
journal = os.path.join(base, 'journal', 'journal')
previous = os.path.join(base, 'journal', 'journal.1')
found, size = count_from(journal, start)
if found is None:
    old, _old_size = count_from(previous, start)
    if old is None:
        old, _old_size = count_from(previous, 0)
        sys.stdout.write('relay-journal:offset-reset\n')
    fresh, size = count_from(journal, 0)
    found = (old or 0) + (fresh or 0)
sys.stdout.write('relay-ambiguous:%d\n' % found)
sys.stdout.write('relay-journal:end:%d\n' % size)
PY
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    relay-upstream-name:*)
      name=${line#relay-upstream-name:}
      case "$name" in ""|*[!a-z0-9-]*) printf '%s\n' "relay-report:upstream:$name:not-configured"; continue;; esac
      f=$base/secrets/$name.token
      if [ ! -f "$f" ]; then
        printf '%s\n' "relay-report:upstream:$name:not-configured"
      else
        st=$(stat -c '%a %u:%g %s' -- "$f")
        set -- $st
        if [ "$1" = 640 ] && [ "$2" = 0:1000 ] && [ "$3" -ge 1 ]; then
          printf '%s\n' "relay-report:upstream:$name:configured"
        else
          printf '%s\n' "relay-report:upstream:$name:not-configured"
        fi
      fi
      ;;
    *)
      printf '%s\n' "$line"
      ;;
  esac
done < "$rep"
rm -f -- "$rep"
trap - EXIT
printf '%s\n' "relay-report:ok"
```

Copy `relay-report:state:`, each `relay-report:login:`, each `relay-report:upstream:`, `relay-ambiguous:`, and `relay-journal:end:`. `relay-report:state:` is `send`, `hold`, or `absent`. `absent` means the relay is not installed. A login line is that login's name, domain and upstream, with no secret. An upstream line is `configured` or `not-configured`. Configured means the token file is a regular file, mode `640`, owner `0:1000`, and at least one byte. `relay-ambiguous:` is the count of `ambiguous` outcomes in the relay's journal since the offset. `relay-journal:end:` is the offset the next report uses. `relay-journal:offset-reset` means the saved offset did not fall inside the current journal, so the count includes what `journal.1` still holds plus the current file. That count can repeat a line. It does not hide one. The report prints no token, no salt, and no hash from this call.

On Job 3, `relay-report:state:absent`, no service `relay` in the project section, and `dir-absent` together say the relay is gone.
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

### Where did a stopped removal stop?

Ask when a Job 3 removal job did not count. Ask it after the job question. Do not ask it when the removal counted. Judge from a fresh identity read, the identity-read script, never from the progress markers alone. A deletion can finish before its marker prints. The read is one `vm.command.run`, and the person is told it is a read. A container list, a volume list, or a project-network list counts only when the read's exit for it is 0 and every label in it equals the install. An empty list is an empty set, not a failed read. A failed read matches none of the branches below. Take the first match.

- The directory and its marker are present, the marker holds the `compose-sha256` line, and at least one of the container list, the volume list, and the project-network list is non-empty. A new full plan, with the counts and the ids the fresh read gives. Any count may be 0. The job is not re-sent.
- The directory and its marker are present, and the container list, the volume list, and the project-network list are each empty. The partial branch. The job is not re-sent.
- The directory is present, its marker is absent, and the three lists are each empty. The removal stopped inside the directory's own removal, which removes the marker last before the directory. Stop. Send nothing. Tell the person to run `rmdir /opt/<install>` over the shell they hold. `rmdir` removes only an empty directory. When it refuses, the directory holds files this skill cannot identify, and they are the person's.
- Anything else. Stop. Report what the fresh read showed. Send nothing.

Each continuation is a new plan, gated again. The job is never re-sent.

### What did a direct call answer?

This question is for a `vm.command.run` that is not a job start, poll, read-back, journal, or release. Send the planned call once. The approval question applies. Do not repeat a change call on a failure or an unclear answer. Do not send the way back because a call failed. The first-contact call has its own outcomes, and those win where they differ.

- `outcome` is `ok`, `truncated`, or `remote_failure`, and the answer names this identifier in `machine`. The call came back. Read it the way the question that sent it says. Re-inspect when that question says to.
- `outcome` is `timeout`, `killed`, or `request_timeout`, or `status` is `vendor_error` or `uncertain`, or a failure outcome carries no `machine`. The outcome is unknown until the re-inspection. Say that. Re-inspect. Do not repeat the call.
- `outcome` is `busy`. The machine was not asked. Re-inspect. Do not repeat the call.
- `outcome` is `unknown_machine`. Do not repeat the call. Read `vm.inventory.list_hosts` once. Absent: it left the map, point to `skills/Prepare VM/`. Still listed: name the contradiction. Change nothing further.
- `status` is `needs_connect`, `denied`, `invalid_arguments`, or another gateway status other than `needs_confirmation` and other than `uncertain`. The call did not run as a router result. Hand the status to `skills/Connection Troubleshooter/` in `wiser`. On `needs_connect`, the module is `command` unless the answer names one. Re-inspect only when the module that reads the state is connected. Otherwise say the re-inspection could not be made. Do not claim `changed` or `unchanged`. Do not repeat the call.
- Any other answer. Name it verbatim. Re-inspect when a read of the state is still possible. Do not repeat the call.

### What did the re-inspection show?

After a job, re-inspect when the job question says to. After the base route, after Job 2's last change, after either of Job 3's removal jobs, after Job 4's last route change, or after Job 5's last change call, inspect again with the same inspection script. The approval question applies, and the person is told it is a read. A job that exited 0 is not yet `changed`.

Job 1's requested state: the four containers match the start checks, the app route and the base route are present and are exactly the generated object, `workspace:ok` was printed or the password file is absent after a call whose outcome was unknown, and both outside checks returned `200` over verified TLS. A `-k` answer is served and not verified, and it is not this state.

Job 2 add's requested state: the new route is present and is exactly the generated object, and the aliases line contains the new alias. Job 2 remove's requested state: that route is absent from the live config and from the saved config, and the aliases line does not contain that alias.

Job 3's full removal requested state is the one its question states, including no service `relay` and `dir-absent`. Job 3's partial branch requested state is the directory absent, which takes the relay's files with it, and no service `relay`. Job 4 offline's requested state is the one its question states. Job 4 online's requested state is the one its question states. Job 5's requested state is the counting rule in that job. A hold whose `inflight` is `unknown`, or any count other than `0`, does not hold.

- The re-inspection is incomplete, `truncated`, absent, or not a state. Do not claim `changed` or `unchanged`. Report failed, with the change call's outcome and the re-inspection's outcome. Do not repeat the change.
- The requested state holds, and it did not hold in the before-state. `changed`.
- The requested state held before any change call. `unchanged`.
- The requested state does not hold. Failed. Name what the re-inspection shows. Do not repeat the change.

### What does the report say?

One report. For each part: what was inspected, what was planned, the gate's verdict or that no gate was taken, each call's action and its `outcome`, any `exit_code`, the output copied verbatim where the report shows it, the re-inspection, and `changed`, `unchanged`, or failed. A line that contains `PG_DATABASE_PASSWORD=`, `ENCRYPTION_KEY=`, `CLOUDFLARE_API_KEY=`, `EMAIL_SMTP_PASSWORD=`, `RESEND_API_KEY=`, `RESEND_WEBHOOK_SIGNING_SECRET=`, `STORAGE_S3_SECRET_ACCESS_KEY=`, `STORAGE_S3_ACCESS_KEY_ID=`, or `ADMIN_PASSWORD=` is withheld, and the report says the line was withheld. A secret value is not a report line. Lengths, booleans, counts and statuses are.

The URL is `https://<base>/` and `https://app.<base>/`. The report says whether each `/healthz` answered and whether the certificate verified. It names the image digests. It does not name the source address as a field. When `<relay>` is present, it names each upstream by name, the relay state `hold`, and that the relay service is in the override. It does not name a token. On an install that is not a restore, it names each token file's byte count, mode and owner from the token length read, the `relay-container:` line, the six relay-check markers, and `outbound:ok`. It says Job 1 left `conf/state` at `hold` and did not release it. Releasing the hold is Job 5. A Job 1 run does not send it. On an install for a restore, it says this run wrote no token file, because the restore brings the tokens, and that the helper did not prompt for them.

The report says what is configured and what is not. Team email is the install's one address over SMTP, to members, not to contacts. Email to contacts is each person's own mailbox, left enabled for IMAP, SMTP and CalDAV, and not configured. A connected mailbox sends as itself: a member's own mailbox, or an organisation's shared mailbox through the relay, signed by the organisation's own domain at Cloudflare. Twenty's emailing-domain route is separate. This skill sets that route up only when the driver is `RESEND`. Campaigns need it, and they need the feature flag `IS_MESSAGE_CAMPAIGN_ENABLED`, which this skill does not set. Branded or campaign email is the driver that was set, Resend or LOG. When the driver is `RESEND`, the inbound email domain is set to `<inbound_domain>`. When the driver is `LOG`, no inbound email domain is set. Job 4 offline reports that the routes were removed and the data was kept, and copies this install's route objects from the before-state verbatim, since bringing it back online posts exactly those. Job 3 copies this install's route objects from its before-state once a route delete was sent. Job 4 online reports that the recorded routes were posted again, and which were already present. Google and Microsoft stay off. Email verification stays off. When the driver is `LOG`, the webhook signing secret stays unset, so signatures on `/webhooks/messaging/resend` are not verified. When the driver is `RESEND`, the signing secret is set through the helper and first contact has probed the route. `RESEND_DOMAIN_REGION` stays unset either way, so Resend provisions a new emailing domain in its default region. When `<cloudflare_saas>` is `none`, no workspace can take its own domain. When it is set, the report says the Custom Hostnames setting and the fallback origin are the person's, and that a DNS-only CNAME inside that zone to the fallback origin is served directly by Caddy, with Caddy's certificate, and Cloudflare carries none of that name's traffic.

When the driver is `RESEND`, the report names, in plain words, the person's steps with Resend. Receiving is enabled on `<inbound_domain>`. Its MX record is a DNS item through `experts/IT Expert/` and `skills/Zone Publisher/` in `wiser`, and it is the MX record with the lowest priority number for that name. A webhook points at `https://<base>/webhooks/messaging/resend` with the events `email.received`, `email.delivered`, `email.failed`, `email.bounced`, and `email.complained`. That webhook's signing secret is typed through `set-secrets`. The report names IT Expert Rule 5's question and does not answer it. The question covers:

- a public, unauthenticated route that only a signature guards;
- the secret held in `.env`, overridable from the admin panel;
- replay inside the 5-minute window. Twenty dedupes a received email by its email id and a delivery event by its `svix-id`, each as the queue's job id (`resend-webhook-driver.service.ts`);
- what a forged or replayed `email.received` could do. It names an email id that Twenty then fetches from Resend with the install's own key, so a forger cannot inject content without a real received email in that Resend account.

It names the cost: Resend's receiving price is not stated on its documentation pages, so the operator confirms it at Resend before enabling receiving.

The report says no real contact goes onto the install until a backup has been restored with the same encryption key, which `skills/Back Up Twenty/` does. It says that a setting saved in Twenty's admin panel is stored in the install's database and overrides `.env` for every variable Twenty does not mark env-only, storage and email included, so this install's settings are changed in `.env`, not in the admin panel. For an install for a restore, it reports the resting state and its two continuations. It names every gap that applies: a release other than v2.45.6, a machine without Docker or without Caddy in the shape `skills/Deploy Workload/` runs it, Google and Microsoft mailboxes, the Cloudflare for SaaS setting when it was not confirmed, creating the bucket, the tokens and the sending accounts, the inbound domain's MX record and the sending service's receiving and webhook settings, which the person sets with the vendor, changing an existing install's emailing-domain driver, and sending through the relay from an organisation whose Cloudflare account is not on Workers Paid. It names the hand-off for DNS, for a package, for workspace setup beyond the first workspace, and for a security review.

For each job, also: its unit name, its invocation ID and its limit, the last poll's state, the read-back lines the report may show and the line count shown, and the release outcome. A job not read as finished after six polls is reported in the state the last poll that was read showed, or as unknown when none was read.

## Pitfalls

- **A glob written `/*/` in a script this skill sends.** A script carrying `/*` or `*/` can come back `vendor_error` HTTP 400 before it reaches the machine, because something on the connector's path reads that pair as a database-comment attack. Do not put that pair in a script. Do not read a repeated `vendor_error` on an unchanged script as the machine's answer. `uncertain` is not that measurement. It does not establish whether the call ran.
- **The request is ambiguous.** More than one machine, more than one install, an install and a removal together, an offline change together with a removal or a new install, or a route change that does not name the install. Ask before any call.
- **A machine that is not on the map, or whose health is not `ok`.** Stop. Not on the map: point to `skills/Prepare VM/`. Not reachable: name the outcome the way `skills/VM Inventory/` does. Change nothing.
- **The router host.** Stop before any change. Name the gap `skills/Deploy Workload/` declares for a workload on the router host, where Caddy has not been measured beside the router's own public origin.
- **No Docker, or a Caddy that is not the shape `skills/Deploy Workload/` runs.** Stop. Name the gap for a machine with no Docker, or with no Caddy running in the shape `skills/Deploy Workload/` runs it. Do not install Docker and do not start Caddy.
- **A failure with no `machine`, called unreachable or called a finished install.** It does not establish whether the router reached the machine. On a read of health, not determined, and stop. On a change, the outcome is unknown until the re-inspection.
- **`vendor_error` treated as the machine's answer.** It does not establish whether the call ran.
- **`busy` treated as a down machine.** The machine was not asked. Do not repeat the change.
- **A value that fails its pattern, sent anyway.** Ask. Never send the other form. The install name, the hostnames, the aliases, and every secret stay out of the script text. Secrets are not operands either.
- **A secret in an `argv`, a journal line, or the report.** Withhold the line. The helper prints a length. The checks print a length, a boolean, a count, or a status.
- **A Deploy Workload workload given one of this install's alias names.** The aliases carry the install name and a hyphen as a prefix so they are not free workload names. A workload must not take one of them. Job 1 refuses an install name whose prefix a route already carries. Job 1 and Job 2 also ask who answers to this install's aliases, and refuse a name another container, running or stopped, already answers to. `caddy` is not an install name and not an alias.
- **A whole-config write.** This skill does not POST to `/config/`. A route POST, and its one retry after a `412`, carry `If-Match` set to the `Etag` from the same `GET /config/` whose body passed the shape check, not the routes path's `Etag`. A `412` means the config changed anywhere. Whenever the shape is checked, the config's top-level keys are exactly `apps`, `apps` holds exactly `http`, `http` holds exactly `servers`, and `servers` has exactly one key, `workloads`. Anything else stops the run. Every route is exactly the generated object. Any other route stops the run.
- **A route added before the workspace exists.** The first-contact call creates the server admin and the first workspace on the install's Docker network before it posts a route. A failure before `workspace:ok` has posted nothing. Do not post either route in an earlier call. Do not remove the app route to recover. Removing the install is Job 3.
- **A route, a container, or a volume removed that is not this install's.** Job 3 matches the marker, the project label, the full container id, each full project-network id, the volume name and its `CreatedAt`, and the directory's device and inode. A name alone is not ownership. A project network with a container attached that is neither this install's nor Caddy is not removed. The removal order is containers, then volumes, then project networks, then the directory, its marker last. A stopped removal is not re-sent. A fresh identity read chooses the continuation. `docker compose down` is not sent. Images stay. `caddy-config` and `caddy-data` stay.
- **A partial install left with secrets and no way back.** The install job writes the marker before any download or secret. A stop after the install job and before the start job is Job 3's partial branch: the directory alone, after the person names the install. The partial job checks the marker lines `skill=deploy-twenty`, `release=v2.45.6`, and `project=` with the install name, checks that `realpath` is `/opt/<install>`, that the path is a directory, that the device and inode match the inspection, and that no mount is on or under it, then removes every entry but `INSTALL` with `rm -rf --one-file-system`, then `INSTALL`, then the empty directory with `rmdir`. It does not change a route, an image, a network, or a volume, and it does not read Caddy. A container, a volume, or a project network read while the marker lacks `compose-sha256`, or an absent marker, stops the run. Name what was read. Change nothing.
- **Caddy's saved config not read back before the data is deleted.** After the route deletes, the live config and the saved config have to equal the before-state with only this install's routes removed. A difference stops the run before the removal job.
- **A second job started while one is loaded.** The second-run questions. A running job stops the run. A finished one is released and the run starts over from its inspection, once.
- **A start sent again after `token-changed`, with no new inspection and no new gate.** Nothing was started. Inspect again and gate again before any start.
- **A job's exit 0 reported as the URL answering.** The re-inspection and the outside checks decide. A stuck job is not released.
- **The install's address read as an organisation's sender.** Team email is one address for the whole install, to members. A contact is written from the sender's own mailbox. A campaign is sent from the organisation's own verified domain.
- **The base hostname read as behind Cloudflare.** A DNS-only CNAME inside the SaaS zone to the fallback origin is flattened to the machine, served by Caddy, and Cloudflare carries none of its traffic.
- **Real contacts placed before a restore.** The encryption key lives only in `.env` until a backup holds it, which is `skills/Back Up Twenty/`. No real contact goes on the install until a backup has been restored with the same key.
- **A relay job sent when `<relay>` is absent.** The run is the install without a relay. No fourth pull operand, no relay directory, and no relay service.
- **A relay writer re-sent alone after an uncertain call.** That file is sent again from its first writer, under a new plan, once the earlier call has ended. A later chunk is not sent while an earlier one is in doubt.
- **The relay-service job starting a container.** It edits the override and reads it back. It does not run `up`. The start job is what starts containers. The start job's checks do not read the relay container, so a relay the start job brought up is not yet a counted relay.
- **`OUTBOUND_HTTP_SAFE_MODE_ENABLED` written into the override.** The relay-service job sets `OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS` to `smtp-relay` on the server and the worker. It does not set safe mode. A file that already contains either name is left unedited.
- **The relay published on a port, or attached to the proxy network.** The service has no `ports`. Its only network is the project default, with the alias `smtp-relay`.
- **The relay npm container left on the machine.** `docker run` carries `--rm`, and the trap runs `docker rm -f` on `<install>-relay-npm` on every exit, a failed `npm ci` and a timeout included.
- **A group-writable `node_modules`, or an `smtp-server` other than `3.19.17`.** After `npm ci` the tree is `chown -R 0:1000` and `chmod -R g-w,o-rwx`. Any other version does not count.
- **The token-helper edit sent when `<relay>` is absent, or on a restore.** The install job's helper and `secrets.list` stay the bytes that job wrote. A restore does not prompt for the relay's tokens. The restore brings those files.
- **An upstream token written into `.env`, or printed.** The added prompts write `/opt/<install>/relay/secrets/<name>.token` only. The report prints the length, the mode and the owner.
- **The start script changed so that it reads the relay.** The start script stays the text this skill already sends. `docker compose up -d --wait` starts `relay`. The relay start read is the next call, and only when `<relay>` is present.
- **First contact sent before the relay checks and `outbound:ok`.** When `<relay>` is present those two calls follow the ports read and precede the first-contact writers. A line other than the passing markers stops the run. No route is added.
- **`conf/state` written `send` in Job 1.** The relay-files job writes `hold`. No later call in Job 1 writes `state`. Job 5 releases the hold. Job 1 does not send Job 5.
- **A second login for a domain already bound.** Refused by name before the helper is given. The helper writes nothing either.
- **A relay password or an upstream token through the router or the report.** The person types it on the machine. The read-back prints a domain, an upstream, an eight-character prefix, a length, a mode, or an owner.
- **`hold` sent as one direct call.** It waits up to 130 seconds. It is the tracked job `twenty-relay-hold`. `inflight=unknown` is not settled. The job is not sent again.
- **Job 4 releasing a hold.** The relay keeps running. Neither offline nor online writes `conf/state`. Bringing an install online never releases a hold.
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
- An install for a restore ran the pull, the install job, the person's helper and the length read, and nothing after them; it started no container and posted no route, and the report named its resting state and its two continuations. When `<relay>` was present it also ran the relay calls through the relay-service job, it did not edit the helper for tokens, and it did not run the token length read, the start read, the relay checks or the outbound check.
- The pull was one job, purpose `twenty-pull`, limit 1800, the digest references the operands, three when `<relay>` is absent and those three plus the node digest when `<relay>` is present, and a digest that did not match was not installed. The install job, purpose `twenty-install`, limit 300, created the directory, wrote the marker before any download or secret, appended `compose-sha256` after the compose hash matched, replaced `stage=created` with `stage=files-written`, and started nothing. When `<relay>` is present, the relay-files job, the writer calls, the relay-install job and the relay-service job counted, in that order, after the install job and before the helper, and the relay-service job did not start a container. When `<relay>` is present and this is not a restore, the token-helper edit counted before the person ran the helper, the token length read matched before the start job, the relay start read passed before the ports read, and the six relay checks and `outbound:ok` passed before a first-contact writer. `conf/state` was still `hold` at the report. When `<relay>` is absent, none of those calls ran, and the helper text was the install job's. The start job, purpose `twenty-start`, limit 1800, was not sent until the length read matched.
- The server published no port. The four containers matched the start checks before any route. When `<relay>` is present, the relay start read passed before the ports read, and the six relay checks and `outbound:ok` passed before a route. A failed check added no route.
- The first-contact call created the server admin and the first workspace before it posted a route, in one `vm.command.run`. No route was posted before `workspace:ok` and the password file was removed. The base route was a later call. An `uncertain` or `timeout` on that call was not retried, and no route was removed to recover. When the driver is `RESEND`, the call also printed `inbound-domain:ok` and `inbound-webhook:refused` before it posted a route, and a not-configured answer or a 404 stopped the call before a route. When the driver is `LOG`, the call's output had no `inbound-domain:` line and no `inbound-webhook:` line.
- When the driver is `RESEND`, the install job wrote `INBOUND_EMAIL_DOMAIN` and mapped `RESEND_WEBHOOK_SIGNING_SECRET`, and the report named the person's Resend steps, IT Expert Rule 5's question without answering it, and the receiving price. When the driver is `LOG`, the install job wrote no inbound domain and mapped no signing secret.
- Job 2 added an alias by reattaching the full list and then posting the route, or removed the route, confirmed the saved config, and then removed the alias. A half-finished pair was reported and not repaired in the same run.
- Job 3's full removal ran only after the person confirmed by naming the install, and the report says the removal destroys every organisation's data on the install. It deleted only objects whose identity was read back, routes first, and it read Caddy's live and saved config back to the before-state with those routes removed, before it deleted data. The removal order was containers, volumes, project networks, and the directory. A container count, a volume count, or a network count of 0 was accepted when that set was empty. `<install>_default` was removed with `<install>-proxy`, and only when no container but this install's and Caddy was attached. Images stayed. Job 3's partial branch ran only after the person confirmed by naming the install. It removed the directory alone when the marker held `skill=deploy-twenty`, `release=v2.45.6`, and the project line, with or without `compose-sha256`, and the inspection showed the directory and its marker alone, with no container, no volume, and no project network. The job required the path `/opt/<install>`, a directory, the inspection's device and inode, and no mount on or under the directory. The re-inspection showed the directory absent. A project container, volume, or network with no `compose-sha256` line, or an absent marker, was named and left unchanged. A stopped removal was not re-sent. Its continuation was a new plan from a fresh identity read.
- Job 5 ran one action on a complete install this skill made, after the person confirmed by naming the install and the action and after `experts/DevOps Expert/` gated the plan, except a report-only read, which wrote nothing and took no gate. A login change was the helper the person ran on the machine, then one login read. A token change was the helper the person ran on the machine, then one token read. An upstream add was one direct call, then that token helper and that read. `hold` was the tracked job `twenty-relay-hold`, limit 200. `send` was one direct call. `inflight=unknown` on a hold was not counted as settled. No password and no token was an operand, a router argument, or a report line. A restore target stayed `hold` until this job wrote `send`.
- Job 4 offline ran only after the person confirmed by naming the install and saying to take it offline. It removed only this install's routes and left every alias, container, network, volume, and file in place. The outside checks did not get a Twenty answer. Job 4 online ran only after the person confirmed by naming the install and saying to bring it online. It posted the route objects from the recorded before-state and no others.
- The report names each check's answer, both URLs, what is configured and what is not, the three kinds of email, the base name's direct path when the zone applies, the no-real-contact rule, and every gap that applies.
- Per job the report names the unit name, the invocation ID, the limit, the last poll's state, the read-back lines it may show, and the release outcome. A job was polled at most six times, each wait at most 10 seconds. A stuck job was not released.
- DNS was handed to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. A package was handed to `skills/VM Configure/`. Workspace setup beyond the first workspace was not invented.
