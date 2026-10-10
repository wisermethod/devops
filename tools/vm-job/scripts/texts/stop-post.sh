# Arm ExecStopPost for one starter run. p1, v1, p2 and v2 are the two
# systemd-run properties (-p and the value, twice). The starter text is not
# modified: a short-lived systemd-run on PATH prepends them and execs the
# real one. systemd-run takes -p anywhere before the command. Removed on
# EXIT. /run must be executable; a noexec /run fails closed.
vm_job_arm_stop_post() {
  R=$(command -v systemd-run) || return 1
  d=/run/vm-job-stop.$$
  A=$p1
  B=$v1
  C=$p2
  D=$v2
  old_umask=$(umask)
  umask 077
  mkdir -p "$d" || { umask "$old_umask"; return 1; }
  umask "$old_umask"
  cat > "$d/systemd-run" << 'SHIM' || { rm -rf "$d"; return 1; }
#!/bin/sh
exec "$R" "$A" "$B" "$C" "$D" "$@"
SHIM
  chmod 700 "$d/systemd-run" || { rm -rf "$d"; return 1; }
  PATH="$d:$PATH"
  export PATH R A B C D
  VM_JOB_STOP_DIR=$d
  export VM_JOB_STOP_DIR
  return 0
}
vm_job_disarm_stop_post() {
  if [ -n "${VM_JOB_STOP_DIR-}" ]; then
    rm -rf "$VM_JOB_STOP_DIR"
    VM_JOB_STOP_DIR=
  fi
}
p1=$1
v1=$2
p2=$3
v2=$4
starter=$5
shift 5
vm_job_arm_stop_post || { echo stop-post-setup-failed; exit 1; }
trap 'vm_job_disarm_stop_post' EXIT
/bin/sh -c "$starter" sh "$@"
rc=$?
exit "$rc"
