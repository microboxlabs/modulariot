import type {
  Level,
  SymptomSpec,
  SymptomStats,
  SymptomSummary,
} from "./maintainer-api";

/** Channel groups the catalog shows and filters by. Teams and WhatsApp share one tag. */
export type ChannelGroup = "app" | "chat" | "email" | "webhook";

const CHANNEL_GROUP: Record<string, ChannelGroup> = {
  app: "app",
  teams: "chat",
  whatsapp: "chat",
  email: "email",
  webhook: "webhook",
};

export const CHANNEL_GROUPS: ChannelGroup[] = [
  "app",
  "chat",
  "email",
  "webhook",
];

const NUMBER = String.raw`(-?\d+(?:\.\d+)?)`;
const FIRST_LEVEL = new RegExp(
  String.raw`^medida\s*>\s*0\s*&&\s*medida\s*<\s*${NUMBER}$`
);
const RANGE = new RegExp(
  String.raw`^medida\s*>=\s*${NUMBER}\s*&&\s*medida\s*<\s*${NUMBER}$`
);
const BELOW = new RegExp(String.raw`^medida\s*<=?\s*${NUMBER}$`);
const FROM = new RegExp(
  String.raw`^medida\s*(>=|>)\s*${NUMBER}(?:\s*&&\s*sostenido_s\s*>=\s*${NUMBER})?$`
);

/** `5` km/h → "5 km/h"; minutes and seconds read as the prototype writes them ("2 h", "5 h 30", "1 min"). */
export function formatAmount(value: number, unit: string | null): string {
  const u = (unit ?? "").trim();
  if (u === "min") return formatMinutes(value);
  if (u === "s")
    return value >= 60 && value % 60 === 0
      ? formatMinutes(value / 60)
      : `${value} s`;
  if (u === "h") return formatMinutes(value * 60);
  return u ? `${value} ${u}` : String(value);
}

/** Whole hours as "2 h"; from two hours on, "5 h 30"; below that, minutes ("90 min"). */
function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 1 && m === 0) return `${h} h`;
  if (h >= 2) return `${h} h ${m}`;
  return `${minutes} min`;
}

/**
 * The short threshold a catalog card shows under a level's icon, read from
 * the level's CEL: `medida >= 5 && medida < 11` → "≥ 5 km/h". Null when the
 * level does not apply; "fixed" for a level that opens on the event itself;
 * "custom" when the rule is not one of the shapes the card can summarize.
 */
export function shortThreshold(
  level: Level | undefined,
  unit: string | null
): string | "fixed" | "custom" | null {
  if (!level?.applies) return null;
  const when = (level.when ?? "").trim();
  if (!when) return null;
  if (when === "true") return "fixed";
  let m = FIRST_LEVEL.exec(when);
  if (m) return `< ${formatAmount(Number(m[1]), unit)}`;
  m = RANGE.exec(when);
  if (m) return `≥ ${formatAmount(Number(m[1]), unit)}`;
  m = BELOW.exec(when);
  if (m) return `< ${formatAmount(Number(m[1]), unit)}`;
  m = FROM.exec(when);
  if (m) {
    const op = m[1] === ">" ? ">" : "≥";
    const base = `${op} ${formatAmount(Number(m[2]), unit)}`;
    return m[3] ? `${base} · ${formatAmount(Number(m[3]), "s")}` : base;
  }
  return "custom";
}

/** The four levels in ICU order, missing ones as undefined. */
export function levelsOf(spec: SymptomSpec | null): (Level | undefined)[] {
  return [1, 2, 3, 4].map((icu) => spec?.levels?.find((l) => l.icu === icu));
}

/** Per level: whether an operator must handle the case there. */
export function operatorLevels(spec: SymptomSpec | null): boolean[] {
  return levelsOf(spec).map((l) => Boolean(l?.applies && l.response?.operator));
}

/** Channel groups any level notifies on, in display order. */
export function channelGroups(spec: SymptomSpec | null): ChannelGroup[] {
  const found = new Set<ChannelGroup>();
  for (const l of spec?.levels ?? []) {
    if (!l.applies) continue;
    for (const n of l.response?.notices ?? []) {
      found.add(CHANNEL_GROUP[n.channel] ?? "webhook");
    }
  }
  return CHANNEL_GROUPS.filter((g) => found.has(g));
}

/** ICU numbers of the levels a symptom can reach. */
export function reachableLevels(spec: SymptomSpec | null): number[] {
  return levelsOf(spec)
    .map((l, i) => (l?.applies ? i + 1 : 0))
    .filter(Boolean);
}

type LastPublished = NonNullable<SymptomStats["changes"]["lastPublished"]>;

/** The most recently published version across the catalog, from each symptom's version in force. */
export function lastPublished(all: SymptomSummary[]): LastPublished | null {
  let last: LastPublished | null = null;
  for (const s of all) {
    const v = s.current;
    if (!v?.publishedAt || !v.version) continue;
    if (last && Date.parse(last.at) >= Date.parse(v.publishedAt)) continue;
    last = {
      definitionId: s.definition.id,
      name: s.definition.name,
      version: v.version,
      at: v.publishedAt,
      by: v.publishedBy ?? "",
      reason: v.reason,
    };
  }
  return last;
}

/** The catalog filters; values are the labels the chips show. */
export type CatalogFilterKey =
  | "family"
  | "state"
  | "level"
  | "who"
  | "channel"
  | "draft";
