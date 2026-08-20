const ELF_MAGIC = 0x464c457f;
const ELF_CLASS_64 = 2;
const ELF_DATA_LITTLE = 1;
const PT_LOAD = 1;
const PF_X = 1;
const PROGRAM_HEADER_BYTES = 56;
const MAX_PROGRAM_HEADERS = 128;
const MAX_PROGRAM_HEADER_TABLE = 0x10000;
const SAMPLE_BYTES = 0x100;

export const DUMP_CHUNK_BYTES = 0x4000;
export const DUMP_MAX_BYTES = 0x4000000;

export const DUMP_MODULES = Object.freeze([
    {
        key: "libkernel_web",
        name: "libkernel_web.sprx",
        baseKey: "libKernelBase",
        description: "loaded userland syscall wrapper",
    },
    {
        key: "libSceNKWebKit",
        name: "libSceNKWebKit.sprx",
        baseKey: "libSceNKWebKitBase",
        description: "loaded WebKit module",
    },
    {
        key: "libSceLibcInternal",
        name: "libSceLibcInternal.sprx",
        baseKey: "libSceLibcInternalBase",
        description: "loaded libc internal module",
    },
]);

function asSafeNumber(value, label) {
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error(`${label} is outside the safe numeric range`);
    return Number(value);
}

function u16(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8)
        | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function u64(bytes, offset) {
    let value = 0n;
    for (let i = 7; i >= 0; i--)
        value = (value << 8n) | BigInt(bytes[offset + i]);
    return value;
}

function readBytes(p, address, count) {
    if (!p || typeof p.readInto !== "function")
        throw new Error("userland readInto is not available");
    const bytes = new Uint8Array(count);
    p.readInto(bytes, address, count);
    return bytes;
}

function add32(address, offset, label) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 0xffffffff)
        throw new Error(`${label} is outside the 32-bit module range`);
    return address.add32(offset);
}

function hex(value) {
    return `0x${value.toString(16)}`;
}

function parseExecutableSegments(p, base) {
    const header = readBytes(p, base, 0x40);
    if (u32(header, 0) !== ELF_MAGIC)
        throw new Error("module base does not contain an ELF header");
    if (header[4] !== ELF_CLASS_64 || header[5] !== ELF_DATA_LITTLE)
        throw new Error("module is not a little-endian ELF64 image");

    const programHeaderOffset = asSafeNumber(u64(header, 0x20), "program header offset");
    const programHeaderSize = u16(header, 0x36);
    const programHeaderCount = u16(header, 0x38);
    if (programHeaderSize < PROGRAM_HEADER_BYTES || programHeaderSize > 0x100)
        throw new Error(`invalid ELF program-header size: ${programHeaderSize}`);
    if (programHeaderCount < 1 || programHeaderCount > MAX_PROGRAM_HEADERS)
        throw new Error(`invalid ELF program-header count: ${programHeaderCount}`);

    const tableBytes = programHeaderSize * programHeaderCount;
    if (programHeaderOffset > 0xffffffff || tableBytes > MAX_PROGRAM_HEADER_TABLE)
        throw new Error("ELF program-header table is outside the accepted range");

    const table = readBytes(p, add32(base, programHeaderOffset, "program header offset"), tableBytes);
    const segments = [];
    let totalBytes = 0;
    for (let index = 0; index < programHeaderCount; index++) {
        const offset = index * programHeaderSize;
        if (u32(table, offset) !== PT_LOAD || (u32(table, offset + 4) & PF_X) === 0)
            continue;

        const virtualAddress = asSafeNumber(u64(table, offset + 0x10), "segment virtual address");
        const fileSize = asSafeNumber(u64(table, offset + 0x20), "segment file size");
        const memorySize = asSafeNumber(u64(table, offset + 0x28), "segment memory size");
        if (fileSize <= 0 || memorySize < fileSize || virtualAddress > 0xffffffff)
            throw new Error(`invalid executable segment ${index}`);
        if (fileSize > DUMP_MAX_BYTES - totalBytes)
            throw new Error("executable segments exceed the 64 MiB dump limit");

        segments.push({
            index,
            virtualAddress,
            size: fileSize,
            flags: u32(table, offset + 4),
            fileOffset: totalBytes,
        });
        totalBytes += fileSize;
    }

    if (!segments.length)
        throw new Error("ELF contains no executable PT_LOAD segment");
    return { segments, totalBytes };
}

function targetFor(key) {
    const target = DUMP_MODULES.find(item => item.key === key);
    if (!target)
        throw new Error(`unknown dump module: ${key}`);
    return target;
}

