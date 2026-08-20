# Userland Runtime Contract

`noslop/index.html` is the only launcher. It accepts exact FW 13.60 and does
not select a neighboring offset profile.

`userland/index.html` runs these checkpoints in order:

1. Exact PS5 FW 13.60 and profile completeness.
2. WebKit primitive establishment with one bounded attempt.
3. Typed-array pair promotion and fake-cell release.
4. Worker ROP preparation with a `getpid` return proof.
5. Userland read/write/restore against a JavaScript backing store.
6. Module-base display and a `webkit_userland_rw` result.
7. A manually armed, read-only module preflight and bounded dump section.

The page has no kernel-stage button, credential mutation, kernel write, ELF
loader, payload sender, P2JB trigger, or Poopsploit trigger. Those paths remain
research-only until separate exact-13.60 evidence exists.

The on-screen event log is local and non-blocking. It intentionally does not
perform the synchronous `/log/` or RPC requests used by older launchers.

Serve the repository over HTTP with `npm run serve -- --host 0.0.0.0 --port 8080`
and open `/index.html` on the PS5 browser. The worker and ES modules must stay
on the same origin; do not open the page with `file://`.

The dump panel is intentionally locked until the userland proof passes. Its
preflight must pass before `Start Dump` becomes available. See
`docs/DUMP_RUNTIME.md` for the chunk and OOM contract.

## Hardware Interpretation

- `USERLAND PROOF PASSED` means only that the candidate WebKit chain established
  the userland primitive, prepared the worker ROP path, and restored a test word.
- It does not establish kernel read/write or any persistence.
- A hardware result must be recorded with the console firmware, clean-boot
  state, profile hash, attempt number, and full event log.
