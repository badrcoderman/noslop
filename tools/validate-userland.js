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
    "userland/offsets/13.60.js",
    "tools/serve.js",
].forEach(assertFile);

assertLocalReferences("index.html");
assertLocalReferences("userland/index.html");

const launcher = read("index.html");
const runtime = read("userland/index.html");
const profile = read("userland/offsets/13.60.js");
const main = read("userland/main.js");

if (!launcher.includes('userland/index.html?go=1'))
    throw new Error("root launcher does not point to the userland proof");
if (!launcher.includes('TARGET = "13.60"'))
    throw new Error("root launcher target is not exact FW 13.60");
if (!runtime.includes("USERLAND-RW-PROOF") || !runtime.includes("kernel_escalation=disabled"))
    throw new Error("userland page is missing its proof contract");
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

console.log("userland contract: PASS (exact FW 13.60, userland proof only)");