function check(checks, name, ok, detail) {
    const result = { name, ok: !!ok, detail: String(detail || "") };
    checks.push(result);
    return result.ok;
}

export class DumpPreflightError extends Error {
    constructor(checks) {
        super("module dump preflight failed");
        this.name = "DumpPreflightError";
        this.checks = checks;
    }
}

async function jsonRequest(fetchImpl, url, options) {
    const response = await fetchImpl(url, {
        cache: "no-store",
        ...options,
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { }
    if (!response.ok)
        throw new Error(body && body.error ? body.error : `${url} returned HTTP ${response.status}`);
    return body || {};
}

function baseText(address) {
    if (!address || typeof address.toString !== "function")
        throw new Error("module base is unavailable");
    return `0x${address.toString()}`;
}

function sampleSegment(p, base, segment) {
    const firstCount = Math.min(SAMPLE_BYTES, segment.size);
    const first = readBytes(p, add32(base, segment.virtualAddress, "segment address"), firstCount);
    let last = null;
    if (segment.size > firstCount) {
        const lastAddress = segment.virtualAddress + segment.size - firstCount;
        last = readBytes(p, add32(base, lastAddress, "segment tail address"), firstCount);
    }
    return {
        firstBytes: first.slice(0, 16),
        lastBytes: last ? last.slice(0, 16) : first.slice(0, 16),
    };
}

function proveReadWriteRestore(p) {
    if (typeof p.leakval !== "function" || typeof p.write4 !== "function")
        throw new Error("read/write proof API is unavailable");
    const probe = new Uint32Array([0x44554d50, 0x50524654]);
    const objectAddress = p.leakval(probe);
    const backingAddress = p.read8(objectAddress.add32(0x10));
    const original = p.read4(backingAddress);
    const marker = original === 0x13579bdf ? 0x2468ace0 : 0x13579bdf;
    let readback;
    let restored;
    try {
        p.write4(backingAddress, marker);
        readback = p.read4(backingAddress);
    } finally {
        p.write4(backingAddress, original);
        restored = p.read4(backingAddress);
    }
    if (readback !== marker || restored !== original)
        throw new Error("read/write/restore check failed");
}

export async function preflightDump({
    p,
    pairStatus,
    firmware,
    targetKey,
    onCheck = () => {},
    fetchImpl = globalThis.fetch,
}) {
    const checks = [];
    const pass = (name, detail) => {
        const result = check(checks, name, true, detail);
        onCheck(result);
    };
    const fail = (name, detail) => {
        const result = check(checks, name, false, detail);
        onCheck(result);
        throw new DumpPreflightError(checks);
    };

    if (firmware !== "13.60")
        fail("exact-firmware", firmware || "missing");
    pass("exact-firmware", firmware);

    if (!pairStatus || pairStatus.promoted !== true)
        fail("userland-pair", "read/write pair is not promoted");
    pass("userland-pair", "promoted");

    if (!p || typeof p.readInto !== "function" || typeof p.read4 !== "function"
        || typeof p.read8 !== "function")
        fail("read-api", "bounded read API is unavailable");
    pass("read-api", "readInto/read4 available");

    const target = targetFor(targetKey);
    let base;
    let parsed;
    try {
        base = p[target.baseKey];
        parsed = parseExecutableSegments(p, base);
    } catch (error) {
        fail("module-range", error.message);
    }
    pass("module-range", `${target.name} segments=${parsed.segments.length}`);

    if (parsed.totalBytes <= 0 || parsed.totalBytes > DUMP_MAX_BYTES)
        fail("size-limit", `${parsed.totalBytes} bytes`);
    pass("size-limit", `${parsed.totalBytes} bytes <= ${DUMP_MAX_BYTES}`);

    try {
        parsed.segments.forEach(segment => sampleSegment(p, base, segment));
    } catch (error) {
        fail("read-sample", error.message);
    }
    pass("read-sample", "first and tail bytes readable");

    try {
        proveReadWriteRestore(p);
    } catch (error) {
        fail("read-write-restore", error.message);
    }
    pass("read-write-restore", "temporary JavaScript word restored");

    if (DUMP_CHUNK_BYTES > 0x100000)
        fail("memory-budget", "chunk exceeds 1 MiB safety budget");
    pass("memory-budget", `one reusable ${DUMP_CHUNK_BYTES}-byte buffer`);

    if (typeof fetchImpl !== "function")
        fail("host-api", "fetch is unavailable");
    let host;
    try {
        host = await jsonRequest(fetchImpl, "/api/dump/preflight", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                firmware,
                module: target.name,
                base: baseText(base),
                totalBytes: parsed.totalBytes,
                chunkBytes: DUMP_CHUNK_BYTES,
            }),
        });
    } catch (error) {
        fail("host-api", error.message);
    }
    if (!Number.isSafeInteger(Number(host.maxChunkBytes))
        || Number(host.maxChunkBytes) < DUMP_CHUNK_BYTES)
        fail("host-api", `host chunk limit is ${host.maxChunkBytes}`);
    pass("host-api", "streaming endpoint ready");

    return {
        firmware,
        target,
        base,
        baseText: baseText(base),
        segments: parsed.segments,
        totalBytes: parsed.totalBytes,
        chunkBytes: DUMP_CHUNK_BYTES,
        checks,
    };
}

