---
name: twenty-relay
type: tool
category: operations
description: Build the writers that install the mail relay, the login helper a person runs, and the argv that sets the relay to send or hold, as one JSON object
version: 0.1.0
---

# twenty-relay

One JSON object that carries what a skill sends to put a Twenty install's mail relay on a machine and operate it: the writers that install the relay program, the helper a person runs to add, rotate or remove an organisation's login, and the `argv` that sets the relay to `send` or `hold`. It does not reach the machine.

## Context

Use it when `skills/Deploy Twenty/` installs an install's relay, changes a login, or writes the relay's state, and when `skills/Back Up Twenty/` restores one.

The relay is a small SMTP server that runs in its own container on the install's private Docker network, under the name `smtp-relay`, port 2525. Each organisation's shared mailbox in Twenty sends through it with a login bound to that organisation's own domain. Only the relay holds the upstream sending credentials, and only the relay talks to the upstream, over TLS with the certificate verified. It exists because Twenty's own SMTP client does not verify the certificate of the server it sends through, and because one upstream token reaches every domain on its account.

Do not use it to send mail, to reach a machine, or to read a machine's state. It reads only its own `payload/` files. A skill sends each writer and each `argv` it prints, unchanged, as one `vm.command.run` or inside a tracked job, as that skill says.

Classifier seam: none.

## Quick Start

```bash
node scripts/twenty-relay.js help
```

Usage text, with nothing installed and nothing configured. The tool needs Node 18 or later.

```bash
node scripts/twenty-relay.js writers --install-name crm
node scripts/twenty-relay.js login-helper --install-name crm --login acme --domain acme.example --upstream main --action add
node scripts/twenty-relay.js state --install-name crm --to hold
```

One JSON object on stdout. Nothing is written. Anything else, see Troubleshooting.

## Usage

| Command | Purpose | Writes a file |
|---------|---------|---------------|
| `node scripts/twenty-relay.js help` | Print usage and exit | No |
| `node scripts/twenty-relay.js writers --install-name <name>` | Print the ordered writers that install the relay program into `/opt/<name>/relay/app/` | No |
| `node scripts/twenty-relay.js login-helper --install-name <name> --login <login> --domain <domain> --upstream <upstream> --action add\|rotate\|remove` | Print the helper a person runs on the machine to change one login | No |
| `node scripts/twenty-relay.js state --install-name <name> --to send\|hold` | Print the `argv` that writes the relay's state | No |

| Option | Effect | Default |
|--------|--------|---------|
| `--install-name <name>` | The install's name, `^[a-z][a-z0-9]{1,12}$`, as `skills/Deploy Twenty/` names it | None; required by every command but `help` |
| `--login <login>` | The organisation's relay login, `^[a-z0-9-]{1,32}$` | None; required by `login-helper` |
| `--domain <domain>` | The organisation's sending domain, an ASCII hostname, stored lowercase | None; required by `login-helper` |
| `--upstream <upstream>` | The upstream this login sends through, `^[a-z0-9-]{1,32}$`, as named in `upstreams.json` | None; required by `login-helper` |
| `--action <action>` | `add`, `rotate`, or `remove` | None; required by `login-helper` |
| `--to <word>` | `send` or `hold` | None; required by `state` |
| `--help`, `-h` | Print usage and exit | Off |

No command takes `--env`. `--install`, the consent flag of tools that install packages, is refused by name: this tool installs nothing.

## Output

`help` prints usage text to stdout and exits 0.

`writers` prints one JSON object, exit 0:

| Field | Carries |
|-------|---------|
| `command` | `writers` |
| `install` | The install's name |
| `directory` | `/opt/<name>/relay/app` |
| `directoryMode`, `directoryOwner` | `0750` and `0:1000` |
| `fileMode`, `fileOwner` | `0640` and `0:1000` |
| `sha256` | `{ "headers.js", "relay.js", "package.json", "package-lock.json" }`, the hex sha256 of each payload file |
| `writers` | An ordered list of argv arrays, each `/bin/sh`, `-c`, and one script of at most 4096 code points. The first makes the directory with its mode and owner. Each file follows in the order of `sha256`, in chunks: the first chunk refuses a `.part` that is a symlink or not a regular file, and later chunks refuse a missing one; each appends through a quoted heredoc; the last checks the sha256, sets the mode and `0:1000`, refuses a destination that is a directory, moves the part with `mv -T --`, and prints `installed:<path>`. Run them in order. A writer whose call was uncertain or failed is never re-sent alone: that file is sent again from its first writer |

