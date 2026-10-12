#!/usr/bin/env python3
"""Run a command with a controlling terminal that is not its standard output.

The pty is the child's controlling terminal, so /dev/tty reaches it on macOS
and Linux alike. Standard input is /dev/null; standard output and standard
error are pipes the caller reads.
"""

import json
import os
import select
import sys
import time


def drain(fds, deadline):
    chunks = {fd: bytearray() for fd in fds}
    open_fds = set(fds)
    while open_fds and time.monotonic() < deadline:
        ready, _, _ = select.select(list(open_fds), [], [], 0.2)
        for fd in ready:
            try:
                data = os.read(fd, 4096)
            except OSError:
                data = b""
            if not data:
                open_fds.discard(fd)
            else:
                chunks[fd].extend(data)
    return chunks


def main():
    if len(sys.argv) < 3 or sys.argv[1] != "--":
        sys.stderr.write("usage: tty-run.py -- command [arg...]\n")
        return 2
    command = sys.argv[2:]
    out_r, out_w = os.pipe()
    err_r, err_w = os.pipe()
    # forkpty makes the pty the child's controlling terminal (setsid and
    # TIOCSCTTY through login_tty); the child then moves standard output and
    # standard error onto the pipes, so only /dev/tty reaches the pty.
    pid, master = os.forkpty()
    if pid == 0:
        try:
            # macOS detaches a pty with no open slave, so one copy stays open.
            keep = os.dup(0)
            os.set_inheritable(keep, True)
            null = os.open(os.devnull, os.O_RDONLY)
            os.dup2(null, 0)
            os.dup2(out_w, 1)
            os.dup2(err_w, 2)
            for fd in (null, out_r, out_w, err_r, err_w):
                if fd > 2:
                    os.close(fd)
            os.execvp(command[0], command)
        except BaseException as error:
            os.write(2, f"tty-run: {error}\n".encode())
        os._exit(127)
    os.close(out_w)
    os.close(err_w)
    chunks = drain([out_r, err_r, master], time.monotonic() + 20)
    _, status = os.waitpid(pid, 0)
    for fd in (out_r, err_r, master):
        os.close(fd)
    code = os.waitstatus_to_exitcode(status) if hasattr(os, "waitstatus_to_exitcode") else (status >> 8)
    sys.stdout.write(json.dumps({
        "code": code,
        "stdout": chunks[out_r].decode("utf-8", "replace"),
        "stderr": chunks[err_r].decode("utf-8", "replace"),
        "tty": chunks[master].decode("utf-8", "replace"),
    }))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        sys.stderr.write(f"{error}\n")
        raise SystemExit(2)
