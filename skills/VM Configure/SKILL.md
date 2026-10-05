---
name: VM Configure
type: skill
category: operations
description: Change one apt package or one systemd unit, or one package and then one unit, on one machine a person's router maps, after inspecting that machine, and report whether it changed, through a router the person already runs
version: 0.1.0
gaps:
  - a router this plugin does not ship, which every change goes through
  - a package manager other than apt
  - a change that runs longer than the router's command limit, a whole-system upgrade included
  - repairing a package database left mid-change
  - a unit change that also stops, restarts or conflicts with another unit
  - enabling or disabling a unit
---

# VM Configure

## Context

Use when one package or one systemd unit on one existing machine should change, or one package and then one unit, and the machine is one a person's router maps. One run is one machine. The report says what was inspected, what was planned, what the gate said, what each call answered, and whether the machine changed.

Not for a configuration file. That is the gap `experts/DevOps Expert/` still declares. Writing one through `vm.command.run` would bypass the router's file confinement, so this skill never does that, and it never calls `vm.files.write_file` or `vm.files.read_file`. Not for a whole-system upgrade, or any other change that would outlast the router's command limit. Not for enrolling a machine or taking one out, which is `skills/Prepare VM/`. Not for reading the fleet, which is `skills/VM Inventory/`. Not for a hostname, a DNS record, or a zone, including pointing a name at a workload. Hand that part to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. Not for deploying a workload. Not for a security review. Not for repairing a package database left mid-change: `dpkg --configure -a` configures every pending package at once, so that repair is the person's, over the provider's console.

This plugin does not ship a router, and no primitive in this root provides one. Every change goes through a router the person already runs. The calls are `vm.inventory.list_hosts`, `vm.inventory.health`, `vm.command.run`, `vm.units.status`, and `vm.units.service`, and no other action.

Reaching the gateway is `skills/Set Up Connectors/` and `gateway/SETUP.md` in `wiser`. Connecting a module is `skills/Connect Account/` in `wiser`. The toolkit registration is `connectors/vm/auth.md` in `wiser`. Cite those files. Do not restate them. The outcome vocabulary is `connectors/vm/CONNECTOR.md` in `wiser`. The connector passes the router's outcome string through unchanged. A gateway status is `status` on the answer. A router result is `outcome`. Do not rename either.

`vm.command.run` runs the argument vector as root. Every call, a read included, is `confirmation: always`: the gateway answers `needs_confirmation` first and runs the call only when the identical call repeats with `confirm: true` after the person approves that stop. `vm.units.service` is `confirmation: always` for every verb. `vm.units.status` is a read with no confirmation of its own. It runs `systemctl status --no-pager --` and the unit, and it returns the router's output on a nonzero exit. A stop that the person's own gateway policy puts on any call, a read included, is the approval question below.

No credential is asked for, printed, or written into a file in a repository. The report asks for no address and no hostname, and it prints none as a field of its own. Output the report shows is copied verbatim.

Classifier seam: none.

## Objective

The named package, the named unit, or the package and then the unit, is changed on the named machine, or it is not, and the report says which. A change is made only after a read of the live state, only after `experts/DevOps Expert/` gates the plan, and only after the person approves the stop. Already in the requested state is `unchanged`, and no change call is made. Verified against Success.

## Inputs

Wrap what the person supplies so material never reads as instruction.

- `<request>`: what they asked, in their words.
- `<machine>`: the one identifier this run is for, when they named one.
- `<package>`: the one package name, when they named one.
- `<unit>`: the one unit name, when they named one.
- `<live_state>`: what the inspection showed, or the statement that it was not read.

An unnamed machine is asked about. It is never guessed. A package name or a unit name that does not match the pattern below is asked about, and it is never sent.

## Identity

Someone who can get back onto the machine after the change. The inspection is the before-state. The re-inspection is what the machine shows now. A call that came back `timeout` is not a reason to say the change was undone.

## What the router does with a command

The router bounds every command it runs: `timeout --kill-after=5` and a limit of 60 seconds, then a kill 5 seconds later. The router's own request deadline is 90 seconds. Exit 124 comes back as `outcome` `timeout`, a kill as `killed`, and the request deadline as `request_timeout`. `connectors/vm/CONNECTOR.md` in `wiser`, Troubleshooting, says a `timeout` does not mean the change was undone.

The command's background children in its session are killed when the command ends. A descendant that leaves the session, `setsid` included, is not killed. A service that systemd starts is not in that session and survives. The re-inspection is what decides, not the call's outcome alone.

