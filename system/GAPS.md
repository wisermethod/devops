# Gaps

What this plugin does not do, declared by the primitive that names it.

A gap is a capability this root does not provide that a primitive's own body names as missing (`wiser/standards/primitives.md`). This file collects every declared `gaps` entry, by hand, and is corrected whenever a primitive's gaps change. It carries capability gaps only, and names what is missing, never where it went.

Counted 2026-10-05: 6 gaps across 3 primitives. Bullet count: `grep -E '^- ' system/GAPS.md | wc -l` returns 6, and the same count derived from the primitives' own `gaps:` frontmatter returns 6.

## Experts

### DevOps Expert

- changing a package, a service or a configuration on a machine
- deploying a workload to a machine and reporting where it is reachable
- reading exposure, or any state of a machine or the fleet beyond the role, reachability and facts an inventory returns
- a security review of a machine or workload change, which this expert names as a question and does not answer

## Skills

### Prepare VM

- a router this plugin does not ship, which enrollment requires the person to already run

### VM Inventory

- a router this plugin does not ship, which the inventory reads through