The frame reproduces `vm-job`'s `scheduled` writers, which that tool does not export, with one adaptation: the owner is `0:1000`, the image's `node` group, where `vm-job` sets `root:root`, so the container reads the files and nothing in it writes them.

`node_modules/` is not among the writers. The skill installs it on the machine with `npm ci --ignore-scripts --no-audit --no-fund` in a one-off container of the pinned image, which checks the lockfile's integrity hashes.

`login-helper` prints one JSON object, exit 0:

| Field | Carries |
|-------|---------|
| `command` | `login-helper` |
| `install`, `login`, `domain`, `upstream`, `action` | The values given, the domain lowercased |
| `helper` | The text of a POSIX `sh` script |
| `argv` | `sh`, `-c`, the helper, `sh`, then the install, login, domain, upstream and action |

The helper runs as root on the machine, in a shell the person holds outside the router; on Oracle that is the route `skills/Prepare VM/providers/oracle.md` names. It validates its five arguments against the patterns above. For `add` and `rotate` it reads 32 random bytes from `/dev/urandom` as the password and 16 as the salt, both in hex, **prints the password to `/dev/tty` and nowhere else**, and stops before writing anything if it cannot. It writes a new `logins.json` holding the salt and `sha256(salt + password)`, never the password, by a temporary file, `fsync`, mode `0640`, owner `0:1000`, and `mv -T --` into `/opt/<name>/relay/conf/`, then sends `SIGHUP` to the container `<name>-relay`. Standard output carries `login=`, `domain=` and `hash=`, the first eight hex characters of the stored hash.

It refuses, writing nothing:

- `add` of a login already present, or for a domain another login is bound to (`domain is already bound to login <login>`): an organisation's login is bound to its domain once.
- `rotate` or `remove` of a login that is absent, or whose stored domain differs from `--domain`.
- `add` or `rotate` naming an upstream `upstreams.json` does not carry.

`rotate` replaces the password and may move the login to another upstream; its domain never changes. Removing a login is what taking an organisation's shared mailbox off the relay means. The helper does not see whether the relay accepted the new file; the relay's `config` log line does, and the skill reads it.

`state` prints one JSON object, exit 0:

| Field | Carries |
|-------|---------|
| `command` | `state` |
| `install`, `to` | The values given |
| `argv` | `/bin/sh`, `-c`, the script, `sh` |

The script writes the four bytes `send` or `hold`, no newline, to `/opt/<name>/relay/conf/state` by a temporary file, mode `0640`, owner `0:1000` and `mv -T --`, then reads the relay's last `inflight count=` line from `docker logs --tail 400`. For `hold` it reads again each second until the count is `0` or 130 seconds have passed. It prints `state=<word>` and `inflight=<count>`, where the count is `unknown` when no such line was in the log. **A `hold` can take 130 seconds, longer than one direct call may last, so the skill runs it inside a tracked job; `send` returns at once.**

A refusal prints to stderr, leaves stdout empty, and exits 1. The message names the cause.

## The relay program

`payload/relay.js` with `payload/headers.js` is the program the container runs, `node /relay/relay.js`. It is shipped here so the writers can install it and the tests can run it; this tool never runs it.

**Pinned.** `smtp-server` exactly `3.19.17`, with its lockfile (`payload/package-lock.json`, lockfile version 3, integrity hashes present). The image is `node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1`, whose index carries arm64.

**On the machine.**

| Path in the container | On the machine | Access |
|-----------------------|----------------|--------|
| `/relay` | `/opt/<name>/relay/app` | read-only |
| `/conf` | `/opt/<name>/relay/conf`: `logins.json`, `upstreams.json`, `state` | read-only |
| `/secrets` | `/opt/<name>/relay/secrets`: `<upstream>.token` | read-only |
| `/journal` | `/opt/<name>/relay/journal`, owned `1000:1000`, mode `0750` | the one writable mount |

