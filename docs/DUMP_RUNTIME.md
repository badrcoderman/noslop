# Module Dump Runtime

The dump section appears only after the userland proof passes. It is manually
armed in two steps:

1. `Run Preflight` performs checks without starting a dump.
2. `Start Dump` begins only after preflight succeeds and the operator clicks it.

## Preflight

Preflight checks exact firmware, pair promotion, the bounded `readInto` API, the
ELF header at the selected loaded module base, executable `PT_LOAD` ranges,
first/tail samples, a temporary read/write/restore word, the 64 MiB limit, the
16 KiB chunk budget, and the host upload handshake.

If any check fails, no bulk memory read or host session is started. The runtime
does not guess a module size from a neighboring firmware or a stale offset.

## OOM Boundary

- The browser allocates one reusable 16 KiB transfer buffer.
- ELF headers, program-header tables, and samples are bounded small allocations.
- Module-sized `ArrayBuffer`, `Blob`, and `Promise.all` patterns are not used.
- Each chunk is read, uploaded, acknowledged, and then reused sequentially.
- The host appends each chunk directly to a file and hashes it incrementally.
- Out-of-order chunks are rejected with HTTP 409.
- A failed or aborted session is removed from the host dump directory.
- The original large WebKit carrier reference is dropped before dump controls are
  enabled, followed by an idle turn for memory relief.

The total dump limit is 64 MiB per module file. The current page handles modules
already loaded in the WebProcess. Loading additional privileged modules through
module APIs is a separate evidence-gated stage.

## Output

Successful sessions are written outside Git under:

```text
corpus/dumps/<session-token>/
  <module>.sprx.bin
  manifest.json
```

The manifest contains exact firmware, module, base, mapped executable segment
metadata, byte length, transport version, completion time, and SHA-256.

The host server binds to `127.0.0.1` by default. Use an explicit LAN bind only
on an isolated, authorized research network:

```text
npm run serve -- --host 0.0.0.0 --port 8080
```
