const assert = require("node:assert/strict");
const fs = require("node:fs");
const { profile, isCapabilityEnabled, canRunKernelPath } = require("../src/profile");
const { validateDumpMetadata } = require("../src/dump-contract");

const evidence = JSON.parse(fs.readFileSync("manifests/local-evidence.json", "utf8"));
const findingSchema = JSON.parse(fs.readFileSync("findings/schema.json", "utf8"));
const userlandSources = JSON.parse(fs.readFileSync("manifests/userland-sources.json", "utf8"));
const researchExports = JSON.parse(fs.readFileSync("manifests/research-exports.json", "utf8"));

assert.equal(profile.firmware, "13.60");
assert.equal(profile.status, "candidate");
assert.equal(isCapabilityEnabled("userlandRce"), true);
assert.equal(isCapabilityEnabled("kernelExploit"), false);
assert.equal(profile.capabilities.p2jb, false);
assert.equal(profile.capabilities.poopsploit, false);
assert.equal(canRunKernelPath(), false);
assert.equal(evidence.targetFirmware, "13.60");
assert.equal(evidence.localCorpus.exact13_60, false);
assert.equal(evidence.existingResearch.nextFinding, "F-021");
assert.equal(userlandSources.targetFirmware, "13.60");
assert.equal(userlandSources.files.length, 8);
assert.match(userlandSources.files.find(file => file.destination === "userland/offsets/13.60.js").transformation,
    /OFFSET_KERNEL/);
assert.equal(researchExports.canonical.length, 3);
assert.equal(researchExports.canonical[0].lines, 343099);
assert.equal(researchExports.supplemental[0].status, "superseded-truncated-subset");
assert.equal(findingSchema.properties.id.pattern, "^F-[0-9]{3}$");
assert.deepEqual(validateDumpMetadata({
    firmware: "13.60",
    module: "libSceIpmi.sprx",
    base: "0x900000000",
    byteLength: 0x1000,
}), {
    firmware: "13.60",
    module: "libSceIpmi.sprx",
    base: "0x900000000",
    byteLength: 0x1000,
});
assert.throws(() => validateDumpMetadata({
    firmware: "13.20",
    module: "libSceIpmi.sprx",
    base: "0x900000000",
    byteLength: 0x1000,
}), /exact FW 13\.60/);
assert.throws(() => validateDumpMetadata({
    firmware: "13.60",
    module: "libSceIpmi.sprx",
    base: "0x900000000",
    byteLength: 0x4000001,
}), /byteLength/);

console.log("profile contract: PASS");
