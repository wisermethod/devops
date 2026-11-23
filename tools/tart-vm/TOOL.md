---
name: tart-vm
type: tool
category: operations
description: Create, clone, start, inspect, stop and delete local Tart VMs under a detached supervisor, as one JSON object
version: 0.1.0
runs: local
---

# tart-vm

Manage disposable Tart virtual machines on an Apple silicon Mac. A detached supervisor holds each VM started by the tool after the calling shell exits.

## Context

Use this tool for local VM lifecycle work. It leaves host settings and each image's CPU, memory and display settings alone. It opens no host window and disables clipboard, audio and USB accessory sharing. It uses the existing Tart installation. The tool starts, stops and deletes VMs it recorded at creation. To delete a VM without a record, the skill sets `--gate-approved` only after DevOps Expert's gate and the requester's yes naming the VM. The desktop option reports Tart's experimental listener. Screen capture and input are outside this tool's commands. Tart itself may remove cached images to make room when it clones (its automatic pruning, which `TART_NO_AUTO_PRUNE` turns off); the tool neither sets nor reports that.

Classifier seam: none.

## Dependencies

- Node 18.15 or later provides `fs.statfsSync`. Check with `node --version`.
- Every command except help checks Tart with `tart --version`.
- Desktop start and status for a desktop VM check macOS's `lsof` with `lsof -v`.
- Preflight reads the macOS version with macOS's `sw_vers -productVersion`.
- `start` reads a start lock's holder with macOS's `/bin/ps`, part of macOS.

## Quick Start

    node scripts/tart-vm.js help
    node scripts/tart-vm.js preflight
    node scripts/tart-vm.js create wiser-tart-test
    node scripts/tart-vm.js start wiser-tart-test
    node scripts/tart-vm.js status wiser-tart-test
    node scripts/tart-vm.js stop wiser-tart-test --graceful
    node scripts/tart-vm.js delete wiser-tart-test

## Usage

Run `node scripts/tart-vm.js` followed by a command. Append `--help` to any command for usage.

| Command | What it does |
|---------|--------------|
| `help`, `--help` | Print usage without configuration or dependency checks. |
| `preflight` | Report the host platform and architecture, macOS version, Tart version, free disk space on Tart's volume, default image cache status, running macOS VMs and state directories. Report failed probes as facts. |
| `list` | List local VMs and mark those the tool created or supervises. |
| `create <name> [--image <ref>] [--image-gb <n>]` | Clone an OCI image, preserving its VM settings. The default is `ghcr.io/cirruslabs/macos-tahoe-base:latest`. Supply `--image-gb` in decimal GB for an uncached custom image. |
| `clone <source> <name>` | Clone a local VM available to the current account. |
| `start <name> [--desktop]` | Start a recorded VM under the supervisor and wait up to 120 seconds for readiness. `--desktop` alone enables Tart's experimental VNC listener. Every start passes `--no-graphics`, `--no-clipboard`, `--no-audio` and `--no-usb-accessories` to Tart. |
| `status <name>` | Read Tart's local VM details and current supervisor status. Recheck a desktop listener with `lsof`. |
| `stop <name> [--graceful] [--timeout <seconds>]` | Power off a recorded VM by default. `--graceful` asks the guest to shut down with `sudo -n /sbin/shutdown -h now` through `tart exec`, whose `PATH` has no `/sbin`. `--timeout` is a positive whole number of seconds. Tart's power-off timeout defaults to 30. The graceful timeout defaults to 120 and bounds both the request to the guest and the wait, leaving the VM running if the guest does not shut down in time. The VM's own state decides the outcome, since a guest that shuts down can drop the agent's connection before `tart exec` answers. |
| `delete <name> [--gate-approved]` | Delete a stopped or suspended VM, then its record, its supervisor log and any socket a killed supervisor left. A record whose VM Tart no longer has is removed with `vm_missing: true`, as `create` does before reusing the name. A VM without a record requires `--gate-approved` after DevOps Expert's gate and the requester's yes naming the VM. |

New names use `wiser-tart-` followed by 1 to 31 lowercase letters, digits or hyphens. The first character after the prefix must be a letter or digit. Create from a cached image, clone and start need 20 GB free. An uncached image needs its size plus 20 GB. The default image uses a measured floor of 33 GB for that calculation. Start refuses a third running macOS VM.

