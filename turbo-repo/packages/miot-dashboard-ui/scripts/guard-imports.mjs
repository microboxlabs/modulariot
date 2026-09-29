import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SOURCE = fileURLToPath(new URL("../src", import.meta.url));
const ALLOWED = new Set(["@microboxlabs/miot-dashboard-contract/document"]);

/** Pure entry imports cannot pull in a framework, server or host application. */
export function importProblems(source, file, root = SOURCE) {
  return ts
    .preProcessFile(source, true, true)
    .importedFiles.map(({ fileName }) => fileName)
    .filter((specifier) => {
      if (ALLOWED.has(specifier)) return false;
      if (!specifier.startsWith("./") && !specifier.startsWith("../"))
        return true;
      const target = relative(root, resolve(dirname(file), specifier));
      return target === ".." || target.startsWith("../");
    });
}

function* filesUnder(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) yield* filesUnder(file);
    else if (/\.[cm]?[jt]sx?$/.test(file) && !/\.test\.[jt]sx?$/.test(file))
      yield file;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = [...filesUnder(SOURCE)].flatMap((file) =>
    importProblems(readFileSync(file, "utf8"), file).map(
      (specifier) =>
        `${relative(SOURCE, file)}: forbidden dependency ${specifier}`,
    ),
  );
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
}
