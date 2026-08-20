const http = require("node:http");
const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");
const { validateDumpMetadata } = require("../src/dump-contract");

const root = path.resolve(__dirname, "..");
const dumpRoot = path.resolve(process.env.NOSLOP_DUMP_ROOT
    || path.join(root, "corpus", "dumps"));
const DUMP_CHUNK_BYTES = 0x4000;
const DUMP_MAX_BYTES = 0x4000000;
const MAX_JSON_BYTES = 64 * 1024;
const MAX_ACTIVE_SESSIONS = 4;
const mime = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
};
const sessions = new Map();

class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

function option(name, fallback) {
    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1] !== undefined
        ? process.argv[index + 1] : fallback;
}

const host = option("--host", process.env.NOSLOP_HOST || "127.0.0.1");
const port = Number(option("--port", process.env.NOSLOP_PORT || "8080"));
if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("port must be an integer from 1 through 65535");

function sendJson(response, statusCode, value) {
    const body = Buffer.from(JSON.stringify(value) + "\n", "utf8");
    response.writeHead(statusCode, {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": body.length,
    });
    response.end(body);
}

function sendText(response, statusCode, text) {
    const body = Buffer.from(text + "\n", "utf8");
    response.writeHead(statusCode, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": body.length,
    });
    response.end(body);
}

function readBody(request, maxBytes) {
    const declared = Number(request.headers["content-length"] || 0);
    if (declared > maxBytes) {
        request.resume();
        return Promise.reject(new HttpError(413, "request body exceeds the limit"));
    }

    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        let rejected = false;
        request.on("data", chunk => {
            if (rejected) return;
            total += chunk.length;
            if (total > maxBytes) {
                rejected = true;
                request.resume();
                reject(new HttpError(413, "request body exceeds the limit"));
                return;
            }
            chunks.push(chunk);
        });
        request.on("end", () => {
            if (!rejected) resolve(Buffer.concat(chunks, total));
        });
        request.on("error", error => {
            if (!rejected) reject(error);
        });
    });
}

async function readJson(request, maxBytes = MAX_JSON_BYTES) {
    const body = await readBody(request, maxBytes);
    try {
        return JSON.parse(body.toString("utf8"));
    } catch {
        throw new HttpError(400, "request body is not valid JSON");
    }
}

function requestPath(request) {
    return new URL(request.url || "/", "http://noslop");
}

function reportPath(filePath) {
    const relative = path.relative(root, filePath);
    return relative && !relative.startsWith("..") ? relative : filePath;
}

function tokenFrom(request) {
    const token = String(request.headers["x-noslop-token"] || "");
    if (!/^[a-f0-9]{32}$/.test(token))
        throw new HttpError(401, "dump session token is missing or invalid");
    return token;
}

function sessionFrom(request) {
    const token = tokenFrom(request);
    const session = sessions.get(token);
    if (!session)
        throw new HttpError(404, "dump session does not exist");
    return session;
}

function positiveInteger(value, name) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0)
        throw new HttpError(400, `${name} must be a positive safe integer`);
    return number;
}

function nonNegativeInteger(value, name) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0)
        throw new HttpError(400, `${name} must be a non-negative safe integer`);
    return number;
}

function validateSegments(segments, totalBytes) {
    if (!Array.isArray(segments) || segments.length < 1 || segments.length > 32)
        throw new HttpError(400, "segments must contain 1 through 32 entries");
    let cursor = 0;
    const normalized = segments.map(segment => {
        const index = nonNegativeInteger(segment.index, "segment index");
        const virtualAddress = nonNegativeInteger(segment.virtualAddress, "segment virtualAddress");
        const size = positiveInteger(segment.size, "segment size");
        const fileOffset = Number(segment.fileOffset);
        if (!Number.isSafeInteger(fileOffset) || fileOffset !== cursor)
            throw new HttpError(400, "segment file offsets must be contiguous");
        cursor += size;
        if (cursor > DUMP_MAX_BYTES)
            throw new HttpError(413, "segments exceed the dump limit");
        return { index, virtualAddress, size, fileOffset };
    });
    if (cursor !== totalBytes)
        throw new HttpError(400, "segment sizes do not equal totalBytes");
    return normalized;
}

function validateStart(body) {
    const totalBytes = positiveInteger(body.totalBytes, "totalBytes");
    if (totalBytes > DUMP_MAX_BYTES)
        throw new HttpError(413, "totalBytes exceeds the 64 MiB limit");
    const metadata = validateDumpMetadata({
        firmware: body.firmware,
        module: body.module,
        base: body.base,
        byteLength: totalBytes,
    });
    const chunkBytes = positiveInteger(body.chunkBytes, "chunkBytes");
    if (chunkBytes > DUMP_CHUNK_BYTES)
        throw new HttpError(413, "chunkBytes exceeds the 16 KiB limit");
    const segments = validateSegments(body.segments, totalBytes);
    return { ...metadata, totalBytes, chunkBytes, segments };
}

async function dumpPreflight(request, response) {
    const body = await readJson(request);
    const totalBytes = positiveInteger(body.totalBytes, "totalBytes");
    if (totalBytes > DUMP_MAX_BYTES)
        throw new HttpError(413, "totalBytes exceeds the 64 MiB limit");
    validateDumpMetadata({
        firmware: body.firmware,
        module: body.module,
        base: body.base,
        byteLength: totalBytes,
    });
    const chunkBytes = positiveInteger(body.chunkBytes, "chunkBytes");
    if (chunkBytes > DUMP_CHUNK_BYTES)
        throw new HttpError(413, "chunkBytes exceeds the 16 KiB limit");
    sendJson(response, 200, {
        ok: true,
        maxChunkBytes: DUMP_CHUNK_BYTES,
        maxDumpBytes: DUMP_MAX_BYTES,
        storage: "sequential-file-stream",
    });
}

