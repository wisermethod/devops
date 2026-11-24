---
name: tart-vm
type: tool
category: operations
description: Manage local Tart VMs, capture their screens and send guest input through a detached supervisor, as one JSON object
version: 0.2.0
runs: local
---

# tart-vm

Manage Tart virtual machines on an Apple silicon Mac. A detached supervisor holds each VM started by the tool after the calling shell exits.

## Context

Use this tool for local VM lifecycle work and guest desktop control. It leaves host settings and each image's CPU, memory and display settings alone. It disables clipboard, audio and USB accessory sharing. It uses the existing Tart installation. The tool starts, stops and deletes VMs it recorded at creation. To delete a VM without a record, the skill sets `--gate-approved` only after DevOps Expert's gate and the requester's yes naming the VM. The desktop option reports Tart's experimental listener. The supervisor keeps one authenticated RFB connection to the VM over loopback. Screen capture and input use the guest's framebuffer and virtual devices. Tart itself may remove cached images to make room when it clones (its automatic pruning, which `TART_NO_AUTO_PRUNE` turns off).

A share lets anything in the VM read every file in that folder and, unless you append `:ro`, change or delete those files. A share stays exported to the VM until the VM stops, whether or not it is mounted. The tool refuses to share its state root, Tart's home, its own directory, or any directory that overlaps them. A window start opens Tart's own window on the Mac, takes focus and runs no network listener.

Classifier seam: none.

## Dependencies

- Node 18.15 or later provides `fs.statfsSync`. Check with `node --version`.
- Every command except help checks Tart with `tart --version`.
- Desktop start and status for a desktop VM check macOS's `lsof` with `lsof -v`.
- Preflight reads the macOS version with macOS's `sw_vers -productVersion`.

## Quick Start

    node scripts/tart-vm.js help
    node scripts/tart-vm.js preflight
    node scripts/tart-vm.js create wiser-tart-test
    node scripts/tart-vm.js start wiser-tart-test --desktop
    node scripts/tart-vm.js status wiser-tart-test
    node scripts/tart-vm.js screenshot wiser-tart-test --out "/path/to/work/guest.png"
    node scripts/tart-vm.js key wiser-tart-test --keys cmd+space
    node scripts/tart-vm.js stop wiser-tart-test --graceful
    node scripts/tart-vm.js delete wiser-tart-test

## Usage

Run `node scripts/tart-vm.js` followed by a command. Append `--help` to any command for usage.

