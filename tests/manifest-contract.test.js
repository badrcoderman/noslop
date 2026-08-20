const assert = require("node:assert/strict");
const { profile, isCapabilityEnabled, canRunKernelPath } = require("../src/profile");

assert.equal(profile.firmware, "13.60");
assert.equal(profile.status, "candidate");
assert.equal(isCapabilityEnabled("userlandRce"), true);
assert.equal(isCapabilityEnabled("kernelExploit"), false);
assert.equal(profile.capabilities.p2jb, false);
assert.equal(profile.capabilities.poopsploit, false);
assert.equal(canRunKernelPath(), false);

console.log("profile contract: PASS");
