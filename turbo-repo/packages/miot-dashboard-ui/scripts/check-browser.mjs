import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import ts from "typescript";

// Check the generated artifact, not just the source entry: external hosts load
// this file without a bundler, an import map, or a separately installed React.
for (const entry of ["browser", "browser-charts"]) {
  const artifact = new URL(`../dist/browser/${entry}.js`, import.meta.url);
  const source = readFileSync(artifact, "utf8");
  const imports = ts.preProcessFile(source, true, true).importedFiles;
  if (imports.length > 0) {
    throw new Error(`${entry} contains unresolved imports: ${imports.map((item) => item.fileName).join(", ")}`);
  }
  const runtime = await import(artifact.href);
  const names = ["mountDashboard", "defineDashboardElement", "createTextCardRegistry", "createPercentageValueRegistry", "createCircularStatRegistry", "createProgressStatRegistry", "createDataTableRegistry"];
  if (entry === "browser-charts") names.push("createChartRegistry");
  for (const name of names) {
    if (typeof runtime[name] !== "function") throw new Error(`${entry} is missing ${name}`);
  }
  console.log(JSON.stringify({entry,browserBundleBytes:Buffer.byteLength(source),gzipBytes:gzipSync(source).byteLength,externalImports:imports.length,domFreeImport:true}));
}