| Command | What it does |
|---------|--------------|
| `help`, `--help` | Print usage without configuration or dependency checks. |
| `preflight` | Report the host platform and architecture, macOS version, Tart version, free disk space on Tart's volume, default image cache status, running macOS VMs and state directories. Report failed probes as facts. |
| `list` | List local VMs and mark those the tool created or supervises. |
| `create <name> [--image <ref>] [--image-gb <n>] [--keep]` | Clone an OCI image, preserving its VM settings. The default is `ghcr.io/cirruslabs/macos-tahoe-base:latest`. Supply `--image-gb` in decimal GB for an uncached custom image. Use `--keep` to mark the new VM as kept. |
| `clone <source> <name> [--keep]` | Clone a local VM available to the current account. Use `--keep` to mark the new VM as kept. |
| `start <name> [--desktop \| --window] [--share <path>[:ro]]...` | Start a recorded VM under the supervisor and wait up to 120 seconds for readiness, including any share mounts. `--desktop` enables Tart's experimental VNC listener and requires RFB authentication and ServerInit. `--window` opens Tart's window. Headless and desktop starts pass `--no-graphics`. Every start passes `--no-clipboard`, `--no-audio` and `--no-usb-accessories`. Repeat `--share` up to eight times with absolute host directory paths. After the guest agent answers, each share mounts at its resolved host path. Append `:ro` for read-only access. |
| `status <name>` | Read Tart's local VM details and current supervisor status. Recheck a desktop listener with `lsof` and report the RFB connection and framebuffer size. Inspect the guest mount table once for a supervised VM with shares. |
| `screenshot <name> --out <path>` | Request a full non-incremental framebuffer update and write a PNG to the resolved caller path. The parent directory must exist. |
| `move <name> --x <n> --y <n>` | Move the guest pointer. |
| `click <name> --x <n> --y <n> [--button <left\|right\|middle>]` | Click once. The button defaults to `left`. |
| `double-click <name> --x <n> --y <n>` | Click twice with the left button. |
| `drag <name> --from-x <n> --from-y <n> --to-x <n> --to-y <n>` | Press the left button, move to the destination and release. |
| `scroll <name> --x <n> --y <n> --direction <up\|down\|left\|right> [--steps <n>]` | Send a press and release for each wheel step. Supply a whole number of steps from 1 to 100. The default is 1. |
| `type <name> --text <text>` | Send printable US-layout characters, Return for a newline and Tab for a tab. The tool holds Shift for each character that requires it. At most 1,000 characters per command. |
| `key <name> --keys <combo>` | Send one key or chord, such as `cmd+n`, `cmd+space`, `shift+tab` or `return`. |
| `stop <name> [--graceful \| --power-off] [--kept-approved] [--timeout <seconds>]` | Kept VMs default to graceful shutdown. Other recorded VMs default to power-off. `--graceful` asks the guest to shut down with `sudo -n /sbin/shutdown -h now` through `tart exec`. For a kept VM, use `--power-off --kept-approved` only after the person says yes and names the VM. Give `--timeout` as a positive whole number of seconds. The default is 30 for power-off and 120 for graceful shutdown. The graceful timeout bounds the request and the wait. On timeout the tool leaves the VM running. The VM's state decides the outcome because shutdown can drop the agent's connection before `tart exec` answers. |
| `delete <name> [--gate-approved] [--kept-approved]` | Delete a stopped or suspended VM, then its record, its supervisor log and any socket a killed supervisor left. Use `--kept-approved` for a kept VM only after the person says yes and names it. Delete removes a stale record with `vm_missing: true`. Create can replace a stale record for a VM that was never kept. A VM without a record requires `--gate-approved` after DevOps Expert's gate and the requester's yes naming the VM. |

New names use `wiser-tart-` followed by 1 to 31 lowercase letters, digits or hyphens. The first character after the prefix must be a letter or digit. Create from a cached image, clone and start need 20 GB free. An uncached image needs its size plus 20 GB. The default image uses a measured floor of 33 GB for that calculation. Start refuses a third running macOS VM.

Only `start` launches the internal `scripts/tart-vm-supervisor.js` script. Its `help` and `--help` show its internal `serve <name> <launch-id> [--desktop | --window] [--share <path>[:ro]]...` invocation. The supervisor keeps the desktop URL in memory, serves status and queued desktop requests on its private Unix socket and records only the passphrase length. If a desktop run ends before its URL is read, its log keeps only the class of Tart's error, since the passphrase could not yet be redacted.

Desktop commands require a recorded VM held by `start --desktop`. Coordinates are zero-based framebuffer pixels, with the origin at the top left. Both drag endpoints must be in bounds. If the RFB connection drops, `status` reports it. Stop the VM and start it again with `--desktop` to restore desktop commands.

### Keys

The key names are case-insensitive. Use an explicit `shift` modifier for a shifted chord, or use `type` to apply Shift per character. Option and Control are unavailable until measured.

| Names or characters | Tart 2.42.0 evidence |
|---------------------|----------------------|
| Letters, digits, space and `return` | Measured with typed text and Return in Terminal. |
| Uppercase letters and shifted US-layout punctuation via `type` | Shift held as `Shift_L` (0xffe1). Measured with uppercase letters and shifted punctuation in Terminal. |
| `cmd` | Measured as `Alt_L` (0xffe9) with Command+N and Command+Space. |
| `tab`, `escape`, `backspace`, `delete`, `up`, `down`, `left`, `right`, `home`, `end`, `pageup`, `pagedown` | Offered with their RFB keysyms. Guest results await measurement. |

