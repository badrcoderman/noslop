# noslop

FW 13.60 post-WebKit security research.

`noslop` contains a runnable, exact-FW-13.60 WebKit userland proof stage and
investigates
whether a separate, reachable bug exists in a privileged service, IPC handler,
media process, or kernel boundary. It is not a claim that P2JB or Poopsploit
supports FW 13.60.

## Scope

- Target: exact PS5 FW 13.60.
- Starting capability: WebKit userland RCE and userland arbitrary read/write.
- Primary goal: identify a reproducible bug above the WebKit process boundary.
- Secondary goal: investigate a kernel bug when exact 13.60 kernel evidence is
  available.
- Evidence standard: source commit, exact firmware, reachability, input control,
  and a reproducible safe proof.

The project does not use neighboring firmware offsets as 13.60 support. A
profile remains `candidate` until its module and hardware evidence are recorded.

## Source Boundaries

Reviewed upstream material is recorded in `manifests/upstream-sources.json`.
Upstream trees remain reference inputs. New code belongs under `src/` and must
not silently combine the Slopkit and P2JB kernel paths.

- Slopkit main (2): WebKit/userland and worker reference.
- Slopkit2: Lapse/runtime and entrypoint reference.
- pooP2JB-dev: P2JB/Poopsploit, preflight, loader, and diagnostics reference.
- poopicker: selector UI reference only.

## Current Status

- Profile contract: implemented.
- Root and userland entrypoints: implemented as a userland-proof-only runtime.
- Userland read/write proof: candidate runtime, not hardware-verified.
- 13.60 kernel corpus: not available locally.
- 13.60 module acquisition: next research stage.
- Kernel escalation: not claimed.
- P2JB/Poopsploit: reference-only and disabled for 13.60.

The current evidence map is in `docs/INITIAL_EVIDENCE.md`. Local corpus and
acquisition status are recorded in `manifests/local-evidence.json`.

## Local Checks

```text
npm test
npm run check
npm run upstream:verify
```

Serve the pages over HTTP so ES modules and the worker use the same origin:

```text
npm run serve -- --host 0.0.0.0 --port 8080
```

Open the host's LAN address from the PS5 User's Guide. Do not use a
`file://` URL for the userland page.

When a 13.60 module dump is available, verify its metadata and hash without
loading it into the exploit runtime:

```text
node tools/verify-module-dump.js --module libSceIpmi.sprx --file ./dump.bin --base 0x900000000
```

The repository contains no opaque firmware binaries, kernel payloads, or
production kernel exploit path. The userland source under `userland/` is
reference-derived and remains subject to license review and exact-FW hardware
validation.
