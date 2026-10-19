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

function hasRuntimeEchartsImport(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const declarations = ast.statements.filter(
    (statement) =>
      (ts.isImportDeclaration(statement) ||
        ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier?.text === "echarts",
  );
  return (
    declarations.length === 0 ||
    declarations.some((statement) =>
      ts.isImportDeclaration(statement)
        ? !statement.importClause?.isTypeOnly
        : !statement.isTypeOnly,
    )
  );
}

function packageAllowed(specifier, origin, scope) {
  if (
    scope.isReact &&
    [
      "react",
      "react-dom",
      "react-grid-layout",
      "react-grid-layout/core",
      "@microboxlabs/miot-dashboard-ui/document",
    ].includes(specifier)
  )
    return true;
  if (
    scope.isEmbed &&
    [
      "react",
      "react-dom/client",
      "@microboxlabs/miot-dashboard-ui/react",
    ].includes(specifier)
  )
    return true;
  if (scope.isTemplates && specifier === "handlebars") return true;
  if (
    origin === "react/chart-registry.tsx" &&
    specifier === "@microboxlabs/miot-dashboard-ui/react"
  )
    return true;
  return ALLOWED.has(specifier);
}

function targetForbidden(origin, target, scope) {
  if (target === ".." || target.startsWith("../")) return true;
  if (origin === "browser-charts.ts")
    return !["browser", "react-charts"].includes(target);
  if (origin === "browser.ts")
    return !["embed", "web-component"].includes(target);
  if (scope.isWebComponent)
    return !(
      target === "embed" ||
      target.startsWith("embed/") ||
      target.startsWith("web-component/")
    );
  if (scope.isCore) return target !== "core" && !target.startsWith("core/");
  return (
    (!scope.isReact &&
      !scope.isEmbed &&
      (target === "react" || target.startsWith("react/"))) ||
    (!scope.isEmbed && (target === "embed" || target.startsWith("embed/"))) ||
    target === "web-component" ||
    target.startsWith("web-component/") ||
    target === "browser"
  );
}

/** Portable package imports cannot pull in a framework, server or host application. */
export function importProblems(source, file, root = SOURCE) {
  const origin = relative(root, file);
  const scope = {
    isCharts: origin === "charts.ts" || origin.startsWith("charts/"),
    isCore: origin === "core.ts" || origin.startsWith("core/"),
    isTemplates: origin === "templates.ts" || origin.startsWith("templates/"),
    isWebComponent:
      origin === "web-component.ts" || origin.startsWith("web-component/"),
    isEmbed: origin === "embed.ts" || origin.startsWith("embed/"),
    isReact:
      origin === "react.ts" ||
      origin === "react-charts.ts" ||
      origin.startsWith("react/"),
  };
  return ts
    .preProcessFile(source, true, true)
    .importedFiles.map(({ fileName }) => fileName)
    .filter((specifier) => {
      if (packageAllowed(specifier, origin, scope)) return false;
      if (specifier === "echarts" && scope.isCharts)
        return hasRuntimeEchartsImport(source, file);
      if (!specifier.startsWith("./") && !specifier.startsWith("../"))
        return true;
      const target = relative(root, resolve(dirname(file), specifier)).replace(
        /\.[cm]?[jt]sx?$/,
        "",
      );
      return targetForbidden(origin, target, scope);
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
