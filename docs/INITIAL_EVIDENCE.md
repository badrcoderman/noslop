# Initial Evidence Map

This is the baseline for the FW 13.60 investigation. It deliberately separates
12.00/12.70 evidence from 13.60 claims.

## Hard Blocker

The local decrypted firmware corpus ends at FW 12.70. There is no exact 13.60
kernel image or module corpus in the workspace. Therefore no 13.60 kernel
behavior, offset, patch status, or exploit support can be claimed from the
current files.

## Existing High-Value Leads

These leads come from the external `research_12_00` workspace and require
forward validation against 13.60:

- `F-004`: IPMI multi-argument output-size asymmetry. The framework behavior was
  emulated, but end-to-end impact depends on a reachable handler.
- `F-019/F-020`: SceSysCore has a string-dispatched handler table and a raw IPC
  synchronization path. Handler enumeration and semantic size auditing are
  unfinished.
- `F-005/F-014`: WebRTC daemon is an IPMI server reachable by construction, but
  the audited handlers appeared defensive. Remaining handlers need coverage.
- `F-008`: HttpCache pool-overflow behavior was patched by 12.00. This is patch
  history and code-family intelligence, not a current 13.60 bug.
- `F-017`: media-parser arithmetic candidates are interesting only if their
  real host process is outside WebKit and reachable with attacker-controlled
  input.
- WebTransport and metadata parsers remain structural candidates until exact
  handler/data-flow evidence exists.

## Rejected Leads

- `libSceXml` overflow: real arithmetic issue, but the 12.00/12.70 corpus had
  no consumer or name reference, so it was unreachable in the examined system.
- Missing `libkernel_web` exports: sandbox-boundary markers, not vulnerabilities.
- Discord claims about `sys_fsc2h_ctrl` on 13.60: contradicted by developer
  responses and unsupported by exact firmware evidence.
- 12.xx P2JB/Poopsploit offsets: not 13.60 kernel support.

## Next Evidence Gate

Acquire exact 13.60 text for the following surfaces, in order:

1. `libSceIpmi.sprx`
2. `libSceGvMp4Parser.sprx`
3. `libSceAvPlayer.sprx`
4. `libSceMetadataReaderWriter.sprx`
5. `libSceEditMp4.sprx`
6. `libSceContentSearch.sprx`
7. `libSceWebTransport.sprx`
8. Relevant service and media-process binaries

Then compare candidate functions using the relocation-tolerant verifier. A
candidate advances only when its 13.60 code, consumer, input source, and safe
proof are all recorded.
