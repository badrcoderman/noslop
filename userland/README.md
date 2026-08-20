# 13.60 Userland Runtime

This directory is the first runnable noslop stage. It is derived from the
local `slopkit-main (2)` WebKit/userland and worker implementation, with the
following deliberate boundaries:

- Exact FW 13.60 only; neighboring profiles are not loaded.
- The browser primitive, worker ROP preparation, and userland read/write/restore
  proof are enabled as candidate research stages.
- Kernel offsets, credential changes, kernel writes, ELF loaders, kernel
  payloads, and P2JB/Poopsploit adapters are not imported into the launcher.
- The profile remains unverified until exact 13.60 hardware and module evidence
  are recorded.

Open `../index.html` on the PS5 browser. The page requires the exact user-agent
firmware string `PlayStation 5/13.60` and adds `?go=1` only after that check.

The result is deliberately limited to `webkit_userland_rw`. A passing result
does not prove kernel read/write, XOM access, HV access, persistence, or a full
jailbreak.
