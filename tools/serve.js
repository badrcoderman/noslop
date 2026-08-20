const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const root = path.resolve(__dirname, "..");
const mime = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
};

function option(name, fallback) {
    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1] !== undefined
        ? process.argv[index + 1] : fallback;
}

const host = option("--host", process.env.NOSLOP_HOST || "127.0.0.1");
const port = Number(option("--port", process.env.NOSLOP_PORT || "8080"));
if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("port must be an integer from 1 through 65535");

function resolveRequest(requestUrl) {
    const pathname = decodeURIComponent(new URL(requestUrl, "http://noslop").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = path.resolve(root, relative);
    if (filePath !== root && !filePath.startsWith(root + path.sep))
        return null;
    return filePath;
}

const server = http.createServer((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("method not allowed\n");
        return;
    }

    let filePath;
    try {
        filePath = resolveRequest(request.url || "/");
    } catch {
        filePath = null;
    }
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("not found\n");
        return;
    }

    const contentType = mime[path.extname(filePath)] || "application/octet-stream";
    response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": contentType,
    });
    if (request.method === "HEAD") {
        response.end();
        return;
    }
    fs.createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
    console.log(`noslop server: http://${host}:${port}/`);
});
