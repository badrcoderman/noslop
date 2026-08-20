const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(
    path.join(root, "manifests", "upstream-sources.json"), "utf8"
));
const profile = JSON.parse(fs.readFileSync(
    path.join(root, "profiles", "13.60.json"), "utf8"
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

for (const source of manifest.sources) {
    if (!source.name || !source.kind || !source.use)
        throw new Error("source entry is missing required provenance fields");
    if (source.kind === "git" && !/^[0-9a-f]{40}$/.test(source.commit || ""))
        throw new Error(`${source.name} is not pinned to an immutable commit`);
}

console.log(`manifest contract: PASS (${manifest.sources.length} sources)`);