Directories are `0750` and files `0640`, owned `0:1000`, except the journal's directory. The container runs as `1000:1000` with a read-only root and a small `/tmp`.

**Configuration.** `logins.json` is a list of `{ login, domain, upstream, salt, sha256, created }`; `upstreams.json` a list of `{ name, host, port, user, token_file }`, where `token_file` is `/secrets/<name>.token`. For Cloudflare's Email Service an upstream is `smtp.mx.cloudflare.net`, port 465, user `api_token`. Each token file holds one token; trailing whitespace is trimmed. The relay reads all three at start and on `SIGHUP`, validates the whole configuration, and replaces the running one only if it is valid, logging `config hash=<hex> status=loaded`; an invalid one logs `status=refused` and the old one stays. An invalid configuration at start stops the process.

**Its rules**, summarised; `payload/relay.js` and `payload/headers.js` are the full statement.

- **Listening.** Port 2525. AUTH PLAIN and LOGIN required for every message, without TLS, because the network is the install's own. No STARTTLS, `SMTPUTF8`, `8BITMIME` or `CHUNKING` advertised; `SIZE 5242880`.
- **Limits.** 8 connections, 2 messages in flight across them (a third waits), 50 recipients, 120 seconds idle, and an absolute 120 seconds from the DATA command, after which the connection is destroyed. At most 5 MiB of a message is kept; more is read, discarded and answered 552.
- **AUTH.** A valid password always succeeds; throttling touches failures only. Three failures close the connection. A known login, or a source address, past 10 failures in a minute has each further failure answered 454 after one second. At most 4 checks run at once.
- **Sender.** `MAIL FROM`, the header `From` and any `Sender` must all be in the login's own domain, compared lowercase and exact, a subdomain not matching its parent. `MAIL FROM` outside it is 553; a parameter other than `SIZE` is 555. The header block must use CRLF only, carry exactly one `From`, at most one `Sender`, and no `Return-Path` or `Resent-*`; each mailbox must match a strict grammar (an address, or a display name of atoms, quoted strings or encoded words, then one `<address>`; no group, comment, route or second address). A refusal is 550 with no detail. The body is not read.
- **All or nothing.** At `MAIL FROM` the relay opens its own upstream session, verifies the certificate's chain and name before sending any credential, authenticates with the token, and mirrors each recipient. Every `RCPT` command the client sends is counted, including those `smtp-server` refuses itself before the relay's callback; if any was not accepted, the message is answered 554 "transaction incomplete" and the upstream gets `RSET` and no DATA.
- **Ambiguity.** An `intent` line is written to the journal and `fsync`ed before the message is sent upstream, and a `done` line after. If the final reply never reaches the client, the outcome is `ambiguous`: logged, answered 451 when possible, never retried. At start the relay marks every intent without a `done` as ambiguous and logs `journal ambiguous=<count>`. The journal rotates past 1 MiB, keeping unresolved intents, and carries no address, subject or body.
- **State.** `/conf/state` is read at each `MAIL FROM`; anything but exactly `send`, a missing file included, is answered 451 "sending held". A hold admits nothing new; transactions already admitted finish.
- **Upstream timeouts.** Connect 10 s, greeting 10 s, each command 30 s, the final reply 60 s, the whole transaction 100 s.
- **Log.** One `tx` line a transaction on standard output: login, domain, recipient count, bytes, outcome (`sent`, `refused:<code>`, `incomplete`, `ambiguous`, `held`) and the relay's upstream session id; and an `inflight count=` line whenever the count changes. No address, subject or body.

**How every RCPT is counted.** `smtp-server` 3.19.17 answers some `RCPT` commands in `SMTPConnection#handler_RCPT` (`lib/smtp-connection.js`) before the relay's `onRcptTo` runs: an empty or unparsable address, and a valueless parameter. The relay wraps that method on the prototype, once, to count the command before the library sees it. Moving `smtp-server` off 3.19.17 means reading that method again.

