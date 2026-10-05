# Gaps

What this plugin does not do, declared by the primitive that names it.

A gap is a capability this root does not provide that a primitive's own body names as missing (`wiser/standards/primitives.md`). This file collects every declared `gaps` entry, by hand, and is corrected whenever a primitive's gaps change. It carries capability gaps only, and names what is missing, never where it went.

Counted 2026-10-05: 16 gaps across 5 primitives. Bullet count: `grep -E '^- ' system/GAPS.md | wc -l` returns 16, and the same count derived from the primitives' own `gaps:` frontmatter returns 16.

## Experts

### DevOps Expert

- changing a configuration file on a machine
- deploying a workload to a machine and reporting where it is reachable
- reading any state of a machine or the fleet beyond the role, reachability and facts an inventory returns, and beyond the exposure a guest audit reads
- a security review of a machine or workload change, which this expert names as a question and does not answer

## Skills

### Prepare VM

- a router this plugin does not ship, which enrollment requires the person to already run

### VM Configure

- a router this plugin does not ship, which every change goes through
- a package manager other than apt
- an upgrade that newly installs or removes a package, a kept-back kernel and a dist-upgrade included
- rebooting a machine, the reboot a new kernel needs included
- repairing a package database left mid-change
- a unit change that also stops, restarts or conflicts with another unit
- enabling or disabling a unit
- a package change on a machine whose systemd is older than 254, which a background job needs

### VM Inventory

- a router this plugin does not ship, which the inventory reads through

### VM Security Audit

- a router this plugin does not ship, which the audit reads through
- security lists, network security groups, public IP assignment, IAM policy and encryption at rest, which are not visible from inside a guest
