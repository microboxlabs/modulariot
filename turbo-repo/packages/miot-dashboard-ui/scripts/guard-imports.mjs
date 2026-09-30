import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SOURCE = fileURLToPath(new URL("../src", import.meta.url));
const ALLOWED = new Set([
  "@microboxlabs/miot-dashboard-contract/document",
  "@microboxlabs/miot-dashboard-contract/schema",
  "@microboxlabs/miot-dashboard-contract/roles",
  "zod",
]);

/** Portable package imports cannot pull in a framework, server or host application. */
export function importProblems(source, file, root = SOURCE) {
  const origin = relative(root, file);
  const isCore = origin === "core.ts" || origin.startsWith("core/");
  const isTemplates =
    origin === "templates.ts" || origin.startsWith("templates/");
  const isWebComponent =
    origin === "web-component.ts" || origin.startsWith("web-component/");
  const isEmbed = origin === "embed.ts" || origin.startsWith("embed/");
  const isReact = origin === "react.ts" || origin.startsWith("react/");
  return ts
    .preProcessFile(source, true, true)
    .importedFiles.map(({ fileName }) => fileName)
    .filter((specifier) => {
      if (
        ["react", "react-grid-layout", "react-grid-layout/core"].includes(
          specifier,
        ) &&
        isReact
      )
        return false;
      if (isEmbed && ["react", "react-dom/client"].includes(specifier))
        return false;
      if (specifier === "handlebars" && isTemplates) return false;
      if (ALLOWED.has(specifier)) return false;
      if (!specifier.startsWith("./") && !specifier.startsWith("../"))
        return true;
      const target = relative(root, resolve(dirname(file), specifier)).replace(
        /\.[cm]?[jt]sx?$/,
        "",
      );
      if (target === ".." || target.startsWith("../")) return true;
      if (origin === "browser.ts") return !["embed", "web-component"].includes(target);
      if (isWebComponent)
        return !(
          target === "embed" ||
          target.startsWith("embed/") ||
          target.startsWith("web-component/")
        );
      if (isCore) return target !== "core" && !target.startsWith("core/");
      return (
        (!isReact &&
          !isEmbed &&
          (target === "react" || target.startsWith("react/"))) ||
        (!isEmbed && (target === "embed" || target.startsWith("embed/"))) ||
        target === "web-component" ||
        target.startsWith("web-component/") ||
        target === "browser"
      );
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
