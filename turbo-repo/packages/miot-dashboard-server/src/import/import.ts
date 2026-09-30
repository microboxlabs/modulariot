/**
 * The one-time import: legacy dashboards in, current store out.
 *
 * Every rule here exists because this runs once against real data and cannot
 * be undone:
 *
 *  - It reports before it writes. `dryRun` defaults to true, so the harmless
 *    thing is what happens when someone forgets the flag.
 *  - It refuses rather than drops. Anything that cannot be converted is
 *    returned with the reason, so a run that leaves configs behind says so
 *    instead of finishing quietly.
 *  - It never overwrites. A dashboard already in the store is left alone, so
 *    a second run after a partial one is safe and adds only what is missing.
 *  - It leaves nothing half-written. A dashboard whose assignments fail to
 *    save is removed again, so a re-run retries it rather than skipping it
 *    forever with permissions nobody chose.
 */

import type { ServerDashboardRef, ServerDashboardStore } from "../seams/store";
import {
  refLabel,
  type LegacyDashboard,
  type LegacyDashboardSource,
} from "./legacy";
import { migrateConfig } from "./migrate";

export interface ImportOptions {
  source: LegacyDashboardSource;
  store: ServerDashboardStore;
  /**
   * Defaults to true: nothing is written and the result says what would have
   * been. Pass false to apply.
   */
  dryRun?: boolean;
  /** Recorded as the author when the source names neither creator nor editor. */
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
  /**
   * Converted, but not imported. The reason says what is in the store: for a
   * failed create, nothing; for failed assignments, whether the create was
   * undone.
   */
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

    let createdRevision: number;
    try {
      const created = await store.save(legacy.ref, migrated.config, {
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
      createdRevision = created.revision;
    } catch (error) {
      // The first write, so a failure leaves the store as it was and a re-run
      // retries this dashboard.
      const reason = reasonOf(error);
      result.failed.push({ ref, reason });
      options.onProgress?.({ msg: "failed", ref, reason });
      continue;
    }

    const assignmentFailure = await importAssignments(
      store,
      legacy,
      createdRevision,
    );
    if (assignmentFailure !== null) {
      result.failed.push({ ref, reason: assignmentFailure });
      options.onProgress?.({ msg: "failed", ref, reason: assignmentFailure });
      continue;
    }

    result.imported.push(ref);
    options.onProgress?.({ msg: "imported", ref });
  }

  return result;
}

/** Apply assignments only after creation, undoing the new dashboard on failure. */
async function importAssignments(
  store: ServerDashboardStore,
  legacy: LegacyDashboard,
  createdRevision: number,
): Promise<string | null> {
  if (!legacy.assignments?.length) return null;
  try {
    await store.setPermissions(legacy.ref, [...legacy.assignments]);
    return null;
  } catch (error) {
    // Otherwise the next run would skip the created config forever, leaving it
    // without the permissions the importer chose.
    const reason = reasonOf(error);
    const undone = await undoCreate(store, legacy.ref, createdRevision);
    return undone
      ? `${reason} — the dashboard was removed again, so a re-run retries it`
      : `${reason} — AND it could not be removed, so it is in the store ` +
          "without its assignments and a re-run will skip it";
  }
}

/** Roll back only the exact revision this import created, without a read/delete race. */
async function undoCreate(
  store: ServerDashboardStore,
  ref: ServerDashboardRef,
  revision: number,
): Promise<boolean> {
  try {
    return (await store.removeIfRevision?.(ref, revision)) ?? false;
  } catch {
    return false;
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
