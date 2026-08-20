# Source Export Evidence

The runtime design was derived from the three canonical Discord exports in
`/home/user/Projects`.

- `PS5 Research & Development - Development - testing [1026659785556381786].txt`:
  343099 lines, SHA-256 `5b8e204cd453fc6ef34b209214d6aeba69b698d052c2a664ffe393d2b629209f`.
- `PS5 Research & Development - Development - webkit.txt`: 8481 lines,
  SHA-256 `aae64cd522d62b4825e52abd700986322f863c2e25c658742c9e6693f7e7005c`.
- `PS5 Research & Development - Text Channels - questions-and-issues
  [1026658439155425360].txt`: 493309 lines, SHA-256
  `5c622794e59f5e47a1ffb89f836ae45b4a29b4e8eeae784cfca3a9fab81efa04`.

The additional file under `/home/user/Projects/s/` has the same channel name
but is an older, truncated 225700-line export ending in 2025. It contains no
unique engineering findings and is excluded from the primary evidence set.

## Runtime Constraints Extracted

- WebKit R/W, kernel R/W, XOM, HV access, and persistence are separate claims.
- The page size, worker affinity, worker return fingerprint, gadgets, and
  module offsets are firmware-specific.
- RPC and synchronous network logging must not block the exploit thread.
- Browser exit, fork cleanup, stale serialized history, and repeated runs can
  panic or exhaust the WebProcess.
- ELF loading and process handoff require their own proof and are not part of
  the userland launcher.

## Important Citations

- WebKit/userland and offset portability: `webkit.txt` lines 15-86,
  1013-1066, 6738-6763, and 8302-8347.
- Worker, ROP, cleanup, and browser-exit failures: `testing.txt` lines
  15-44, 3952-3991, 4264-4281, and 341763-341901.
- Network, RPC, and 13.xx uncertainty: `questions-and-issues.txt` lines
  7-32, 1331-1380, and 490203-490744.
- Later payload and process-handoff evidence: `testing.txt` lines
  225727-225757, 232900-232950, 320566-320646, and 342982-343086.
