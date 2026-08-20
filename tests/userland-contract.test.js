const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

const launcher = read("index.html");
const runtime = read("userland/index.html");
const profile = read("userland/offsets/13.60.js");
const dump = read("userland/module-dump.js");
const server = read("tools/serve.js");

assert.match(launcher, /userland\/index\.html\?go=1/);
assert.match(launcher, /const TARGET = "13\.60"/);
assert.match(runtime, /const TARGET_FIRMWARE = "13\.60"/);
assert.match(runtime, /USERLAND-RW-PROOF/);
assert.match(runtime, /kernel_escalation=disabled/);
assert.match(runtime, /dumpPanel/);
assert.match(runtime, /module-dump\.js/);
assert.match(runtime, /<progress id="dumpProgress"/);
assert.ok(runtime.indexOf('<script src="./main.js') < runtime.indexOf("window.offsetsReady"));
assert.doesNotMatch(profile, /OFFSET_KERNEL_/);
assert.doesNotMatch(runtime, /(?:poopsploit|p2jb|kexp|elfldr|setuid|allproc)/i);
assert.match(dump, /DUMP_CHUNK_BYTES = 0x4000/);
assert.match(dump, /DUMP_MAX_BYTES = 0x4000000/);
assert.doesNotMatch(dump, /Promise\.all/);
for (const endpoint of ["/api/dump/preflight", "/api/dump/start", "/api/dump/chunk",
    "/api/dump/finish", "/api/dump/abort"])
    assert.ok(server.includes(endpoint));

console.log("userland contract test: PASS");
