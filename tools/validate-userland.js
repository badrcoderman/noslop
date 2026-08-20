const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertFile(relativePath) {
    const filePath = path.join(root, relativePath);
    if (!fs.statSync(filePath).isFile())
        throw new Error(`required userland file is missing: ${relativePath}`);
}

function assertLocalReferences(relativePath) {
    const html = read(relativePath);
    const base = path.dirname(path.join(root, relativePath));
    const referencePattern = /(?:src|href)="([^"]+)"/g;
    let match;
    while ((match = referencePattern.exec(html)) !== null) {
        const reference = match[1].split("?")[0].split("#")[0];
        if (!reference || reference.startsWith("http:") || reference.startsWith("https:")
            || reference.startsWith("data:") || reference.startsWith("mailto:"))
            continue;
        const target = path.resolve(base, reference);
        if (!fs.existsSync(target))
            throw new Error(`${relativePath} references missing asset: ${reference}`);
    }
}

[
    "index.html",
    "userland/index.html",
    "userland/core.js",
    "userland/mem.js",
    "userland/int64.js",
    "userland/main.js",
    "userland/rop.js",
    "userland/rop_slave.js",
    "userland/syscalls.js",
    "userland/module-dump.js",
    "userland/offsets/13.60.js",
    "tools/serve.js",
].forEach(assertFile);

assertLocalReferences("index.html");
assertLocalReferences("userland/index.html");

const launcher = read("index.html");
const runtime = read("userland/index.html");
const profile = read("userland/offsets/13.60.js");
const main = read("userland/main.js");
const server = read("tools/serve.js");

if (!launcher.includes('userland/index.html?go=1'))
    throw new Error("root launcher does not point to the userland proof");
if (!launcher.includes('TARGET = "13.60"'))
    throw new Error("root launcher target is not exact FW 13.60");
if (!runtime.includes("USERLAND-RW-PROOF") || !runtime.includes("kernel_escalation=disabled"))
    throw new Error("userland page is missing its proof contract");
if (!runtime.includes('"dumpPanel"') || !runtime.includes("module-dump.js"))
    throw new Error("userland page is missing the guarded dump section");
if (!runtime.includes("<progress id=\"dumpProgress\"")
    || !runtime.includes("dumpPreflightElement"))
    throw new Error("userland page is missing dump progress/preflight controls");
if (runtime.indexOf('<script src="./main.js') > runtime.indexOf("window.offsetsReady"))
    throw new Error("offset readiness is declared before main.js injects the profile");
if (/OFFSET_KERNEL_|OFFSET_KERNEL_/.test(profile))
    throw new Error("kernel offsets leaked into the userland profile");
if (/(?:poopsploit|p2jb|kexp|elfldr|setuid|allproc)/i.test(runtime))
    throw new Error("kernel or payload stage leaked into the userland launcher");
if (!main.includes('const supportedFirmwares = ["13.60"]'))
    throw new Error("userland runtime permits neighboring firmware");
if (!main.includes('./offsets/${window.fw_str}.js'))
    throw new Error("userland runtime does not load its local exact profile");
const dump = read("userland/module-dump.js");
if (!dump.includes("DUMP_CHUNK_BYTES = 0x4000")
    || !dump.includes("DUMP_MAX_BYTES = 0x4000000")
    || !dump.includes("buffer = new Uint8Array(plan.chunkBytes)")
    || /new Uint8Array\([^)]*(?:totalBytes|segment\.size|moduleSize)/.test(dump)
    || dump.includes("Promise.all"))
    throw new Error("dump runtime does not meet the bounded streaming contract");
for (const endpoint of ["/api/dump/preflight", "/api/dump/start", "/api/dump/chunk",
    "/api/dump/finish", "/api/dump/abort"]) {
    if (!server.includes(endpoint))
        throw new Error(`dump server is missing endpoint: ${endpoint}`);
}

console.log("userland contract: PASS (exact FW 13.60, userland proof only)");
