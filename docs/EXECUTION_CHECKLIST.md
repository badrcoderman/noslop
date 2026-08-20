# Execution Checklist

## Before Adding Runtime Code

- [ ] Create the private GitHub repository.
- [ ] Pin upstream commits and record hashes.
- [ ] Run `npm run upstream:verify` after every upstream update.
- [ ] Review license and attribution status.
- [ ] Keep upstream trees separate from new code.
- [ ] Confirm exact FW 13.60 target.
- [ ] Confirm no kernel path is enabled by default.

## 13.60 Evidence Gate

- [ ] Obtain a trusted 13.60 module corpus or dump selected modules through the
      existing userland foothold.
- [ ] Record module base, size, firmware, and SHA-256.
- [ ] Run relocation-tolerant forward comparison against 12.00/12.70 candidates.
- [ ] Confirm the actual consumer/host process.
- [ ] Confirm attacker-controlled input reaches the candidate.
- [ ] Produce a safe static or emulated proof.

## Hardware Gate

- [ ] Fresh console state.
- [ ] One candidate per run.
- [ ] Stage log preserved before each operation.
- [ ] No blind retries after a crash.
- [ ] Power-cycle procedure documented.
- [ ] Result classified as candidate, crash, corruption, or vulnerability.

## Release Gate

- [ ] No unverified 13.60 kernel claim.
- [ ] No neighboring-firmware fallback.
- [ ] No opaque binary without hash and provenance.
- [ ] No public unauthenticated payload server.
- [ ] Tests and source manifest pass.
