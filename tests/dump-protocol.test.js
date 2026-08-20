const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const port = 19000 + (process.pid % 1000);
const dumpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "noslop-dump-"));
const baseUrl = `http://127.0.0.1:${port}`;
const startBody = {
    firmware: "13.60",
    module: "libkernel_web.sprx",
    base: "0x900000000",
    totalBytes: 4,
    chunkBytes: 4,
    segments: [{ index: 0, virtualAddress: 0, size: 4, fileOffset: 0 }],
};

const child = spawn(process.execPath, ["tools/serve.js", "--host", "127.0.0.1",
    "--port", String(port)], {
    cwd: root,
    env: { ...process.env, NOSLOP_DUMP_ROOT: dumpRoot },
    stdio: ["ignore", "pipe", "pipe"],
});

function waitForServer() {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("dump test server timeout")), 5000);
        const ready = data => {
            if (!String(data).includes("noslop server:")) return;
            clearTimeout(timer);
            resolve();
        };
        child.stdout.on("data", ready);
        child.stderr.on("data", data => {
            if (String(data).includes("Error")) {
                clearTimeout(timer);
                reject(new Error(String(data)));
            }
        });
        child.on("exit", code => {
            if (code !== null && code !== 0) {
                clearTimeout(timer);
                reject(new Error(`dump test server exited with ${code}`));
            }
        });
    });
}

async function request(pathname, options) {
    const response = await fetch(baseUrl + pathname, options);
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { }
    return { status: response.status, body };
}

async function run() {
    await waitForServer();

    const preflight = await request("/api/dump/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(startBody),
    });
    assert.equal(preflight.status, 200);
    assert.equal(preflight.body.maxChunkBytes, 0x4000);

    const tooLarge = await request("/api/dump/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...startBody, totalBytes: 0x4000001 }),
    });
    assert.equal(tooLarge.status, 413);

    const started = await request("/api/dump/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(startBody),
    });
    assert.equal(started.status, 200);
    const token = started.body.token;
    assert.match(token, /^[a-f0-9]{32}$/);

    const wrongOffset = await request("/api/dump/chunk", {
        method: "POST",
        headers: {
            "Content-Type": "application/octet-stream",
            "X-Noslop-Token": token,
            "X-Noslop-Offset": "1",
            "X-Noslop-Total": "4",
        },
        body: "TEST",
    });
    assert.equal(wrongOffset.status, 409);

    const chunk = await request("/api/dump/chunk", {
        method: "POST",
        headers: {
            "Content-Type": "application/octet-stream",
            "X-Noslop-Token": token,
            "X-Noslop-Offset": "0",
            "X-Noslop-Total": "4",
        },
        body: "TEST",
    });
    assert.equal(chunk.status, 200);
    assert.equal(chunk.body.nextOffset, 4);

    const finished = await request("/api/dump/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Noslop-Token": token },
        body: JSON.stringify({ firmware: "13.60", module: "libkernel_web.sprx" }),
    });
    assert.equal(finished.status, 200);
    assert.equal(finished.body.sha256,
        "94ee059335e587e501cc4bf90613e0814f00a7b08bc7c648fd865a2af6a22cc2");
    assert.equal(fs.readFileSync(finished.body.file, "utf8"), "TEST");

    console.log("dump protocol test: PASS");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => {
    child.kill();
    fs.rmSync(dumpRoot, { recursive: true, force: true });
});
