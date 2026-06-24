/**
 * Builds a pagefind search index from the static pages registry and i18n
 * translations. Runs as a pre-build step; writes output to public/pagefind/.
 *
 * Uses pagefind's custom record API so all records are created programmatically —
 * no HTML crawling needed, which wouldn't work because all app pages are
 * behind authentication.
 *
 * Run: node scripts/build-search-index.mjs
 */

import { createIndex } from "pagefind";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, "..");

const pages = JSON.parse(
  readFileSync(resolve(appDir, "src/features/layout/models/pages-searchable.json"), "utf-8"),
);

const en = JSON.parse(readFileSync(resolve(appDir, "src/lang/en.json"), "utf-8"));
const es = JSON.parse(readFileSync(resolve(appDir, "src/lang/es.json"), "utf-8"));

function label(key, lang) {
  return lang?.layout?.secured?.sidebar?.[key] ?? key;
}

const { index, errors } = await createIndex({ verbose: false });

if (errors.length) {
  console.error("pagefind createIndex errors:", errors);
  process.exit(1);
}

for (const page of pages) {
  const enParent = label(page.label, en);
  const esParent = label(page.label, es);

  const children = (page.items ?? []).filter((c) => c.href);

  if (children.length === 0) {
    // Direct top-level page (e.g. Fleet, Collaborators)
    if (!page.href) continue;

    await index.addCustomRecord({
      url: page.href,
      content: `${enParent} ${esParent}`,
      language: "en",
      meta: {
        title: enParent,
        id: page.label,
        requiredGroups: (page.requiredGroups ?? []).join(","),
        blockedGroups: (page.blockedGroups ?? []).join(","),
      },
    });
    continue;
  }

  // Parent with children — emit one record per navigable child
  for (const child of children) {
    const enChild = label(child.label, en);
    const esChild = label(child.label, es);

    // Merge parent + child groups: child inherits parent restrictions
    const requiredGroups = [...(page.requiredGroups ?? []), ...(child.requiredGroups ?? [])];
    const blockedGroups = [...(page.blockedGroups ?? []), ...(child.blockedGroups ?? [])];

    await index.addCustomRecord({
      url: child.href,
      // Include both languages so users can search in either
      content: `${enParent} ${enChild} ${esParent} ${esChild}`,
      language: "en",
      meta: {
        title: enChild,
        id: child.label,
        parent: enParent,
        parentId: page.label,
        requiredGroups: requiredGroups.join(","),
        blockedGroups: blockedGroups.join(","),
      },
    });
  }
}

const { errors: writeErrors } = await index.writeFiles({
  outputPath: resolve(appDir, "public/pagefind"),
});

if (writeErrors?.length) {
  console.error("pagefind writeFiles errors:", writeErrors);
  process.exit(1);
}

console.log("Search index built → apps/app/public/pagefind/");
