# Gaps

What this plugin does not do, declared by the primitive that names it.

A gap is a capability this root does not provide that a primitive's own body names as missing (`wiser/standards/primitives.md`). This file collects every declared `gaps` entry, by hand, and is corrected whenever a primitive's gaps change. It carries capability gaps only, and names what is missing, never where it went.

Counted 2026-09-26: 5 gaps across 1 primitives. Bullet count: `grep -E '^- ' system/GAPS.md | wc -l` returns 5, and the same count derived from the primitives' own `gaps:` frontmatter returns 5.

## Experts

### DevOps Expert

- preparing an existing machine to join the fleet, its tailnet policy merge included, and confirming it joined
- changing a package, a service or a configuration on a machine
- deploying a workload to a machine and reporting where it is reachable
- reading a machine's or the fleet's state, health or exposure
- a security review of a machine or workload change, which this expert names as a question and does not answer
