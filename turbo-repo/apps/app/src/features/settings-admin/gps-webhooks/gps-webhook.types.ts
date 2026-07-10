import { z } from "zod";

export type GpsWebhookFilterMode = "ALL_VISIBLE" | "RULES";

export interface GpsWebhookFilterScopes {
  allVisible?: boolean;
  assetIds?: string[];
  carrierIds?: string[];
  ingestClientIds?: string[];
  gpsProviders?: string[];
  owners?: string[];
}

export interface GpsWebhookFilter {
  scopes?: GpsWebhookFilterScopes;
  match?: string;
}

/** Mirrors Quarkus `GpsWebhookResponse`. */
export interface GpsWebhookSubscription {
  id: string;
  tenantCode: string;
  connectionId: string;
  name: string;
  url: string;
  enabled: boolean;
  filterMode: GpsWebhookFilterMode;
  filter: GpsWebhookFilter | Record<string, unknown>;
  includeAllVisible: boolean;
  compiledAssetIds: string[];
  compiledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors Quarkus `GpsWebhookTestResponse`. */
export interface GpsWebhookTestResult {
  success: boolean;
  statusCode: number | null;
  message: string;
  testedAt: string;
}

/** Split comma- or newline-separated free text into trimmed distinct values. */
export function parseList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ];
}

export function formatList(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0)
      .join("\n");
  }
  if (typeof value === "string") {
    return parseList(value).join("\n");
  }
  return "";
}

function scopesFromFilter(
  filter: GpsWebhookFilter | Record<string, unknown> | undefined,
): GpsWebhookFilterScopes {
  if (!filter || typeof filter !== "object") {
    return {};
  }
  const scopes = (filter as GpsWebhookFilter).scopes;
  return scopes && typeof scopes === "object" ? scopes : {};
}

export function subscriptionToForm(
  sub: GpsWebhookSubscription,
): GpsWebhookFormData {
  const scopes = scopesFromFilter(sub.filter);
  return {
    name: sub.name,
    url: sub.url,
    filterMode: sub.filterMode,
    assetIds: formatList(scopes.assetIds),
    carrierIds: formatList(scopes.carrierIds),
    ingestClientIds: formatList(scopes.ingestClientIds),
    gpsProviders: formatList(scopes.gpsProviders),
    owners: formatList(scopes.owners),
    enabled: sub.enabled,
  };
}

export function formToCreateBody(form: GpsWebhookFormData) {
  return {
    name: form.name.trim(),
    url: form.url.trim(),
    filterMode: form.filterMode,
    filter: buildFilter(form),
    enabled: form.enabled,
  };
}

export function formToUpdateBody(form: GpsWebhookFormData) {
  return formToCreateBody(form);
}

function buildFilter(form: GpsWebhookFormData): GpsWebhookFilter {
  if (form.filterMode === "ALL_VISIBLE") {
    return {
      match: "ALL",
      scopes: {
        allVisible: true,
        assetIds: [],
        carrierIds: [],
        ingestClientIds: [],
        gpsProviders: [],
        owners: [],
      },
    };
  }
  return {
    match: "ALL",
    scopes: {
      allVisible: false,
      assetIds: parseList(form.assetIds),
      carrierIds: parseList(form.carrierIds),
      ingestClientIds: parseList(form.ingestClientIds),
      gpsProviders: parseList(form.gpsProviders),
      owners: parseList(form.owners),
    },
  };
}

const baseShape = {
  name: z.string().min(1, "validation.nameRequired").max(160),
  url: z.string().url("validation.urlInvalid"),
  filterMode: z.enum(["ALL_VISIBLE", "RULES"]),
  assetIds: z.string(),
  carrierIds: z.string(),
  ingestClientIds: z.string(),
  gpsProviders: z.string(),
  owners: z.string(),
  enabled: z.boolean(),
};

function requireRulesDimensions(
  data: {
    filterMode: GpsWebhookFilterMode;
    assetIds: string;
    carrierIds: string;
    ingestClientIds: string;
    gpsProviders: string;
    owners: string;
  },
  ctx: z.RefinementCtx,
): void {
  if (data.filterMode !== "RULES") {
    return;
  }
  const any =
    parseList(data.assetIds).length > 0 ||
    parseList(data.carrierIds).length > 0 ||
    parseList(data.ingestClientIds).length > 0 ||
    parseList(data.gpsProviders).length > 0 ||
    parseList(data.owners).length > 0;
  if (!any) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["assetIds"],
      message: "validation.rulesRequired",
    });
  }
}

export const GpsWebhookFormSchema = z
  .object(baseShape)
  .superRefine(requireRulesDimensions);

export type GpsWebhookFormData = z.infer<typeof GpsWebhookFormSchema>;

export function summarizeFilter(sub: GpsWebhookSubscription): string {
  if (sub.filterMode === "ALL_VISIBLE" || sub.includeAllVisible) {
    return "allVisible";
  }
  const scopes = scopesFromFilter(sub.filter);
  const parts: string[] = [];
  if (scopes.assetIds?.length) {
    parts.push(`assets:${scopes.assetIds.length}`);
  }
  if (scopes.carrierIds?.length) {
    parts.push(`carriers:${scopes.carrierIds.length}`);
  }
  if (scopes.ingestClientIds?.length) {
    parts.push(`providers:${scopes.ingestClientIds.length}`);
  }
  if (scopes.gpsProviders?.length) {
    parts.push(`vendors:${scopes.gpsProviders.length}`);
  }
  if (scopes.owners?.length) {
    parts.push(`owners:${scopes.owners.length}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "rules";
}
