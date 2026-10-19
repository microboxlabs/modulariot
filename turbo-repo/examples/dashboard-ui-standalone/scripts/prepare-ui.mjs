import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const source = process.env.UI_PACKAGE_DIR;
if (!source)
  throw new Error(
    "Set UI_PACKAGE_DIR to an installed or unpacked dashboard UI package directory",
  );
const destination = fileURLToPath(new URL("../public/", import.meta.url));
await mkdir(destination, { recursive: true });
await copyFile(
  resolve(source, "dist/browser/browser.js"),
  resolve(destination, "runtime.js"),
);
await copyFile(
  resolve(source, "styles.css"),
  resolve(destination, "runtime.css"),
);
console.log("Copied dashboard browser runtime and styles");