async function dumpStart(request, response) {
    if (sessions.size >= MAX_ACTIVE_SESSIONS)
        throw new HttpError(429, "too many active dump sessions");
    const metadata = validateStart(await readJson(request));
    await fsp.mkdir(dumpRoot, { recursive: true });
    const token = crypto.randomBytes(16).toString("hex");
    const sessionDir = path.join(dumpRoot, token);
    await fsp.mkdir(sessionDir, { recursive: true });
    const filePath = path.join(sessionDir, `${metadata.module}.bin`);
    const session = {
        token,
        metadata,
        sessionDir,
        filePath,
        nextOffset: 0,
        busy: false,
        hash: crypto.createHash("sha256"),
    };
    sessions.set(token, session);
    sendJson(response, 200, { ok: true, token, nextOffset: 0 });
}

async function dumpChunk(request, response) {
    const session = sessionFrom(request);
    if (session.busy)
        throw new HttpError(409, "dump session already has an active chunk");
    session.busy = true;
    try {
        const offset = Number(request.headers["x-noslop-offset"]);
        const total = Number(request.headers["x-noslop-total"]);
        if (!Number.isSafeInteger(offset) || offset !== session.nextOffset)
            throw new HttpError(409, "chunk offset is not the next sequential offset");
        if (!Number.isSafeInteger(total) || total !== session.metadata.totalBytes)
            throw new HttpError(409, "chunk total does not match the dump session");

        const body = await readBody(request, session.metadata.chunkBytes);
        if (body.length < 1)
            throw new HttpError(400, "empty dump chunks are not allowed");
        if (offset + body.length > session.metadata.totalBytes)
            throw new HttpError(409, "chunk exceeds the dump size");

        await fsp.appendFile(session.filePath, body);
        session.hash.update(body);
        session.nextOffset += body.length;
        sendJson(response, 200, { ok: true, nextOffset: session.nextOffset });
    } finally {
        session.busy = false;
    }
}

async function dumpFinish(request, response) {
    const session = sessionFrom(request);
    const body = await readJson(request);
    if (body.firmware !== session.metadata.firmware || body.module !== session.metadata.module)
        throw new HttpError(409, "finish metadata does not match the dump session");
    if (session.nextOffset !== session.metadata.totalBytes)
        throw new HttpError(409, "dump is incomplete");

    const sha256 = session.hash.digest("hex");
    const manifest = {
        ...session.metadata,
        file: reportPath(session.filePath),
        sha256,
        completedAt: new Date().toISOString(),
        transport: "noslop-sequential-chunk-v1",
    };
    const manifestPath = path.join(session.sessionDir, "manifest.json");
    await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    sessions.delete(session.token);
    sendJson(response, 200, {
        ok: true,
        file: manifest.file,
        manifest: reportPath(manifestPath),
        sha256,
        byteLength: session.metadata.totalBytes,
    });
}

async function dumpAbort(request, response) {
    const session = sessionFrom(request);
    sessions.delete(session.token);
    await fsp.rm(session.sessionDir, { recursive: true, force: true });
    sendJson(response, 200, { ok: true, aborted: true });
}

function resolveStaticRequest(request) {
    const pathname = decodeURIComponent(requestPath(request).pathname);
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    if (relative === "corpus" || relative.startsWith("corpus/"))
        return null;
    const filePath = path.resolve(root, relative);
    if (filePath !== root && !filePath.startsWith(root + path.sep))
        return null;
    return filePath;
}

async function staticRequest(request, response) {
    if (request.method !== "GET" && request.method !== "HEAD") {
        sendText(response, 405, "method not allowed");
        return;
    }
    let filePath;
    try { filePath = resolveStaticRequest(request); } catch { filePath = null; }
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        sendText(response, 404, "not found");
        return;
    }

    const contentType = mime[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": contentType });
    if (request.method === "HEAD") {
        response.end();
        return;
    }
    fs.createReadStream(filePath).pipe(response);
}

async function handleRequest(request, response) {
    const pathname = requestPath(request).pathname;
    if (request.method === "POST" && pathname === "/api/dump/preflight")
        return dumpPreflight(request, response);
    if (request.method === "POST" && pathname === "/api/dump/start")
        return dumpStart(request, response);
    if (request.method === "POST" && pathname === "/api/dump/chunk")
        return dumpChunk(request, response);
    if (request.method === "POST" && pathname === "/api/dump/finish")
        return dumpFinish(request, response);
    if (request.method === "POST" && pathname === "/api/dump/abort")
        return dumpAbort(request, response);
    return staticRequest(request, response);
}

const server = http.createServer((request, response) => {
    handleRequest(request, response).catch(error => {
        if (response.headersSent) {
            response.destroy(error);
            return;
        }
        const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
        sendJson(response, statusCode, { ok: false, error: error.message || String(error) });
    });
});

server.listen(port, host, () => {
    console.log(`noslop server: http://${host}:${port}/`);
    console.log(`dump storage: ${dumpRoot}`);
});