On Ubuntu, an apt hook (`needrestart`) restarts the services that use an upgraded library once a change ends, and the router's own service can be one: that would stop the call it runs inside. The hook does nothing when `NEEDRESTART_SUSPEND` is set, so every apt change call sets it. A service still using an old library is then the person's to restart, as a unit request of its own.

`busy` means the router was at its concurrency limit and the machine was not asked. `vendor_error` does not establish whether the call ran. A failure outcome whose answer carries no `machine` does not establish whether the router reached the machine. `remote_failure` carries the command's `exit_code` and its `output` when the command ran.

`systemctl status` exits 0 for an active unit, 3 for an inactive or dead one, and 4 when no such unit exists. Exit 1 and exit 2 are systemd's other dead codes. Through `vm.units.status` a nonzero exit is `remote_failure` with that `exit_code` and the status text in `output`.

Call one action at a time. Do not start the next call until this call's answer is classified.

## Steps

Which job is this? Take the first match.

- The request asks to enroll a machine or to take one out. Hand that part to `skills/Prepare VM/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a hostname, a DNS record, or a zone. Hand that part to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks to read the fleet, or whether a machine is reachable, and names no package and no unit to change. Hand that part to `skills/VM Inventory/`. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a configuration file. Say that this skill does not change one, and that the gap `experts/DevOps Expert/` still declares is a configuration file. Do not send a command that writes a file. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a workload deployment or a security review. Say that this skill does not do that part. Ask this question again of what remains. When nothing remains, stop.
- The request asks for a whole-system upgrade, a `dist-upgrade`, a `full-upgrade`, or an upgrade of every package, or the person says the change would outlast the router's command limit. Stop. Name the gap for a change that runs longer than the router's command limit, a whole-system upgrade included. Send nothing.
- The request names more than one package, or more than one unit. Ask which one package, which one unit, or both, this run is for. Do not guess. Do not call.
- The request names one package and one unit. Job 3. The order is the package, then the unit. When the person states the unit must happen first, ask before proceeding. Do not call until they answer.
- The request names one package and no unit. Job 1.
- The request names one unit and no package. Job 2.
- The job cannot be read. Ask. Do not guess. Do not call.

### Which machine is this run for?

- The request names one identifier, or names the router host and no identifier. That is the machine. An identifier named more than once is one machine.
- The request names the router host and also an identifier. Ask which machine this run is for. Do not call.
- The request names more than one identifier, or names a fleet, or narrows the machines by anything other than one identifier or the router host. Ask which one machine this run is for. One run is one machine. Do not call.
- No machine can be read. Ask. Do not guess. Do not call.

The identifier has to match `^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$`, the `machine` pattern `connectors/vm/CONNECTOR.md` in `wiser` publishes. A name that does not match: ask for one that does. Do not send the other form.

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

- `self` is boolean true. Router host.
- `self` is any other value, or it is absent. Fleet member.

When the row is the router host and health was unreachable, that stop already said that connector access to the whole fleet depends on the router host. Do not say the fleet is down.

### Did a call stop for approval?

`vm.command.run` and `vm.units.service` stop on `needs_confirmation` before they run. Any other call stops there when the person's gateway policy asks to approve it. `skills/Connection Troubleshooter/` in `wiser` owns that stop: it shows the stop, and it repeats the identical call with `confirm: true` only after the person approves that stop, once.

Before handing over a package inspection or a package re-inspection, tell the person the call is a read. Before handing over a unit status that stopped, tell the person the call is a read.

- The stop is the call this step sent. Hand it over. Take the repeated call's answer as this call's answer.
- The stop is some other call. Do not confirm it. Stop. Name the difference. Change nothing further.
- The person declines a read that this run needed before any change call. Make no further call. Nothing was changed. Deliver the report of what was read before the decline.
- The person declines a change call. Make no further call. An earlier change in this run keeps the result its re-inspection gave it. Nothing changed after the decline. Deliver the report.

### Job 1. One package

Which operation is this?

- Install, or a word that only means install. Operation `install`.
- Remove, uninstall, or delete, and the person did not say purge. Operation `remove`. This skill removes. It does not purge.
- Upgrade, or bring the one installed package to its candidate. Operation `upgrade`.
- Purge. Say that this skill removes and does not purge. Ask whether remove is what they want. Do not send a purge. Wait for the answer, then ask this question again.
- Any other operation. Ask. Do not send it.

Does the package name match `^[a-z0-9][a-z0-9+.-]+$`?

- It matches. The name is an operand below. It is never written into the script text.
- It does not match. Ask for a name that matches. Do not send the other form.

What did the package inspection answer?

One `vm.command.run`, with `machine` set to the identifier and `argv` exactly:

```
/bin/sh
-c
<script>
sh
<package>
<operation>
```

`<operation>` is the word `install`, `remove`, or `upgrade`. `<script>` is this text and no other:

```
printf '%s\n' '--- os-release ---'
awk -F= '$1 == "ID" || $1 == "ID_LIKE" { print }' /etc/os-release
printf '%s\n' '--- dpkg-query ---'
dpkg-query -W -f 'Status: ${db:Status-Status}\nVersion: ${Version}\n' -- "$1"
printf '%s\n' "dpkg-query-exit:$?"
printf '%s\n' '--- apt-cache policy ---'
apt-cache policy -- "$1"
printf '%s\n' "apt-cache-exit:$?"
printf '%s\n' '--- dpkg audit ---'
dpkg --audit
printf '%s\n' "dpkg-audit-exit:$?"
printf '%s\n' '--- simulate ---'
case "$2" in
  install)
    env DEBIAN_FRONTEND=noninteractive apt-get install -s -y --no-remove -o 'Dpkg::Options::=--force-confdef' -o 'Dpkg::Options::=--force-confold' -- "$1"
    ;;
  remove)
    env DEBIAN_FRONTEND=noninteractive apt-get remove -s -y -o 'Dpkg::Options::=--force-confdef' -o 'Dpkg::Options::=--force-confold' -- "$1"
    ;;
  upgrade)
    env DEBIAN_FRONTEND=noninteractive apt-get install -s --only-upgrade -y --no-remove -o 'Dpkg::Options::=--force-confdef' -o 'Dpkg::Options::=--force-confold' -- "$1"
    ;;
  *)
    printf '%s\n' 'simulate-skipped'
    ;;
