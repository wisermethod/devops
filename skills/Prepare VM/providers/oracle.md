# Oracle Cloud Infrastructure

Oracle-specific steps and measured facts for Prepare VM. The enrollment contract in `../SKILL.md` governs. Nothing here overrides it.

## Shape and image

Measured 2026-09-22: the instances that were prepared were Ampere A1, one OCPU and 6 GB each, inside the Always Free allowance.

Unverified: the allowance's published ceiling, and Oracle's `out of capacity` answer when free-tier ARM capacity is exhausted. A launch that returns `out of capacity` has not created a machine. This skill does not provision one.

Measured 2026-09-22, on a stock Canonical Ubuntu 24.04 aarch64 image from Oracle's catalogue:

- `timeout --version` reports `timeout (GNU coreutils) 9.4`.
- `sshd_config` carries `Subsystem sftp /usr/lib/openssh/sftp-server` uncommented.

Not recorded for this image: `python3` with `os.O_NOFOLLOW` and `os.O_DIRECTORY`, which the router checks at registration. Ubuntu's cloud images run cloud-init on `python3`, so it is expected; the skill's Step 6 check settles it.

Unverified: Oracle Linux, and the Minimal images. A Minimal image is the one to suspect when `timeout` is not GNU coreutils.

## One-time SSH

The one-time path is Cloud Shell's ephemeral private network, into the machine's subnet. The person signs in. The person runs what follows. Public SSH is not opened. Where public SSH is already open, the person closes it so the only SSH ingress is the VCN.

Measured 2026-09-28: Cloud Shell runs in FIPS mode and refuses Ed25519 (`ED25519 keys are not allowed in FIPS mode`). The key is generated inside Cloud Shell as ECDSA P-384. Its public half is restricted with `from="<VCN CIDR>"` in `authorized_keys`. The person matches the host key fingerprint on screen before answering `yes`. The fingerprint is not copied into the conversation.

The Cloud Shell network bar reads ephemeral. When it reads public, the person switches it to the ephemeral private network for the machine's VCN and subnet, and uses that as the active network.

Once the machine answers through the router, the person removes any provisioning key that came from a computer they work from. Confirm before that edit. Measured 2026-10-05 on stock Canonical Ubuntu 24.04 aarch64: the key supplied at launch was in three accounts' `authorized_keys`, `ubuntu`'s, `opc`'s, and `root`'s, the last behind a forced command. Remove it from each, by the key's fingerprint, keeping the break-glass key. `skills/VM Security Audit/`'s keys section lists every account's keys by type and comment. On the router host a sandboxed router's own service may not see home directories, and that host's keys are removed over Cloud Shell.

## Host firewall

Measured 2026-09-22, on the same Ubuntu image: `netfilter-persistent` is enabled, so the chain survives reboot. The `INPUT` chain was these six lines, and port 22 was the only accept for new traffic:

```
-P INPUT ACCEPT
-A INPUT -m state --state RELATED,ESTABLISHED -j ACCEPT
-A INPUT -p icmp -j ACCEPT
-A INPUT -i lo -j ACCEPT
-A INPUT -p tcp -m state --state NEW -m tcp --dport 22 -j ACCEPT
-A INPUT -j REJECT --reject-with icmp-host-prohibited
```

There is no rule for `tailscale0`. Traffic on the tailnet meets the closing reject. `tailscale up` can succeed, and the admin console can show the device healthy, while nothing can reach it.

The fix adds accepts and removes nothing. Check, then insert, and save only when something changed. Proved 2026-09-26: a second run of this form reported no change.

```
changed=0
if ! iptables -C INPUT -i tailscale0 -j ACCEPT 2>/dev/null; then iptables -I INPUT -i tailscale0 -j ACCEPT; changed=1; fi
if ! iptables -C INPUT -p udp --dport 41641 -j ACCEPT 2>/dev/null; then iptables -I INPUT -p udp --dport 41641 -j ACCEPT; changed=1; fi
if [ "$changed" -eq 1 ]; then netfilter-persistent save; fi
```

`-C` finds a rule wherever it sits, so read the chain afterwards with `iptables -S INPUT`. The `tailscale0` accept must come before the closing `REJECT`. If it comes only after, the person confirms, `iptables -I INPUT 1 -i tailscale0 -j ACCEPT` puts one at the top, and `netfilter-persistent save` keeps it. Not run: no machine has shown an accept below the reject.

The first accept is what makes the tailnet usable. The second lets Tailscale negotiate a direct path on its default port. Without the second, the node still works by falling back to a relay. Confirm before this runs.

## Security lists

Measured 2026-09-28: with public SSH closed, the tailnet and Funnel still answered. No inbound security-list rule is needed for the tailnet or for Funnel. Tailscale connects outbound and falls back to relays. Funnel arrives through Tailscale, not through the VCN.

## Funnel on the router host

Funnel is the router host only.

Measured 2026-09-22: HTTPS certificates have to be enabled on the tailnet first, on the DNS page. They are off by default. Before the person enables them, tell them the console's own confirmation: the name of any machine that obtains a certificate is published in a public ledger, and it cannot be removed. What becomes searchable is the machine name plus the tailnet name. Only a machine that obtains a certificate appears.

Do not run `tailscale cert` to hurry provisioning while a session is driving. Some versions print the private key. Let the daemon provision the certificate. Retrying the public URL is enough.

Measured 2026-09-22, on Tailscale 1.102.4:

```
tailscale funnel --bg 8787
```

`--bg` exists, and the target may be a bare port. The command prints the public URL and the loopback target.

The double opt-in is the policy's `funnel` attribute and this command. A feature-preview entry for Funnel was not a third gate: with the attribute saved and that entry untouched, the command succeeded.

The first public request may fail at TLS and then succeed. The certificate is provisioned on first use. A 502 means Funnel works and nothing listens yet: the name resolved, TLS terminated, and the request reached loopback.

Measured 2026-09-22, from the node's capability map: ports 443, 8443, and 10000.
