import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type {
  CreateDataShare,
  DataShare,
  DataShareAsset,
  DataShareFilter,
  DataShareOrigin,
  DataShareStatus,
} from "./platform.types";

/** Flowbite badge colors. */
export const STATUS_COLORS: Record<DataShareStatus, string> = {
  ACTIVE: "success",
  SCHEDULED: "info",
  EXPIRED: "gray",
  REVOKED: "failure",
};

export const ORIGIN_COLORS: Record<DataShareOrigin, string> = {
  MANUAL: "indigo",
  TRIP: "purple",
  ACCREDITATION: "pink",
};

export function formatDate(iso: string | null, lang: string) {
  return iso
    ? new Date(iso).toLocaleDateString(lang, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
}

export function formatCount(value: number, lang: string) {
  return value.toLocaleString(lang);
}

/** The scope, with today's asset count when the server sends one (it skips revoked and expired shares). */
export function scopeLabel(share: DataShare, dict: I18nRecord, lang: string) {
  if (share.assetCount === null) {
    return trDynamic(`scope.${share.scope}`, dict);
  }
  const count = formatCount(share.assetCount, lang);
  if (share.scope === "ALL") return tr("scope.allCount", dict, { count });
  if (share.scope === "FILTER") return tr("scope.filterCount", dict, { count });
  return tr("scope.someCount", dict, { count });
}

export function shareStatus(share: DataShare, now: number): DataShareStatus {
  if (share.revokedAt) {
    return "REVOKED";
  }
  if (Date.parse(share.validFrom) > now) {
    return "SCHEDULED";
  }
  if (share.validTo && Date.parse(share.validTo) <= now) {
    return "EXPIRED";
  }
  return "ACTIVE";
}

export function matchesFilter(asset: DataShareAsset, filter: DataShareFilter) {
  const owner =
    filter.owners.length === 0 || filter.owners.includes(asset.owner);
  const kind = filter.kinds.length === 0 || filter.kinds.includes(asset.kind);
  return owner && kind;
}

/** The source's assets a share covers today. */
export function coveredAssets(
  share: Pick<DataShare, "scope" | "filter" | "assetIds">,
  assets: readonly DataShareAsset[]
): DataShareAsset[] {
  if (share.scope === "ALL") {
    return [...assets];
  }
  if (share.scope === "FILTER") {
    const filter = share.filter ?? { owners: [], kinds: [] };
    return assets.filter((a) => matchesFilter(a, filter));
  }
  const ids = new Set(share.assetIds);
  return assets.filter((a) => ids.has(a.id));
}

/** Ids pasted from a spreadsheet or a text file: one per line, or split by commas, semicolons or tabs. */
export function parseIdList(text: string): string[] {
  const ids = text
    .split(/[\s,;]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

export interface PasteResult {
  found: string[];
  missing: string[];
}

/** Matches pasted ids to the source's assets, ignoring case. */
export function matchPasted(
  text: string,
  assets: readonly DataShareAsset[]
): PasteResult {
  const byKey = new Map(assets.map((a) => [a.id.toLowerCase(), a.id]));
  const found: string[] = [];
  const missing: string[] = [];
  for (const id of parseIdList(text)) {
    const match = byKey.get(id.toLowerCase());
    if (match) {
      found.push(match);
    } else {
      missing.push(id);
    }
  }
  return { found, missing };
}

/** Dictionary key under `form.errors`, or null when the share can be created. */
export type ShareProblem =
  | "source"
  | "target"
  | "sameOrg"
  | "filter"
  | "assets"
  | "dates"
  | "duplicate";

function hasCriteria(filter: DataShareFilter | null) {
  return (filter?.owners.length ?? 0) + (filter?.kinds.length ?? 0) > 0;
}

function scopeProblem(draft: CreateDataShare): ShareProblem | null {
  if (draft.scope === "FILTER" && !hasCriteria(draft.filter)) {
    return "filter";
  }
  if (draft.scope === "ASSETS" && draft.assetIds.length === 0) {
    return "assets";
  }
  return null;
}

export function checkShare(
  draft: CreateDataShare,
  shares: readonly DataShare[],
  now: number
): ShareProblem | null {
  if (!draft.sourceOrg) {
    return "source";
  }
  if (!draft.targetOrg) {
    return "target";
  }
  if (draft.sourceOrg === draft.targetOrg) {
    return "sameOrg";
  }
  const scope = scopeProblem(draft);
  if (scope) {
    return scope;
  }
  if (
    draft.validTo &&
    Date.parse(draft.validTo) <= Date.parse(draft.validFrom)
  ) {
    return "dates";
  }
  const covered = shares.some(
    (s) =>
      s.sourceOrg === draft.sourceOrg &&
      s.targetOrg === draft.targetOrg &&
      s.scope === "ALL" &&
      ["ACTIVE", "SCHEDULED"].includes(shareStatus(s, now)) &&
      overlaps(s, draft)
  );
  return covered ? "duplicate" : null;
}

function overlaps(share: DataShare, draft: CreateDataShare) {
  const startsBeforeItEnds =
    share.validTo === null ||
    Date.parse(draft.validFrom) < Date.parse(share.validTo);
  const endsAfterItStarts =
    draft.validTo === null ||
    Date.parse(draft.validTo) > Date.parse(share.validFrom);
  return startsBeforeItEnds && endsAfterItStarts;
}

export interface Facet {
  value: string;
  count: number;
}

/** Distinct values of one asset attribute, most frequent first. */
export function facet(
  assets: readonly DataShareAsset[],
  pick: (asset: DataShareAsset) => string
): Facet[] {
  const counts = new Map<string, number>();
  for (const asset of assets) {
    const value = pick(asset);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
