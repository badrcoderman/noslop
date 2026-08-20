const profile = require("../profiles/13.60.json");

function isCapabilityEnabled(name) {
    const value = profile.capabilities[name];
    return value === true || value === "verified";
}

function canRunKernelPath() {
    return profile.firmware === "13.60"
        && profile.status === "hardware-verified"
        && isCapabilityEnabled("kernelExploit");
}

module.exports = {
    profile,
    isCapabilityEnabled,
    canRunKernelPath,
};
