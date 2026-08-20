# FW 13.60 Scope

## Objective

Find a reproducible security issue above the WebKit userland process on exact
FW 13.60. The desired result may be a cross-process privileged-service bug, an
IPC handler bug, a reachable media-parser bug, or a kernel bug supported by
exact 13.60 kernel evidence.

The project does not assume that a kernel bug exists. It records evidence and
promotes candidates only after reachability and safe reproduction are proven.

## Evidence Classes

1. Architectural observation
2. Interesting attack surface
3. Strong bug candidate
4. Reproducible crash
5. Reproducible memory corruption
6. Confirmed vulnerability

Strings, imports, offset files, Discord claims, and changed functions are not
vulnerability proof by themselves.

## Immediate Research Tracks

### 13.60 Module Evidence

The local decrypted firmware corpus stops at 12.70. Use either a trusted
decrypted 13.60 module set or the existing WebKit userland dump specification:

`/home/user/Documents/webp5/ps5-libs/research_12_00/data/dump_spec_13_60.md`

Priority modules:

- `libSceIpmi.sprx`
- `libSceGvMp4Parser.sprx`
- `libSceAvPlayer.sprx`
- `libSceMetadataReaderWriter.sprx`
- `libSceEditMp4.sprx`
- `libSceContentSearch.sprx`
- `libSceWebTransport.sprx`
- Relevant media and privileged service binaries

### Cross-Process Research

The highest-value current targets are:

- IPMI multi-argument output-size handling.
- SceSysCore method handlers.
- WebRTC privileged daemon handlers.
- WebTransport shared-memory and length fields.
- Media-parser bugs whose host process is outside WebKit.

An in-process WebKit corruption is not sufficient because WebKit userland is
already controlled.

### Kernel Research

Kernel analysis is blocked until exact 13.60 kernel evidence exists. Never
infer kernel behavior from `libkernel_web` wrappers or 12.xx offsets.

## Required Finding Record

Every finding must record firmware, binary, function, input source, reachability,
attacker control, facts, hypotheses, confidence, safe proof, and next action.
Continue the existing ledger at `F-021` in the external research workspace.
