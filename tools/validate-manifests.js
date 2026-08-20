const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(
    path.join(root, "manifests", "upstream-sources.json"), "utf8"
));
const profile = JSON.parse(fs.readFileSync(
    path.join(root, "profiles", "13.60.json"), "utf8"
));
const userlandSources = JSON.parse(fs.readFileSync(
    path.join(root, "manifests", "userland-sources.json"), "utf8"
));
const researchExports = JSON.parse(fs.readFileSync(
    path.join(root, "manifests", "research-exports.json"), "utf8"
));

if (manifest.schemaVersion !== 1)
    throw new Error("unsupported upstream manifest schema");
if (!Array.isArray(manifest.sources) || manifest.sources.length < 5)
    throw new Error("upstream manifest is incomplete");
if (profile.firmware !== "13.60")
    throw new Error("profile is not exact FW 13.60");
if (profile.capabilities.kernelExploit !== false)
    throw new Error("13.60 kernel path must remain disabled at bootstrap");
if (profile.capabilities.p2jb !== false || profile.capabilities.poopsploit !== false)
    throw new Error("legacy kernel adapters must remain disabled for 13.60");
if (profile.entrypoint.path !== "userland/index.html"
    || profile.entrypoint.mode !== "userland-proof-only")
    throw new Error("13.60 entrypoint must be the userland-only proof runtime");
if (userlandSources.targetFirmware !== "13.60"
    || !Array.isArray(userlandSources.files)
    || userlandSources.files.length < 8)
    throw new Error("userland source manifest is incomplete");
if (userlandSources.files.some(file => file.destination === "userland/offsets/13.60.js"
    && !String(file.transformation).includes("OFFSET_KERNEL")))
    throw new Error("userland source manifest does not record kernel-offset removal");
if (!Array.isArray(researchExports.canonical) || researchExports.canonical.length !== 3)
    throw new Error("research export manifest must contain the three canonical exports");
if (researchExports.canonical.some(exportInfo => !/^[a-f0-9]{64}$/.test(exportInfo.sha256)
    || !Number.isInteger(exportInfo.lines) || exportInfo.lines <= 0))
    throw new Error("research export manifest has invalid line or hash metadata");

for (const source of manifest.sources) {
    if (!source.name || !source.kind || !source.use)
        throw new Error("source entry is missing required provenance fields");
    if (source.kind === "git" && !/^[0-9a-f]{40}$/.test(source.commit || ""))
        throw new Error(`${source.name} is not pinned to an immutable commit`);
}

console.log(`manifest contract: PASS (${manifest.sources.length} sources)`);