### Answers

Help prints usage text. Each successful command other than help prints one JSON object with `command` and `tart_version`. A version other than 2.42.0 adds a one-line `warnings` array. If preflight cannot read Tart's version, `tart_version` is null and `errors` names the failed probe. A refusal leaves stdout empty, prints the cause and fix to stderr, and exits 1.

| Command | Other fields |
|---------|--------------|
| `preflight` | `platform`, `architecture`, `apple_silicon`, `macos_version`, `macos_13_or_later`, `tart_home`, `disk`, `default_image`, `default_image_cached`, `running_macos_vms`, `state_directories` and `errors`. The disk object gives `free_bytes` and `measured_at`. |
| `list` | `vms` contains Tart's local list entries with `created_by_tool`. Recorded VMs carry `kept`. Entries held by a supervisor carry `supervised: true`, `desktop` and `window`. |
| `create`, `clone` | `record` gives `name`, `source`, `created_at`, `tool_version` and `kept`. `vm` is Tart's `get` object. Create also gives `image_cached` and echoes `image_gb` when supplied. |
| `start`, `status` | `name`, `supervised`, `desktop`, `window` and `pid` when supervised. Status includes `vm`, Tart's `get` object, and `kept` for a recorded VM. Records from 0.1.0 read as `kept: false`. Both commands return `shares` with each resolved `path`, `access` (`rw` or `ro`), `exported: true` and `mounted`. A successful start reports `mounted: true` for every share. Status reads mounts live and reports `mounted: null` and `guest_agent_answered: false` if the guest agent does not answer. A desktop supervisor reports `rfb` with `connected` and `framebuffer` (width and height, or null before ServerInit). A verified desktop listener adds `listener` from `lsof` and `listener_reach`. On a wildcard, as Tart 2.42.0 listens, the port can be reached from every network this Mac joins and Tart's passphrase is its only guard. |
| `screenshot` | `name`, `path` (resolved), `width`, `height` and `bytes`. |
| `move` | `name`, `x` and `y`. |
| `click`, `double-click` | `name`, `x`, `y` and `button`. |
| `drag` | `name`, `from` and `to`. Each endpoint contains `x` and `y`. |
| `scroll` | `name`, `x`, `y`, `direction` and `steps`. |
| `type` | `name` and `length` in characters. |
| `key` | `name`. |
| `stop` | `name`, `vm`, `method` (`power-off` or `guest-shutdown`) and `timeout_seconds`. |
| `delete` | `name`, `deleted`, `gate_approved`, `free_bytes_before` and `free_bytes_after`; for a record whose VM was already gone, `deleted: false`, `vm_missing: true` and `record_removed: true`. |

## Writes

