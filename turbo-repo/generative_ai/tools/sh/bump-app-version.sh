#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <semver>" >&2
  exit 1
fi

VERSION="$1"
ROOT_DIR="$(git rev-parse --show-toplevel)"

node - "$VERSION" "$ROOT_DIR" <<'NODE'
const fs = require("fs");
const path = require("path");

const [version, rootDir] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Expected semver without v prefix, got: ${version}`);
}

const files = [
  path.join(rootDir, "turbo-repo/apps/app/package.json"),
  path.join(rootDir, "turbo-repo/package-lock.json"),
];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (file.endsWith("package.json")) {
    data.version = version;
  } else {
    data.packages["apps/app"].version = version;
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
NODE