**Environment, for tests.** `RELAY_CONF`, `RELAY_SECRETS`, `RELAY_JOURNAL`, `RELAY_PORT` and `RELAY_HOST` move the paths and the port; `RELAY_CONNECT_TIMEOUT_MS`, `RELAY_GREETING_TIMEOUT_MS`, `RELAY_COMMAND_TIMEOUT_MS`, `RELAY_DATA_REPLY_TIMEOUT_MS`, `RELAY_TRANSACTION_TIMEOUT_MS`, `RELAY_IDLE_TIMEOUT_MS` and `RELAY_DATA_DEADLINE_MS` shrink the timeouts; `RELAY_EXTRA_CA` adds a test CA to the trust store; `RELAY_AUTH_SLOT_DELAY_MS` slows each AUTH check. On the machine none is set.

## Tests

```bash
cd payload && npm ci --ignore-scripts --no-audit --no-fund && cd .. && npm test
```

`npm test` runs every `tests/*.test.js`. `tests/cli.test.js` runs the writers into a temporary directory and checks the bytes, modes and owners; runs the login helper under a pseudo-terminal (`tests/tty-run.py`, Python 3) and checks the password reaches the terminal and nothing else; and runs the state script against a stand-in `docker`. `tests/headers.test.js` covers the header grammar. `tests/relay.test.js` runs the relay on a local port against a mock TLS upstream with a test CA generated in the test (`openssl`), for the rules above; the cases that need two source addresses use `127.0.0.1` and the machine's own LAN address, and fail where it has none. The `npm ci` in `payload/` is the tests' only install; the CLI needs none.

## Script Contract

Every script in this tool follows `wiser/standards/script-contract.md`. What a user meets when running it is `wiser/tools/RUNNING.md`. `scripts/twenty-relay.js` imports Node built-ins only, so the contract's dependency-install, `--env`, and system-dependency clauses have nothing to bind there and the tool carries no Dependencies section. `payload/` is not a script this tool runs: it is file content the writers carry to the machine, where its one package is installed from its lockfile.

## Troubleshooting

| What you see | What to do |
|--------------|------------|
| `--install is refused` | Pass the install's name with `--install-name` |
| `unknown option` or `unknown command` | Run `node scripts/twenty-relay.js help`. `--flag=value` is an unknown option |
| `was given more than once` | Pass that flag once |
| `needs a value` or `is required` | Pass the flag the message names, with its value |
| `--install-name must match` | Use the install's name as Deploy Twenty names it |
| `--login`, `--domain`, `--upstream`, `--action` or `--to` `must` | Use a value of the stated shape |
| `contains the writer delimiter` | A payload file contains `VMJOB_EOF`. Change it |
| `a <file> writer is` and `code points` | One line of that payload file is too long for a writer. Break the line |
| `writer:part-refused:<path>` | `<path>.part` is a symlink or not a regular file, or a later chunk found none. Send that file again from its first writer |
| `writer:sha-mismatch:<path>` | The assembled part does not match. Send that file again from its first writer |
| `writer:destination-refused:<path>` | The destination is a directory. Nothing was moved |
| The helper says `no terminal` or `could not print the password` | It was run without a terminal. Run it in an interactive shell; nothing was written |
| The helper says `already present`, `already bound`, `not present`, `bound to another domain` or `upstream is not configured` | Nothing was written. Use the action that matches the login's state, or configure the upstream first |
| `state` prints `inflight=unknown` | The relay's log held no count. Read the relay's log before treating the hold as settled |

## Success

- `node scripts/twenty-relay.js help` exits 0 and names every flag.
- `writers` exits 0 with one JSON object whose writers, run in order, leave each payload file byte-identical at `/opt/<name>/relay/app/` with mode `0640` and owner `0:1000`, the directory `0750`, each script at most 4096 code points.
- `login-helper` exits 0 with a helper that prints a 64-hex-character password to the terminal only, stores its salted hash, and refuses each case above without writing.
- `state` exits 0 with an `argv` that writes exactly `send` or `hold` and reports the in-flight count, waiting for zero on `hold`.
- A bad flag or value exits 1 with stdout empty, and the message names the cause.
- Nothing is written locally, and no command contacts a gateway or a machine.
