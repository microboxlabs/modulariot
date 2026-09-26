import type {
  ModelEntry,
  ModelProviderAdmin,
  SetModelProvider,
} from "./platform.types";

/** One model row as typed: prices stay strings until the form is sent. */
export interface ModelDraft {
  id: string;
  inputPerMtok: string;
  outputPerMtok: string;
  isDefault: boolean;
}

export interface ProviderDraft {
  provider: string;
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  models: ModelDraft[];
}

/** Keys under `models.errors` in the dictionary. */
export type ProviderDraftError =
  | "provider"
  | "apiKey"
  | "baseUrl"
  | "modelId"
  | "duplicateModel"
  | "price";

export type DraftResult =
  | { ok: true; value: SetModelProvider }
  | { ok: false; error: ProviderDraftError };

export function emptyModel(): ModelDraft {
  return { id: "", inputPerMtok: "", outputPerMtok: "", isDefault: false };
}

export function draftFrom(existing?: ModelProviderAdmin): ProviderDraft {
  if (!existing) {
    return {
      provider: "",
      apiKey: "",
      baseUrl: "",
      enabled: true,
      models: [emptyModel()],
    };
  }
  return {
    provider: existing.provider,
    apiKey: "",
    baseUrl: existing.baseUrl ?? "",
    enabled: existing.enabled,
    models: existing.models.map((m) => ({
      id: m.id,
      inputPerMtok: m.inputPerMtok == null ? "" : String(m.inputPerMtok),
      outputPerMtok: m.outputPerMtok == null ? "" : String(m.outputPerMtok),
      isDefault: m.default,
    })),
  };
}

function price(value: string): number | null | undefined {
  const text = value.trim();
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * The request body for a draft, or the first problem with it. The modulith
 * checks the same rules; this only saves a round trip. Empty model rows are
 * dropped. A new provider needs a key; an existing one keeps its key when
 * the field is left blank.
 */
export function toRequest(draft: ProviderDraft, isNew: boolean): DraftResult {
  if (!draft.provider) return { ok: false, error: "provider" };
  const apiKey = draft.apiKey.trim();
  if (isNew && apiKey === "") return { ok: false, error: "apiKey" };
  const baseUrl = draft.baseUrl.trim();
  if (baseUrl !== "" && !baseUrl.startsWith("https://")) {
    return { ok: false, error: "baseUrl" };
  }

  const models: ModelEntry[] = [];
  const seen = new Set<string>();
  for (const row of draft.models) {
    const id = row.id.trim();
    const blank =
      id === "" &&
      row.inputPerMtok.trim() === "" &&
      row.outputPerMtok.trim() === "";
    if (blank) continue;
    if (id === "") return { ok: false, error: "modelId" };
    if (seen.has(id)) return { ok: false, error: "duplicateModel" };
    seen.add(id);
    const inputPerMtok = price(row.inputPerMtok);
    const outputPerMtok = price(row.outputPerMtok);
    if (inputPerMtok === undefined || outputPerMtok === undefined) {
      return { ok: false, error: "price" };
    }
    models.push({ id, inputPerMtok, outputPerMtok, default: row.isDefault });
  }

  return {
    ok: true,
    value: { apiKey, baseUrl: baseUrl || null, models, enabled: draft.enabled },
  };
}

/** Marks one row as the default and clears the others. */
export function withDefault(models: ModelDraft[], index: number): ModelDraft[] {
  return models.map((m, i) => ({
    ...m,
    isDefault: i === index && !m.isDefault,
  }));
}

/** The calendar month `offset` months from the one `now` is in, in UTC. */
export function monthPeriod(
  offset: number,
  now: Date = new Date()
): { from: string; to: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + offset;
  return {
    from: new Date(Date.UTC(year, month, 1)).toISOString(),
    to: new Date(Date.UTC(year, month + 1, 1)).toISOString(),
  };
}
