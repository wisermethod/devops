#!/bin/sh
rec() {
mkdir -p /var/lib/vm-job/scheduled || return 1
tmp="$record.tmp.$$"
printf '%s\n%s\n%s\n' "$1" "$2" "$3" > "$tmp" || return 1
mv "$tmp" "$record" || return 1
}
exec 9>/run/lock/vm-job.lock
flock -w 20 9 || { echo scheduled:lock-busy; exit 0; }
limit='3600'
script_path='/opt/twenty/backup/job.sh'
record=/var/lib/vm-job/scheduled/twenty-backup
u=; i=; k=0
if [ -f "$record" ]; then
exec 3< "$record"
IFS= read -r u <&3 || u=
IFS= read -r i <&3 || i=
IFS= read -r k <&3 || k=0
exec 3<&-
fi
case "$k" in 0|[1-9]|[1-9][0-9]*) ;; *) k=0 ;; esac
existing=$(systemctl list-units --all --plain --no-legend 'vm-job-*') || { echo enumeration-failed; exit 12; }
set -f; oifs=$IFS; IFS='
'
set -- $existing; IFS=$oifs; set +f
n=0; names=; only=
for line do
[ -z "$line" ] && continue
name=${line%% *}; name=${name%.service}
n=$((n + 1))
if [ "$n" -eq 1 ]; then only=$name; else only=; fi
[ -z "$names" ] && names=$name || names=$names,$name
done
released=
if [ "$n" -eq 1 ] && [ -n "$u" ] && [ "$only" = "$u" ]; then
rs=0
release_out=$(
unit=$u; id=$i
cur=$(systemctl show -p InvocationID --value "$unit.service")
st=$(systemctl show -p ActiveState --value "$unit.service")
sub=$(systemctl show -p SubState --value "$unit.service")
tasks=$(systemctl show -p TasksCurrent --value "$unit.service")
if [ "$cur" != "$id" ]; then echo "invocation-mismatch:$cur"; exit 13; fi
case "$st/$sub" in
  active/exited) ;;
  failed/*) case "$tasks" in ''|'[not set]'|0) ;; *) echo "processes-remain:$tasks"; exit 17 ;; esac ;;
  *) echo "not-finished:$st/$sub"; exit 14 ;;
esac
if [ "$st" = active ]; then systemctl stop "$unit.service"; else systemctl reset-failed "$unit.service"; fi
rc=$?
cat /proc/sys/kernel/random/uuid > /run/vm-job.token
exit "$rc"
) || rs=$?
if [ "$rs" -eq 0 ]; then released=1; echo "scheduled:released:$u"; fi
fi
if [ "$n" -gt 0 ] && [ -z "$released" ]; then
rec "$u" "$i" "$((k + 1))" || exit 1
echo "scheduled:skipped:$names"
exit 0
fi
expect=$(cat /run/vm-job.token 2>/dev/null || echo none)
job=$(cat "$script_path") || { echo scheduled:script-unreadable; exit 1; }
stamp=$(date -u +%Y%m%dT%H%M%SZ | tr 'A-Z' 'a-z')
rand=$(cat /proc/sys/kernel/random/uuid)
hex=$(printf '%.6s' "$rand")
unit="vm-job-twenty-backup-${stamp}-${hex}"
set -- 'dump'
sf=$(cat << 'E'
unit=$1; limit=$2; expect=$3; job=$4; shift 4
existing=$(systemctl list-units --all --plain --no-legend 'vm-job-*') || { echo enumeration-failed; exit 12; }
if [ -n "$existing" ]; then printf 'existing-job\n%s\n' "$existing"; exit 10; fi
cur=$(cat /run/vm-job.token 2>/dev/null || echo none)
if [ "$cur" != "$expect" ]; then echo "token-changed:$cur"; exit 15; fi
cat /proc/sys/kernel/random/uuid > /run/vm-job.token || { echo token-write-failed; exit 16; }
echo "token:$(cat /run/vm-job.token)"
systemd-run --unit="$unit" --description="background job $unit" --expand-environment=no -p Type=exec -p ExitType=cgroup -p RemainAfterExit=yes -p RuntimeMaxSec="$limit" -E DEBIAN_FRONTEND=noninteractive -E NEEDRESTART_SUSPEND=1 -- /bin/sh -c "$job" sh "$@" 2>&1
rc=$?
echo "start-exit:$rc"
exit "$rc"
E
)
R=$(command -v systemd-run) || { echo stop-post-setup-failed; exit 1; }
d=/run/vm-job-stop.$$
A=-p
B='ExecStopPost=/bin/sh /opt/twenty/backup/recover'
C=-p
D='TimeoutStopSec=1200'
um=$(umask); umask 077
mkdir -p "$d" || { umask "$um"; echo stop-post-setup-failed; exit 1; }
umask "$um"
printf '%s\n' '#!/bin/sh' 'exec "$R" "$A" "$B" "$C" "$D" "$@"' > "$d/systemd-run" || { rm -rf "$d"; echo stop-post-setup-failed; exit 1; }
chmod 700 "$d/systemd-run" || { rm -rf "$d"; echo stop-post-setup-failed; exit 1; }
PATH="$d:$PATH"; export PATH R A B C D
trap 'rm -rf "$d"' EXIT
status=0
out=$(set -- "$unit" "$limit" "$expect" "$job" "$@"; eval "$sf") || status=$?
case "$out" in *"Running as unit: $unit.service; invocation ID: "*"start-exit:0"*) ;; *) printf '%s\n' "$out"; exit "$status" ;; esac
inv=${out#*"invocation ID: "}
inv=${inv%%[!0-9a-f]*}
[ "${#inv}" -eq 32 ] || { printf '%s\n' "$out"; exit "$status"; }
rec "$unit" "$inv" 0 || exit 1
exit 0