function progressUpdate(onProgress, doneBytes, totalBytes, startedAt, module, offset, chunk) {
    const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
    const rate = doneBytes / elapsedSeconds;
    onProgress({
        phase: "dumping",
        module,
        doneBytes,
        totalBytes,
        offset,
        chunk,
        percent: totalBytes ? (doneBytes / totalBytes) * 100 : 0,
        rate,
        etaSeconds: rate > 0 ? (totalBytes - doneBytes) / rate : null,
    });
}

async function rawRequest(fetchImpl, url, options) {
    const response = await fetchImpl(url, { cache: "no-store", ...options });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { }
    if (!response.ok)
        throw new Error(body && body.error ? body.error : `${url} returned HTTP ${response.status}`);
    return body || {};
}

export async function dumpModule({
    plan,
    p,
    onProgress = () => {},
    signal,
    fetchImpl = globalThis.fetch,
}) {
    if (!plan || !p || typeof p.readInto !== "function")
        throw new Error("dump plan or bounded read API is missing");
    if (plan.chunkBytes > DUMP_CHUNK_BYTES)
        throw new Error("dump plan exceeds the browser chunk budget");

    const start = await jsonRequest(fetchImpl, "/api/dump/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            firmware: plan.firmware,
            module: plan.target.name,
            base: plan.baseText,
            totalBytes: plan.totalBytes,
            chunkBytes: plan.chunkBytes,
            segments: plan.segments,
        }),
    });
    const token = start.token;
    if (!token)
        throw new Error("dump host did not return a session token");

    const buffer = new Uint8Array(plan.chunkBytes);
    const startedAt = performance.now();
    let doneBytes = 0;
    let lastProgressAt = 0;
    onProgress({ phase: "started", module: plan.target.name, doneBytes: 0,
        totalBytes: plan.totalBytes, percent: 0, rate: 0, etaSeconds: null });

    try {
        for (const segment of plan.segments) {
            let segmentOffset = 0;
            while (segmentOffset < segment.size) {
                if (signal && signal.aborted)
                    throw new Error("dump aborted by operator");
                const chunk = Math.min(plan.chunkBytes, segment.size - segmentOffset);
                const addressOffset = segment.virtualAddress + segmentOffset;
                p.readInto(buffer, plan.base.add32(addressOffset), chunk);
                await rawRequest(fetchImpl, "/api/dump/chunk", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/octet-stream",
                        "X-Noslop-Token": token,
                        "X-Noslop-Offset": String(doneBytes),
                        "X-Noslop-Total": String(plan.totalBytes),
                    },
                    body: buffer.subarray(0, chunk),
                });
                doneBytes += chunk;
                segmentOffset += chunk;
                const now = performance.now();
                if (now - lastProgressAt >= 250 || doneBytes === plan.totalBytes) {
                    lastProgressAt = now;
                    progressUpdate(onProgress, doneBytes, plan.totalBytes, startedAt,
                        plan.target.name, doneBytes, chunk);
                }
            }
        }

        const result = await jsonRequest(fetchImpl, "/api/dump/finish", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Noslop-Token": token },
            body: JSON.stringify({ firmware: plan.firmware, module: plan.target.name }),
        });
        onProgress({ phase: "finished", module: plan.target.name,
            doneBytes, totalBytes: plan.totalBytes, percent: 100, result });
        return result;
    } catch (error) {
        try {
            await jsonRequest(fetchImpl, "/api/dump/abort", {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Noslop-Token": token },
                body: JSON.stringify({ reason: String(error.message || error) }),
            });
        } catch { }
        onProgress({ phase: "aborted", module: plan.target.name, doneBytes,
            totalBytes: plan.totalBytes, error: String(error.message || error) });
        throw error;
    } finally {
        buffer.fill(0);
    }
}

export function formatBytes(value) {
    if (!Number.isFinite(value)) return "?";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

export function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--";
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
}
