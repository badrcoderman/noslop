const fs = require("node:fs");
const path = require("node:path");
const {
    sha256File,
    validateDumpMetadata,
} = require("../src/dump-contract");

function usage() {
    console.error("usage: node tools/verify-module-dump.js --module NAME --file PATH --base 0xADDR");
    process.exitCode = 2;
}

function main() {
    const args = process.argv.slice(2);
    const values = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith("--") || args[i + 1] === undefined) {
            usage();
            return;
        }
        values[arg.slice(2)] = args[++i];
    }

    if (!values.module || !values.file || !values.base) {
        usage();
        return;
    }

    const filePath = path.resolve(values.file);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile())
        throw new Error(`dump file does not exist: ${filePath}`);

    const byteLength = fs.statSync(filePath).size;
    const metadata = validateDumpMetadata({
        firmware: "13.60",
        module: values.module,
        base: values.base,
        byteLength,
    });

    console.log(JSON.stringify({
        ...metadata,
        file: filePath,
        sha256: sha256File(filePath),
    }, null, 2));
}

main();
