# Arm ExecStopPost for one starter run. p1, v1, p2 and v2 are the two
# systemd-run properties (-p and the value, twice). The starter text is not
# modified: a short-lived systemd-run prepends them and execs the real one.
# systemd-run takes -p anywhere before the command. mktemp allocates the
# directory, and that directory is the only one removed. EXIT removes it.
# TERM, HUP and INT exit 143 so that removal runs. The shim is probed by its
# absolute path before anything starts. If the probe cannot execute it,
# including on a noexec mount, the directory is removed, the driver prints
# stop-post-setup-failed, and nothing is started.
vm_job_arm_stop_post() {
  R=$(command -v systemd-run) || return 1
  A=$p1
  B=$v1
  C=$p2
  D=$v2
  export R A B C D
  old_umask=$(umask)
  umask 077
  d=$(mktemp -d /run/vm-job-stop.XXXXXX) || { umask "$old_umask"; return 1; }
  umask "$old_umask"
  cat > "$d/systemd-run" << 'SHIM' || { rm -rf "$d"; return 1; }
#!/bin/sh
exec "$R" "$A" "$B" "$C" "$D" "$@"
SHIM
  chmod 700 "$d/systemd-run" || { rm -rf "$d"; return 1; }
  VM_JOB_STOP_DIR=$d
  export VM_JOB_STOP_DIR
  trap 'vm_job_disarm_stop_post' EXIT
  trap 'exit 143' TERM HUP INT
  "$d/systemd-run" --version >/dev/null 2>&1 || { vm_job_disarm_stop_post; return 1; }
  PATH="$d:$PATH"
  export PATH
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
/bin/sh -c "$starter" sh "$@"
rc=$?
exit "$rc"
