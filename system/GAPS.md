# Gaps

What this plugin does not do, declared by the primitive that names it.

A gap is a capability this root does not provide that a primitive's own body names as missing (`wiser/standards/primitives.md`). This file collects every declared `gaps` entry, by hand, and is corrected whenever a primitive's gaps change. It carries capability gaps only, and names what is missing, never where it went.

Counted 2026-10-10: 41 gaps across 9 primitives. Bullet count: `grep -E '^- ' system/GAPS.md | wc -l` returns 41, and the same count derived from the primitives' own `gaps:` frontmatter returns 41.

## Experts

### DevOps Expert

- changing a configuration file on a machine
- reading any state of a machine or the fleet beyond the role, reachability and facts an inventory returns, and beyond the exposure a guest audit reads
- a security review of a machine or workload change, which this expert names as a question and does not answer

### CRM Expert

- setting up an organisation's Twenty workspace, its address, members, data model and first import, which this expert judges and no skill here runs yet
- exporting an organisation's workspace or taking it off the install
- setting up or changing a CRM platform other than Twenty

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

### Deploy Workload

- a router this plugin does not ship, which every deploy goes through
- a workload on the router host, where Caddy has not been measured beside the router's own public origin
- a workload that needs a secret, a private registry login, a host directory, or more than one container
- changing a deployed workload's image or settings in place
- the provider firewall rule and the DNS record a public URL needs, which no guest can set
- installing Docker on a distribution other than Ubuntu, or on a machine that already forwards IPv4 traffic
- IPv6 ingress
- installing Docker or pulling an image on a machine whose systemd is older than 254, which a background job needs

### Deploy Twenty

- installing a Twenty release other than v2.45.6, or upgrading an install to another release
- a machine with no Docker, or with no Caddy running in the shape `skills/Deploy Workload/` runs it
- connecting Google or Microsoft mailboxes, which needs an OAuth client and the provider's approval
- Cloudflare for SaaS's custom-hostname setting and fallback origin on a zone, which the person turns on in Cloudflare's dashboard
- creating the bucket, the API tokens and the sending accounts the install uses, which the person does with each vendor
- email channels and branded email from a workspace's own domain, which need an inbound email domain (`INBOUND_EMAIL_DOMAIN`), its MX records and the sending service's inbound configuration that this skill does not set

### Back Up Twenty

- authenticating a set's origin, and object lock
- alerting on an overdue backup
- Redis's queued and delayed work
- incremental backups
- deleting sets by hand
- making a restored install public (routes, custom domains)
- serving a restored workspace's custom domain from another install
- a release other than v2.45.6
- creating the buckets and the tokens, which is the person's with the vendor