The scripts follow `wiser/standards/script-contract.md`. Screenshots write to the caller’s resolved `--out` path and replace an existing regular file there. The tool directory is refused. The writes table lists the state and Tart files. [Everything a tool writes, and where](../AGENTS.md#everything-a-tool-writes-and-where)

A desktop command waits its turn behind the one before it. While it waits and runs, the supervisor sends a newline every 10 seconds, and the entry script gives up only after 30 seconds of silence. An input command whose caller has gone stops at its next event; a screenshot, which changes nothing in the guest, finishes. A command that fails partway releases any key or button it pressed, where the connection still allows. A write the RFB server has not taken within 10 seconds closes the desktop session, so a server that stops reading fails the command rather than holding the queue.

## Measurements

Measured 2026-11-23 on an M4 Max with macOS 26.3 and Tart 2.42.0.

- The default Tahoe image was 27.0 GB compressed and the first clone from the registry took 241 seconds. Tart reported a 50 GB disk with a 33 GB size. A second local clone took under a second and used another 388 KB because APFS shares the unchanged blocks.
- The default VM had 4 CPUs, 8192 MB of memory and a 1024x768 display.
- The experimental VNC server listened on every interface. `lsof` showed an IPv6 wildcard such as `*:49157`. The URL Tart printed named `127.0.0.1`.
- The guest agent answered `tart exec` about 18 seconds after startup.
- `stop --graceful` took 8 to 10 seconds from `/sbin/shutdown` to Tart reading the VM stopped; a bare `shutdown` under `tart exec` was not found, and once `tart exec` exited non-zero while the guest shut down.
- Every start used Tart's default shared NAT, since the tool passes no network option and Tart 2.42.0 sets networking per `tart run`, not in a VM's configuration; the guest's address was 192.168.64.2.
- The guest reached none of the host's non-loopback TCP listeners included in a partial scan of processes owned by the host user. The same guest reached the host's DNS service and an external HTTPS endpoint in control checks.
- A desktop start that connects while the guest is still booting reads a 1280x720 framebuffer at ServerInit; the first full update after macOS finishes starting resizes it to 1024x768 (measured 2026-11-23, Milestone 2's live drive). `status` reports the size as of the last ServerInit or DesktopSize, and every pointer write is checked against the size at that moment: take a screenshot before the first action. A screenshot is taken only once rectangles cover the whole frame, from a copy of that frame.
- Through the shipped commands, 2026-11-23: 10 of 10 clicks landed on the guest's own pointer reading; `Wiser Probe 42: A-Z_ok! ~{}|<>?` typed and read back exact; `cmd+n` took Terminal from 1 to 2 windows; `cmd+space` opened Spotlight; `move` and `drag` ended at the requested pixel.

Measured 2026-11-24 on the same Mac and Tart version.

- The guest agent answered 18 to 19 seconds after a headless start and 31 seconds after a window start.
- A guest reboot removed the mount and its mount point. The host enforced read-only access while the guest's mount flags showed the same options for both access modes.
- The `tart run` process owned the window, which came to the front and took focus. The process had no network listener.

## Troubleshooting

| What you see | What to do |
|--------------|------------|
| Unknown option or invalid name | Run `node scripts/tart-vm.js help` and check the command and VM name. |
| Tart unavailable or lsof check failed | Run `tart --version` or `lsof -v` as named in the error. |
| An image needs `--image-gb`, or there is too little disk space | Supply the uncached image's size or free space on Tart's volume before retrying. |
| Create or clone failed after Tart cloned | A VM is recorded only once Tart's clone exits 0, so a record never names a VM this tool did not make. Without a record, which the error says, the tool cannot start, stop or delete that VM: delete it with `--gate-approved` only after DevOps Expert's gate. |
| Two macOS VMs are running | Stop a named running macOS VM before starting another one. |
| The guest did not shut down | Inspect status. Use `--power-off` only if a power-off is acceptable. |
| A share was refused | Follow the path check in the error. Use an existing absolute directory with no colon, give each resolved directory once, and append only `:ro` for read-only access. |
| Start failed after the VM began running | The error reports the VM's state after cleanup. If a kept VM is still running, check `status` and follow the error before retrying. Share mounting requires a responsive guest agent and passwordless `sudo`. |
| A share reports `mounted: false` after a reboot | The tool checks mounts live. Stop the VM and start it again with its share flags to restore them. |
| Deleting or powering off a kept VM was refused | For shutdown, use `stop <name>` to ask the guest to shut down. For deletion or power-off, use `--kept-approved` only after the person says yes and names that VM. |
| Unsafe directory, another command working on the name, stale socket or socket path too long | Check the state paths in `preflight`. The Wiser directory must be owned by the current user without group or other write access, and the tool's own `tart-vm`, `vms` and `run` directories must admit no one else (mode 0700). `create`, `clone`, `start` and `delete` hold the VM name's lock while they run. macOS drops the lock on exit. If another command holds it, wait for that command to finish. While holding the lock, `start` clears a stale socket if the same file refuses connections twice. The socket path limit is 103 bytes. |