Only `start` launches the internal `scripts/tart-vm-supervisor.js` script. Its `help` and `--help` show its internal `serve <name> <launch-id> [--desktop]` invocation. The supervisor keeps the desktop URL in memory, accepts a line-delimited JSON status request on its private Unix socket and records only the passphrase length. If a desktop run ends before its URL is read, its log keeps only the class of Tart's error, since the passphrase could not yet be redacted.

### Answers

Help prints usage text. Each successful lifecycle or preflight command prints one JSON object with `command` and `tart_version`. A version other than 2.42.0 adds a one-line `warnings` array. If preflight cannot read Tart's version, `tart_version` is null and `errors` names the failed probe. A refusal leaves stdout empty, prints the cause and fix to stderr, and exits 1.

| Command | Other fields |
|---------|--------------|
| `preflight` | `platform`, `architecture`, `apple_silicon`, `macos_version`, `macos_13_or_later`, `tart_home`, `disk`, `default_image`, `default_image_cached`, `running_macos_vms`, `state_directories` and `errors`. The disk object gives `free_bytes` and `measured_at`. |
| `list` | `vms` contains Tart's local list entries with `created_by_tool`. Entries held by a supervisor also carry `supervised: true` and `desktop`. |
| `create`, `clone` | `record` gives `name`, `source`, `created_at` and `tool_version`. `vm` is Tart's `get` object. Create also gives `image_cached` and echoes `image_gb` when supplied. |
| `start`, `status` | `name`, `supervised`, `desktop` and `pid` when supervised. Status includes `vm`, Tart's `get` object. A ready desktop run adds `listener` from `lsof` at the announced port and `listener_reach`. The port can be reached from every network this Mac joins and Tart's passphrase is its only guard. |
| `stop` | `name`, `vm`, `method` (`power-off` or `guest-shutdown`) and `timeout_seconds`. |
| `delete` | `name`, `deleted`, `gate_approved`, `free_bytes_before` and `free_bytes_after`; for a record whose VM was already gone, `deleted: false`, `vm_missing: true` and `record_removed: true`. |

## Writes

The scripts follow `wiser/standards/script-contract.md`. The writes table lists the state and Tart files. [Everything a tool writes, and where](../AGENTS.md#everything-a-tool-writes-and-where)

## Measurements

Measured 2026-11-23 on an M4 Max with macOS 26.3 and Tart 2.42.0.

- The default Tahoe image was 27.0 GB compressed and the first clone from the registry took 241 seconds. Tart reported a 50 GB disk with a 33 GB size. A second local clone took under a second and used another 388 KB because APFS shares the unchanged blocks.
- The default VM had 4 CPUs, 8192 MB of memory and a 1024x768 display.
- The experimental VNC server listened on every interface. `lsof` showed an IPv6 wildcard such as `*:49157`. The URL Tart printed named `127.0.0.1`.
- The guest agent answered `tart exec` about 18 seconds after startup.
- `stop --graceful` took 8 to 10 seconds from `/sbin/shutdown` to Tart reading the VM stopped; a bare `shutdown` under `tart exec` was not found, and once `tart exec` exited non-zero while the guest shut down.
- The guest reached none of the host's non-loopback TCP listeners included in a partial scan of processes owned by the host user. The same guest reached the host's DNS service and an external HTTPS endpoint in control checks.

## Troubleshooting

| What you see | What to do |
|--------------|------------|
| Unknown option or invalid name | Run `node scripts/tart-vm.js help` and check the command and VM name. |
| Tart unavailable or lsof check failed | Run `tart --version` or `lsof -v` as named in the error. |
| An image needs `--image-gb`, or there is too little disk space | Supply the uncached image's size or free space on Tart's volume before retrying. |
| Two macOS VMs are running | Stop a named running macOS VM before starting another one. |
| The guest did not shut down | Inspect status. Stop without `--graceful` only if a power-off is acceptable. |
| Unsafe directory, stale socket or socket path too long | Check the state paths in `preflight`. Use directories owned by the current user with group and other write access removed. `start` takes a per-VM start lock naming its process, then clears a socket that refuses connections twice and is the same file both times, which a killed supervisor or a restart left; a second start while one holds the lock is refused. A lock is taken over only when its process is no longer a running `tart-vm.js start` (read with `/bin/ps`), or, naming no process, is older than three minutes; a start releases only its own lock. The socket path limit is 103 bytes. |
