# License Review

The repository now contains a reference-derived WebKit/userland runtime under
`userland/`, but it still does not redistribute opaque firmware or payload
binaries. The source remains private research material until its applicable
license and attribution requirements are resolved.

Known upstream status at project bootstrap:

- `pooP2JB-dev` claims MIT in source comments but has no visible license file.
- `poopicker` has no visible license file.
- `slopkit2/lapse.js` contains an AGPL notice.
- Local Slopkit snapshots expose credits but no complete license document.

The userland extraction excludes the Slopkit kernel-stage launcher, kernel
offset block, credential mutations, and payload-loader path. This boundary is
an engineering boundary, not a license grant.

Do not vendor or publish upstream code until the applicable license and credit
requirements are resolved.
