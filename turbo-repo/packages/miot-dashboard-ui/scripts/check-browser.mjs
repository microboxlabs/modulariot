import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import ts from "typescript";

// Check the generated artifact, not just the source entry: external hosts load
// this file without a bundler, an import map, or a separately installed React.
const artifact = new URL("../dist/browser/browser.js", import.meta.url);
const source = readFileSync(artifact, "utf8");
const imports = ts.preProcessFile(source, true, true).importedFiles;
if (imports.length > 0) {
  throw new Error(`Browser bundle contains unresolved imports: ${imports.map((item) => item.fileName).join(", ")}`);
}
const runtime = await import(artifact.href);
for (const name of ["mountDashboard", "defineDashboardElement", "createTextCardRegistry"]) {
  if (typeof runtime[name] !== "function") {
    throw new Error(`Browser bundle is missing ${name}`);
  }
}
console.log(JSON.stringify({
  browserBundleBytes: Buffer.byteLength(source),
  gzipBytes: gzipSync(source).byteLength,
  externalImports: imports.length,
  domFreeImport: true,
}));
