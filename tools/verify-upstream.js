const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifests", "upstream-sources.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function git(checkoutPath, args) {
    return execFileSync("git", ["-C", checkoutPath, ...args], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    }).trim();
}

for (const source of manifest.sources) {
    if (source.kind !== "git")
        continue;
    if (!source.checkoutPath)
        throw new Error(`${source.name} is missing checkoutPath`);

    const checkoutPath = path.resolve(root, source.checkoutPath);
    if (!fs.existsSync(path.join(checkoutPath, ".git")))
        throw new Error(`${source.name} checkout is missing: ${source.checkoutPath}`);

    const actualCommit = git(checkoutPath, ["rev-parse", "HEAD"]);
    if (actualCommit !== source.commit)
        throw new Error(`${source.name} commit mismatch: ${actualCommit}`);

    const dirty = git(checkoutPath, ["status", "--porcelain"]);
    if (dirty)
        throw new Error(`${source.name} checkout is dirty`);

    console.log(`${source.name}: PASS (${actualCommit})`);
}
