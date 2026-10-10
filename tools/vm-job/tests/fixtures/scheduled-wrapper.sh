#!/bin/sh
rec() {
mkdir -p /var/lib/vm-job/scheduled || return 1
a=$1; b=$2
[ -n "$a" ] || a=none
[ -n "$b" ] || b=none
tmp="$record.tmp.$$"
printf '%s\n%s\n%s\n' "$a" "$b" "$3" > "$tmp" || return 1
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
if [ "$u" = none ]; then u=; fi
if [ "$i" = none ]; then i=; fi
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
if [ "$i" = pending ] && [ "$n" -eq 1 ] && [ -n "$u" ] && [ "$only" = "$u" ]; then
i=$(systemctl show -p InvocationID --value "$u.service") || i=
fi
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
  failed/''*) case "$tasks" in ''|'[not set]'|0) ;; *) echo "processes-remain:$tasks"; exit 17 ;; esac ;;
  *) echo "not-finished:$st/$sub"; exit 14 ;;
esac
if [ "$st" = active ]; then systemctl stop "$unit.service"; else systemctl reset-failed "$unit.service"; fi
rc=$?
cat /proc/sys/kernel/random/uuid > /run/vm-job.token
exit "$rc"
) || rs=$?
if [ "$rs" -ne 0 ]; then
first=$(printf '%s\n' "$release_out" | head -n 1)
echo "scheduled:release-refused:$first"
else
tries=0
while [ "$tries" -lt 30 ]; do
load=$(systemctl show -p LoadState --value "$u.service") || load=
if [ "$load" = not-found ]; then released=1; echo "scheduled:released:$u"; break; fi
tries=$((tries + 1))
[ "$tries" -lt 30 ] && sleep 1
done
if [ -z "$released" ]; then
active=$(systemctl show -p ActiveState --value "$u.service") || active=
echo "scheduled:release-incomplete:$u:$active"
rec "$u" "$i" "$((k + 1))" || exit 1
exit 0
fi
fi
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
A=-p
B='ExecStopPost=/bin/sh /opt/twenty/backup/recover'
C=-p
D='TimeoutStopSec=1200'
export R A B C D
um=$(umask); umask 077
d=$(mktemp -d /run/vm-job-stop.XXXXXX) || { umask "$um"; echo stop-post-setup-failed; exit 1; }
umask "$um"
printf '%s\n' '#!/bin/sh' 'exec "$R" "$A" "$B" "$C" "$D" "$@"' > "$d/systemd-run" || { rm -rf "$d"; echo stop-post-setup-failed; exit 1; }
chmod 700 "$d/systemd-run" || { rm -rf "$d"; echo stop-post-setup-failed; exit 1; }
trap 'rm -rf "$d"' EXIT
trap 'exit 143' TERM HUP INT
"$d/systemd-run" --version >/dev/null 2>&1 || { rm -rf "$d"; echo stop-post-setup-failed; exit 1; }
PATH="$d:$PATH"; export PATH
rec "$unit" pending "$k" || exit 1
status=0
out=$(set -- "$unit" "$limit" "$expect" "$job" "$@"; eval "$sf") || status=$?
case "$out" in
*"Running as unit: $unit.service; invocation ID: "*"start-exit:0"*)
inv=${out#*"invocation ID: "}
inv=${inv%%[!0-9a-f]*}
if [ "${#inv}" -eq 32 ]; then rec "$unit" "$inv" 0 || exit 1; exit 0; fi
printf 'scheduled:start-unparsed:%s\n' "$unit"
printf '%s\n' "$out"
exit "$status"
;;
*"start-exit:0"*)
printf 'scheduled:start-unparsed:%s\n' "$unit"
printf '%s\n' "$out"
exit "$status"
;;
*)
printf '%s\n' "$out"
exit "$status"
;;
esac
