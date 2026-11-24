# Tools

Deterministic operations that skills and experts call; `wiser/standards/primitives.md` owns the type and the classifier seam every new typed file here, and any file whose seam changes, declares in its Context. Running one is `wiser/tools/RUNNING.md`; the contract is `wiser/standards/script-contract.md`. The directory is flat, and the index below is grouped by category.

<!-- generated:index -->

### Operations

| Tool | Description |
|------|-------------|
| `tart-vm/TOOL.md` | Manage local Tart VMs, capture their screens and send guest input through a detached supervisor, as one JSON object |
| `twenty-relay/TOOL.md` | Build the writers that install the mail relay, the login helper a person runs, and the argv that sets the relay to send or hold, as one JSON object |
| `vm-job/TOOL.md` | Build the argument vectors that start, poll, read back and release a tracked background job on one machine a router maps, build the texts for a scheduled job, and classify each answer, as one JSON object |

### Web

| Tool | Description |
|------|-------------|
| `pages-functions/TOOL.md` | The three files Cloudflare Pages takes for a site's functions folder, compiled offline |

<!-- /generated:index -->

## Everything a tool writes, and where

The one list; a tool's pages point here.

| What | Where | Which tools |
|------|-------|-------------|
| Plugin consent markers | `.wiser-consent` in the platform user-config directory (`gateway/SETUP.md` in `wiser`), mode 0600 in a directory created 0700 where absent, plus the matching copy marker at the plugin root | every tool that installs |
| Node packages | `node_modules/` in the tool's directory | `pages-functions`, about 210 MB, Wrangler and its `workerd` runtime |
| npm's cache and logs | npm's configured cache, `~/.npm` by default, outside this plugin | `pages-functions` |
| Wrangler's own working files while it compiles: a log, `.wrangler/tmp`, its preferences under a stand-in home directory, and its update check's cache under a stand-in temporary directory | one directory in the platform's temporary directory, `wiser-pages-functions-<random>`, removed when the run ends, including on failure | `pages-functions` |
| Tart VM records | `tart-vm/vms/<name>.json` under the platform user-config directory. New state directories use mode 0700 and records use mode 0600. Atomic writes use temporary siblings removed after publication | `tart-vm` |
| Tart supervisor sockets, run records, logs and name locks | `tart-vm/run/` beside the records, mode 0700. The VM name's first 12 SHA-256 hex digits identify its .sock, .json, .log and .lock files, mode 0600; `create`, `clone`, `start` and `delete` hold the .lock file's kernel lock while they run and remove the file when they return. The supervisor removes the socket and run record on exit, `start` and `delete` clear a pair a killed supervisor left, and `delete` removes the log | `tart-vm` |
| Tart VM files and cached OCI images | Tart's home, `~/.tart` by default or the directory set in `TART_HOME` | `tart-vm` |