esac
printf '%s\n' "simulate-exit:$?"
printf '%s\n' '--- history ---'
tail -n 12 -- /var/log/apt/history.log
exit 0
```

The `-s` simulation is a read. It makes no install and no remove. There is no redirection, no `tee`, and no `sed -i`. The approval question applies, and the person is told this call is a read. Classify the answer after that.

- `status` is `needs_confirmation`. The approval question. Take the repeated call's answer and ask this question again.
- `outcome` is `ok`, or `outcome` is `remote_failure` and the answer names this identifier in `machine`, and `output` contains every marker from `--- os-release ---` through `--- history ---`, and `truncated` is not true. Use that output. Continue.
- `outcome` is `truncated`, or a marker is missing, or `output` is absent. The inspection is incomplete. Stop. Name the outcome. Change nothing.
- `outcome` is `timeout`, `killed`, `request_timeout`, `busy`, or `vendor_error`, or a failure outcome with no `machine`. Not a package state. Name it. On `busy`, the machine was not asked. On `vendor_error`, or on a failure with no `machine`, the answer does not establish whether the call ran. Stop. Change nothing. Do not repeat the inspection.
- Any other answer. Name the `outcome` or the `status` verbatim. Stop. Change nothing.

What is the distribution?

Read the `ID` and `ID_LIKE` lines. Strip one layer of matching quotes. Split `ID_LIKE` on whitespace.

- A token of `ID` or `ID_LIKE` is `debian` or `ubuntu`. Apt applies. Continue.
- The lines were read and no token is `debian` or `ubuntu`. Stop. Name the gap for a package manager other than apt, and copy the `ID` and `ID_LIKE` lines verbatim. Change nothing.
- No `ID` line. Stop. Say the distribution could not be read. Change nothing.

What did the inspection decide?

`dpkg --audit` is non-empty when the audit section has a character that is not whitespace. A held lock is output that says the lock could not be taken. The candidate is the `Candidate:` line of `apt-cache policy`. No candidate means that line is `(none)`, absent, or the policy says the package could not be located. The status is the `Status:` line of `dpkg-query`. No `Status:` line, or `dpkg-query-exit` other than 0, means the package is not in the database.

Take the first match.

- The audit section is non-empty. The package database is already mid-change. Stop. Copy the audit section verbatim, which names the pending packages. The repair is the person's, over the provider's console. Send nothing.
- The output says the lock could not be taken. Stop. Copy that output verbatim. A held lock means the inspection changed nothing. Change nothing.
- The status is `half-installed`, `half-configured`, `unpacked`, `triggers-pending`, or `triggers-awaited`. Stop. Copy the status verbatim. Do not send a change.
- The status and the policy's `Installed:` line disagree. Stop. Copy both verbatim. Change nothing.
- No candidate, and the operation is `install` or `upgrade`. Take the update question. Do not read a failed simulation as a different stop.
- A candidate exists and `simulate-exit` is not 0. Stop. Copy the simulate section verbatim. Change nothing. With `--no-remove`, an install or upgrade that would remove any package fails here.
- The simulation would install, upgrade, or remove a package whose name begins `linux-image`, `linux-headers`, `linux-modules`, or `linux-firmware`, or ends `-dkms`, or one named `dkms` or `initramfs-tools`, or would change more than ten packages in all. Those routinely outlast the router's command limit. Stop. Name the gap for a change that runs longer than that limit. Change nothing. This is a rule of thumb, not a measurement: a change the limit kills anyway shows in the re-inspection's audit.
- The simulation names a package other than this one under packages that will be removed. Stop. Name those packages. One run removes only the named package, and only when the operation is `remove` and the simulation removes no other. Change nothing.
- The operation is `upgrade` and the simulation names a package other than this one under packages that will be upgraded. Stop. Name those packages. Change nothing.
- The simulation names a path package, defined below, under packages that will be removed or upgraded, and that package is not the named package. Stop. Say that the change would cut the channel this call runs on. Change nothing.
- The operation is `install` and the status is `installed` and the installed version equals the candidate. `unchanged`. No change call. No gate.
- The operation is `install` and the status is `installed` and the candidate is newer. `unchanged`. No change call. No gate. Say the candidate, and that an upgrade is a separate request.
- The operation is `install` and the status is `not-installed`, `config-files`, or not in the database, and a candidate exists. The change is the install call below.
- The operation is `remove` and the status is `not-installed`, `config-files`, or not in the database. `unchanged`. No change call. No gate. `config-files` is already removed. This skill does not purge.
- The operation is `remove` and the status is `installed`. The change is the remove call below.
- The operation is `upgrade` and the status is not `installed`. Say it is not installed. No change call. No gate.
- The operation is `upgrade` and the status is `installed` and the installed version equals the candidate. `unchanged`. No change call. No gate.
- The operation is `upgrade` and the status is `installed` and the candidate is newer. The change is the upgrade call below.
- Anything else. Stop. Copy the status and the candidate verbatim. Do not send a change.

Would this package change cut the path?

Ask only when the inspection decided `unchanged` or a change call. When it said to take the update question, skip this question and the argv, and take the update question.

The path packages are `tailscale`, `openssh-server`, `openssh-sftp-server`, `python3` and any package whose name begins `python3.`, `coreutils`, and the host firewall's `iptables`, `iptables-persistent`, `netfilter-persistent`, `nftables`, and `ufw`, and any package the person says is their SSH server, their tailnet client, the python the router runs, or their firewall.

- The decided change is `unchanged`, or there is no change call. Continue. An install of a path package that is already installed is `unchanged`.
- The role is router host, and the person says the named package is, or carries, their router. Stop. A package's maintainer scripts restart its own service when it is upgraded or removed, which would stop the router mid-call. That change is the person's, over the provider's console. No change call. No gate. Ask before any change on the router host; no answer is a stop.
- The decided change would remove or upgrade a path package, or replace one. Replace means the status is `installed` and the install candidate differs from that installed version. Stop. Say that the change would cut the channel this call runs on, and that the machine may be left reachable only by the provider's console. That change is the person's, over the provider's console. No change call. No gate.
- The decided change is an install of a path package whose status is `not-installed`, `config-files`, or not in the database, and the simulation removes or upgrades no path package. It is an ordinary install. Continue.
- Any other package. Continue.

The change call is sent only when a change call was decided and the path question did not stop. It is `vm.command.run` with `machine` and this `argv`. The package is the last element, after `--`. For an install or an upgrade it is `<package>=<version>`, where `<version>` is the candidate the inspection read, so the call installs that version, or fails before unpacking anything when apt cannot select it. Apt resolves the other packages again when the call runs, so a package list refreshed since the inspection can change them; the plan says so, and the re-inspection's history section shows what the call did. When the decision was `unchanged` or a stop, do not send one. Then go to the gate question only when a change call remains.

Install:

```
env
DEBIAN_FRONTEND=noninteractive
NEEDRESTART_SUSPEND=1
apt-get
install
-y
--no-remove
-o
Dpkg::Options::=--force-confdef
-o
Dpkg::Options::=--force-confold
--
<package>=<version>
```

Remove:

```
env
DEBIAN_FRONTEND=noninteractive
NEEDRESTART_SUSPEND=1
apt-get
remove
-y
-o
Dpkg::Options::=--force-confdef
-o
Dpkg::Options::=--force-confold
--
<package>
```

Upgrade:

```
env
DEBIAN_FRONTEND=noninteractive
NEEDRESTART_SUSPEND=1
apt-get
install
--only-upgrade
-y
--no-remove
-o
Dpkg::Options::=--force-confdef
-o
Dpkg::Options::=--force-confold
--
<package>=<version>
```

Those options keep the machine's version of a changed configuration file, refuse any removal an install or upgrade would make, and keep the restart hook from running. Do not send `purge`, `--purge`, or `--autoremove`.

What about no candidate?

Ask only when the inspection decision said to take this question.

One `apt-get update`, and no other change in that plan. The argv is `env`, `DEBIAN_FRONTEND=noninteractive`, `apt-get`, `update`. It is a change call: the gate question, then the approval question. The way back named to the gate is that this skill does not restore the previous package lists. The before-state is the policy output just read.

- The update's re-inspection shows a candidate, and the package question now decides `unchanged`. Report `unchanged`. No further change call.
- The update's re-inspection shows a candidate, and a change call is now decided. That call is a new plan. Gate it again. Then the change question.
- The update's re-inspection still shows no candidate. Stop. Say so. Do not send the install or the upgrade.
- The update answered `timeout`, `killed`, `request_timeout`, `vendor_error`, or a failure with no `machine`. The outcome is unknown until the re-inspection. Do not repeat the update. The re-inspection's candidate, or its failure, is the result.
- The update's output says the lock could not be taken. The call changed nothing. Do not repeat it. Report the outcome, the `exit_code`, and the output.

### Job 2. One unit

Which verb is this?

- `start`, `stop`, `restart`, or `reload`. That verb.
- `enable` or `disable`. Say that this skill does not enable or disable a unit, and name that gap: a unit's install section can carry other units, the SSH server's included, with it at the next boot. Send nothing.
- Any other word, `mask`, `unmask`, and `daemon-reload` included. Say that this skill's unit changes are those four verbs. Do not send the other word.

Does the unit name match `^[A-Za-z0-9@._:][A-Za-z0-9@._:-]{0,119}\.(service|timer|socket|target|path|mount)$`?

- It matches. Send that name.
- It does not match. Ask for a name that matches. Do not send the other form.

Is this unit the person's router?

Ask only when the role is router host, and ask before any change to the unit.

- The person says it is. Stop. The router's own unit is never changed through the router. Say that changing it cuts the channel every call takes. No change call. No gate.
- The person says it is not. Continue.
- No answer. Stop. Do not guess.

What did `vm.units.status` answer?

Call `vm.units.status` with `machine` and `unit`. Do not retry it.

Read the first word after `Active:`. The words in parentheses after it, such as `running`, `exited`, `listening`, or `mounted`, do not change the class.

Take the first match.

- `status` is `needs_confirmation`. The approval question. Take the repeated call's answer and ask this question again.
- `outcome` is `timeout`, `killed`, `request_timeout`, `busy`, or `vendor_error`, or a failure outcome with no `machine`, or `remote_failure` with no `exit_code`. Not a unit state. Name it. On `busy`, the machine was not asked. On `vendor_error`, or on a failure with no `machine`, the answer does not establish whether the router reached the machine. Stop. Change nothing.
- `exit_code` is 4, or the output says the unit could not be found. No such unit. Continue to the unit decision.
- The first word is `activating`, `deactivating`, `reloading`, or `refreshing`. Ask. Do not change a unit mid-transition.
- The first word is `active` and `exit_code` is 0. Active. Continue to the unit decision.
- The first word is `failed` and `exit_code` is 1, 2, or 3. Failed, which is not the stopped state. Continue to the unit decision.
- The first word is `inactive` and `exit_code` is 1, 2, or 3. Inactive. Continue to the unit decision.
- `outcome` is `ok` or `remote_failure` and the answer names this identifier, and the Active line is missing, its first word is none of these, or it disagrees with the `exit_code`. Stop. Copy the outcome, the `exit_code`, and the output. Change nothing.
- Any other `status` or `outcome`. Name it verbatim. Stop. Change nothing.

What did the unit inspection decide?

Read the Loaded line: `masked` there means the unit is masked.

Take the first match.

- No such unit. Say so. No change call. No gate. Do not send the verb.
- The unit is masked. None of the four verbs unmasks it. `stop` when the unit is already inactive is `unchanged`. Any other verb: say it is masked. No change call. No gate.
- The verb is `start` or `stop` and the state is failed. Both are changes.
- The verb is `start` and the state is active. `unchanged`. No change call. No gate.
- The verb is `stop` and the state is inactive. `unchanged`. No change call. No gate.
- The verb is `restart` or `reload`, and the unit exists. It always changes. The change is that verb, including when the unit is already active.
- Any other pair of verb and state. The change is that verb.

What else would this unit change reach?

Ask only when a change call was decided. One `vm.command.run`, a read the person is told is a read, with `argv` `systemctl`, `show`, then `-p` and each of `Names`, `Type`, `RemainAfterExit`, `RequiredBy`, `BoundBy`, `ConsistsOf`, `PropagatesStopTo`, `PropagatesReloadTo`, `Conflicts`, `Requires`, `Wants`, `BindsTo`, `Upholds`, `OnFailure`, and `OnSuccess`, then `--` and the unit. Classify its answer as the package inspection's: an answer that is not `ok` with every one of those fifteen lines present stops the run with nothing changed. This reads one level. A unit these lines name can have effects of its own that were not read, and the plan says so to the gate.

The path units are `tailscaled.service`; the SSH server's `ssh.service`, `sshd.service`, `ssh.socket`, and `sshd.socket`; the network stack's `systemd-networkd.service`, `NetworkManager.service`, `networking.service`, and `systemd-resolved.service`; the host firewall's `netfilter-persistent.service`, `nftables.service`, `ufw.service`, and `firewalld.service`; and any unit the person says is their SSH server, their tailnet daemon, their network, their firewall, or their router.

Take the first match.

- A name on the `Names` line is a path unit. Stop. Say that any of the four verbs on it can cut the channel this call runs on, and that the machine may be left reachable only by the provider's console. That change is the person's, over the provider's console. No change call. No gate.
- The verb is `stop` or `restart`, and `RequiredBy`, `BoundBy`, `ConsistsOf`, or `PropagatesStopTo` names any unit. Stop. Name those units: systemd would stop or restart them too. Name the gap for a unit change that also stops, restarts or conflicts with another unit. No change call. No gate.
- The verb is `reload`, and `PropagatesReloadTo` names any unit. Stop. Name those units: systemd would reload them too. Name the same gap. No change call. No gate.
- The verb is `start` or `restart`, and `Conflicts` names a unit other than `shutdown.target` and `umount.target`. Stop. Name those units: systemd would stop them. Name the same gap. No change call. No gate.
- The verb is `start` or `restart`, and `Requires`, `Wants`, `BindsTo`, `Upholds`, `OnFailure`, or `OnSuccess` names a path unit, or `reboot.target`, `poweroff.target`, `halt.target`, `kexec.target`, `rescue.target`, or `emergency.target`. Stop. Name it: starting this unit, or its failing, would reach it. Name the same gap. No change call. No gate.
- None of these. Continue. The gate sees the call.

The change call is sent only when a change call was decided and the question of what else it would reach did not stop. It is `vm.units.service` with `machine`, `verb`, and `unit`. Do not send an argument vector. The connector builds `systemctl` itself. When the decision was `unchanged` or a stop, do not send one. Then go to the gate question only when a change call remains.

### Job 3. One package, then one unit

Run Job 1 to its report, its own gate included. Then, only when Job 1 reported `changed` or `unchanged`, run Job 2 from its start: its own inspection, which reads the machine as the package change left it, and its own gate. A stop, a failure, a decline, or an outcome the re-inspection could not settle in Job 1 ends the run before the unit. The report says the unit was not attempted, and why.

### Is the plan gated?

A run whose inspection shows nothing to change writes nothing and takes no gate.

When there is a change call, hand the plan to `experts/DevOps Expert/` with `<live_state>`, in a second context, before any change call. `<live_state>` is the inspection output copied verbatim. The plan names the machine, the role, that output, the exact change calls in order, and the way back.

The way back for a package: remove what would be installed, or install again what would be removed. For an upgrade, install the version the inspection recorded, only when the inspection's version table lists that version from a source other than `/var/lib/dpkg/status`, and named as listed in the index, not as fetched: nothing here downloads it, and a listed version can still be gone from its server. When the table does not list it, the plan says that version cannot be installed again and the package has no way back. For a unit: `stop` undoes `start`, and `start` undoes `stop`. `restart` and `reload` have no opposite. The way back named for them is `start` when the inspection showed the unit active, and `stop` when it showed the unit inactive. The way back is named in the plan. It is not sent in this run unless the person asks for it, and then it is a new plan, gated again.

- Safe as planned. Continue. The approval question still applies to each change call.
- Safe with named conditions. Tell the person. A condition that changes the calls goes back into the plan and is gated again. A condition that does not change the calls: send nothing until the person accepts it and says it is met. They decline it: stop with no change call. The report names the conditions and their answer.
- Not as proposed. Stop. No change call.
- The work is a gap this expert declares. Stop. The verdict names it. No change call.

### What did the change call answer?

Send the planned call once. The approval question applies. Do not repeat a change call on a failure or an unclear answer. Do not send the way back because a call failed.

- `outcome` is `ok`, `truncated`, or `remote_failure`, and the answer names this identifier in `machine`. The call came back. Re-inspect.
- `outcome` is `timeout`, `killed`, or `request_timeout`, or `status` is `vendor_error`, or a failure outcome carries no `machine`. The outcome is unknown until the re-inspection. Say that. Re-inspect. Do not repeat the call.
- `outcome` is `busy`. The machine was not asked. Re-inspect. Do not repeat the call.
- `outcome` is `unknown_machine`. Do not repeat the call. Read `vm.inventory.list_hosts` once. Absent: it left the map, point to `skills/Prepare VM/`. Still listed: name the contradiction. Change nothing further.
- `status` is `needs_connect`, `denied`, `invalid_arguments`, or another gateway status other than `needs_confirmation`. The call did not run as a router result. Hand the status to `skills/Connection Troubleshooter/` in `wiser`. On `needs_connect`, the module is `command` for a package call and `units` for a unit call, unless the answer names one. Re-inspect only when the module that reads the state is connected. Otherwise say the re-inspection could not be made. Do not claim `changed` or `unchanged`. Do not repeat the call.
- Any other answer. Name it verbatim. Re-inspect when a read of the state is still possible. Do not repeat the call.

### What did the re-inspection show?

After every change call, whatever it answered, inspect again. A package: the same inspection argv. A unit: wait a few seconds after `start`, `restart`, or `reload`, so a service that fails at once shows it, then `vm.units.status`. The approval question applies to a package re-inspection, and the person is told it is a read.

The requested state: for `install` and `upgrade`, status `installed` at the pinned version; for `remove`, `not-installed` or `config-files`; for `start` and `restart`, the Active line's first word `active`, or, for a unit whose `Type` is `oneshot` and `RemainAfterExit` is `no`, the change call `ok` with `exit_code` 0 and the first word `inactive`; for `reload`, `active`; for `stop`, `inactive`. `changed` means the unit was in that state at the re-inspection. It does not prove the unit stays up.

- The re-inspection is incomplete, `truncated`, absent, or not a state, under the same rules as the first inspection. Do not claim `changed` or `unchanged`. Report failed, with the change call's outcome and the re-inspection's outcome, any `exit_code`, and the output. Do not repeat the change.
- A package re-inspection whose audit section is non-empty. Say the package database was left mid-change. Copy the audit section, which names the pending packages. The repair is the person's, over the provider's console. Do not repeat the change that just ran. Do not start a later unit call.
- A package re-inspection whose history section's last entry names a package the inspection's simulation did not. Name each one. When one is a path package, say the change may have reached the channel this call runs on. Then take the bullets below for the named package.
- The re-inspection output says the lock could not be taken, and the re-inspection shows the before-state. The change call changed nothing. Report that, with the outcome, the `exit_code`, and the output. Do not repeat the change.
- The requested state now holds, and it did not hold in the before-state. `changed`.
- The requested state held in the before-state and holds now, and the verb is not `restart` or `reload`. `unchanged`.
- The verb is `restart` or `reload`, the change call's `outcome` was `ok` or `truncated`, and the requested state holds now. `changed`.
- The verb is `restart` or `reload`, and the change call's outcome was unknown until the re-inspection. Report that, with the state the re-inspection shows. Do not relabel it `unchanged` because the state matches, and do not relabel it `changed`.
- The requested state does not hold. Failed. Name the change call's outcome, any `exit_code`, and its output, and name what the re-inspection shows.

### What does the report say?

One report. For each part: what was inspected, what was planned, the gate's verdict or that no gate was taken, each call's action and its `outcome`, any `exit_code`, the output copied verbatim where the report shows it, the re-inspection, and `changed`, `unchanged`, or failed. A change whose outcome was unknown until the re-inspection says that, and then says what the re-inspection decided.

No credential, address, or hostname is asked for or printed as a field. An identifier is the machine field. A hostname inside copied output stays that output.

## Pitfalls

- **The request is ambiguous.** More than one machine, more than one package, more than one unit, an operation that is not install, remove, or upgrade, or a unit verb outside the four. Ask before any call.
- **A machine that is not on the map, or whose health is not `ok`.** Stop. Not on the map: point to `skills/Prepare VM/`. Not reachable: name the outcome the way `skills/VM Inventory/` does. Change nothing.
- **A failure with no `machine`, called unreachable or called a finished change.** It does not establish whether the router reached the machine. On a read of health, not determined, and stop. On a change, the outcome is unknown until the re-inspection.
- **`vendor_error` treated as the machine's answer.** It does not establish whether the call ran.
- **`busy` treated as a down machine.** The machine was not asked. Do not repeat the change.
- **A package name or a unit name that fails its pattern, sent anyway.** Ask. Never send the other form. The package name stays an operand.
- **A shell write.** No redirection, no `tee`, no `sed -i`, and no configuration file, through `vm.command.run` or through `vm.files.write_file`.
- **Purge, `--autoremove`, or a second package in the simulation's removal list.** Stop. One package, removed only by `remove`, and only that package.
- **A path package removed, upgraded, or replaced, or a path unit given any of the four verbs.** Stop. The channel this call runs on is that path. The person's route is the provider's console. The router's own unit is never changed through the router.
- **A unit change judged by its name alone.** Read the fifteen properties. An alias of a path unit is a path unit. A stop, restart, or reload that reaches another unit, or a start that conflicts with one or pulls in a path unit or a shutdown target, stops the run. One level is read, and the plan says so.
- **A oneshot called failed for being inactive.** A `Type=oneshot` unit without `RemainAfterExit` is inactive once it has run. The call's `ok` with exit 0 is its success.
- **An apt change that lets the restart hook run.** Every apt change call sets `NEEDRESTART_SUSPEND=1`. Without it the hook can restart the router mid-call.
- **A restart reported `changed` because the call returned.** It is `changed` only when the re-inspection, a few seconds later, shows the unit in its requested state, which says nothing about later.
- **An install of a path package that is already there, sent again.** `unchanged`. No change call.
- **`exit_code` 3 or 4 from `vm.units.status`, treated as a failed transport.** It is the status result. Read `exit_code` and `output`.
- **A `timeout` read as the change undone.** Re-inspect. Do not repeat the change. A service systemd started during the command can still be running.
- **A decline that erases an earlier result.** The earlier re-inspection stands. Nothing changed after the decline. No further call.
- **A change repeated after a failure.** Do not repeat it. Do not send the way back unless the person asks, and then only as a new gated plan.
- **The audit non-empty, repaired here.** `dpkg --configure -a` configures every pending package, path packages included. Name the pending packages. The repair is the person's, over the provider's console.
- **A credential, an address, or a hostname asked for or printed as a field.** Do not ask. Do not print one as a field. Copied output stays copied output.
- **Another package manager's commands borrowed.** Stop. Name the gap, and name the `ID` and `ID_LIKE` lines.
- **The fleet called down.** A router-host failure, or a `list_hosts` `vendor_error`, means connector access to the whole fleet depends on the router host. Workloads keep serving.

## Success

- The report covers one machine. A request that named more than one was asked, and nothing was called before the answer.
- The machine was on the map and `vm.inventory.health` was `ok` before any inspection or change. Otherwise the report says not on the map and points to `skills/Prepare VM/`, or names the health outcome the way `skills/VM Inventory/` does, and nothing was changed.
- A package change was apt, on a distribution whose `ID` or `ID_LIKE` token is `debian` or `ubuntu`. Any other distribution names the gap and was not changed.
- The package inspection was one `vm.command.run`, the person was told it is a read, and the package name was an operand. The unit inspection was `vm.units.status`.
- Already in the requested state is `unchanged`, with no change call and no gate. `restart` and `reload` of a unit that exists were changes.
- A change call was sent only after `experts/DevOps Expert/` returned safe as planned, or safe with named conditions the person was told, and only after the person approved that call's stop. `skills/Connection Troubleshooter/` in `wiser` was the stop. A declined change had no further call.
- Each change call was sent at most once. A `timeout`, `killed`, `request_timeout`, `vendor_error`, or failure with no `machine` was reported as unknown until the re-inspection, and the re-inspection decided. The re-inspection was the same package read, or `vm.units.status`.
- A non-empty `dpkg --audit` before a change stopped the run. A non-empty audit after a change said the package database was left mid-change and named the pending packages. No repair was sent.
- A path package was not removed, upgraded, or replaced through the router, and no path unit, or alias of one, was changed with any verb. On the router host, a unit the person said is their router was not changed. A unit change that would reach another unit was stopped.
- Every apt change call carried `NEEDRESTART_SUSPEND=1` and, for an install or upgrade, `--no-remove` and the version the inspection read. A `start`, `restart`, or `reload` was `changed` only when the re-inspection showed the requested state. No unit was enabled or disabled.
- The report names, per part, the inspection, the plan, the gate's verdict or that no gate was taken, each call's outcome, the re-inspection, and `changed`, `unchanged`, or failed. Output shown is verbatim. No credential, address, or hostname was asked for or printed as a field.
- No configuration file was written, and no redirection, `tee`, or `sed -i` was sent through `vm.command.run`. No whole-system upgrade, kernel, or DKMS change was started.
- A hostname, a DNS record, or a zone was handed to `experts/IT Expert/` in `wiser`, which sequences `skills/Zone Publisher/`.
