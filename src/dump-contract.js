const crypto = require("node:crypto");
const fs = require("node:fs");

const MAX_DUMP_BYTES = 0x4000000;
const MIN_USERLAND_ADDRESS = 0x100000000n;
const MAX_USERLAND_ADDRESS = 0x7ffffffffffffn;

function parseAddress(value) {
    const text = String(value ?? "");
    if (!/^0x[0-9a-f]+$/i.test(text))
        throw new Error("base must be a hexadecimal address");
    const address = BigInt(text);
    if (address < MIN_USERLAND_ADDRESS || address > MAX_USERLAND_ADDRESS)
        throw new Error("base is outside the expected userland range");
    return address;
}

function validateDumpMetadata(metadata) {
    if (!metadata || metadata.firmware !== "13.60")
        throw new Error("dump firmware must be exact FW 13.60");
    if (!/^[A-Za-z0-9_.-]+$/.test(String(metadata.module ?? "")))
        throw new Error("dump module name is invalid");

    const base = parseAddress(metadata.base);
    const byteLength = Number(metadata.byteLength);
    if (!Number.isSafeInteger(byteLength) || byteLength <= 0 || byteLength > MAX_DUMP_BYTES)
        throw new Error("dump byteLength is outside the accepted range");

    return {
        firmware: metadata.firmware,
        module: metadata.module,
        base: `0x${base.toString(16)}`,
        byteLength,
    };
}

function sha256File(filePath) {
    const hash = crypto.createHash("sha256");
    hash.update(fs.readFileSync(filePath));
    return hash.digest("hex");
}

module.exports = {
    MAX_DUMP_BYTES,
    parseAddress,
    validateDumpMetadata,
    sha256File,
};
