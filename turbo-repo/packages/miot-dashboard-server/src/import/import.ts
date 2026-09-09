/**
 * The one-time import: legacy dashboards in, current store out.
 *
 * Three rules, all of them because this runs once against real data:
 *
 *  - It reports before it writes. `dryRun` defaults to true, so the harmless
 *    thing is what happens when someone forgets the flag.
 *  - It refuses rather than drops. Anything that cannot be converted is
 *    returned with the reason, so a run that leaves configs behind says so
 *    instead of finishing quietly.
 *  - It never overwrites. A dashboard already in the store is left alone, so
 *    a second run after a partial one is safe and adds only what is missing.
 */

import { isDashboardServerError } from "../access/errors";
import type { ServerDashboardStore } from "../seams/store";
import { refLabel, type LegacyDashboardSource } from "./legacy";
import { migrateConfig } from "./migrate";

export interface ImportOptions {
  source: LegacyDashboardSource;
  store: ServerDashboardStore;
  /**
   * Defaults to true: nothing is written and the result says what would have
   * been. Pass false to apply.
   */
  dryRun?: boolean;
  /** Recorded as `updatedBy` when the source does not name one. */
  importedBy?: string;
  /** One line per dashboard, for a long run against a real estate. */
  onProgress?: (line: Record<string, unknown>) => void;
}

export interface ImportRefusal {
  ref: string;
  reason: string;
}

export interface ImportResult {
  /** Written, or that would be written on an apply run. */
  imported: string[];
  /** Already in the store, left untouched. */
  skipped: string[];
  /** Could not be converted. Still in the source, nothing written. */
  refused: ImportRefusal[];
  /** Converted, but the store rejected the write. Apply runs only. */
  failed: ImportRefusal[];
  dryRun: boolean;
}

export async function importDashboards(
  options: ImportOptions,
): Promise<ImportResult> {
  const { source, store, dryRun = true, importedBy = "import" } = options;
  const result: ImportResult = {
    imported: [],
    skipped: [],
    refused: [],
    failed: [],
    dryRun,
  };

  for await (const legacy of source.read()) {
    const ref = refLabel(legacy.ref);

    const migrated = migrateConfig(legacy.config);
    if (!migrated.ok) {
      result.refused.push({ ref, reason: migrated.reason });
      options.onProgress?.({ msg: "refused", ref, reason: migrated.reason });
      continue;
    }

    // Asked every time, including on a dry run: "what would this do" is only
    // worth reading if it distinguishes the dashboards it would add from the
    // ones already there.
    if ((await store.load(legacy.ref)) !== null) {
      result.skipped.push(ref);
      options.onProgress?.({ msg: "skipped", ref, reason: "already present" });
      continue;
    }

    if (dryRun) {
      result.imported.push(ref);
      options.onProgress?.({ msg: "would import", ref });
      continue;
    }

    try {
      await store.save(legacy.ref, migrated.config, {
        // Zero means "expect nothing there". Between the load above and this
        // write another importer, or an editor, may have created it; that has
        // to be a conflict rather than an overwrite of newer work.
        expectedRevision: 0,
        // The creator, not whoever ran the import, and not the last editor.
        // A store sets `created_by` from this on the first write and never
        // again, and the default capability policy reads it to decide whether
        // a Contributor may edit their own dashboard — so putting anyone else
        // here silently takes that away from every Contributor in the estate.
        // The cost is that "last saved by" reads as the creator until someone
        // saves again, which is a label rather than a permission.
        updatedBy: legacy.createdBy ?? legacy.updatedBy ?? importedBy,
      });

      // After the config, and only for what was actually written: a failed
      // save must not leave permissions behind for a dashboard that is not
      // there. Verbatim, because widening access is the one thing a one-way
      // migration cannot be walked back from.
      if (legacy.assignments !== undefined && legacy.assignments.length > 0) {
        await store.setPermissions(legacy.ref, [...legacy.assignments]);
      }

      result.imported.push(ref);
      options.onProgress?.({ msg: "imported", ref });
    } catch (error) {
      const reason = isDashboardServerError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
      result.failed.push({ ref, reason });
      options.onProgress?.({ msg: "failed", ref, reason });
    }
  }

  return result;
}
