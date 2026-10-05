unit=$1; limit=$2; expect=$3; job=$4; shift 4
exec 9>/run/lock/vm-job.lock
flock -w 20 9 || { echo lock-busy; exit 11; }
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
