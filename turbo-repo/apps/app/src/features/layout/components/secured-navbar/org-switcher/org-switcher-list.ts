export interface SwitcherOrg {
  slug: string;
  displayName: string;
  taxId: string | null;
  isParent: boolean;
}

const RECENT_STORAGE_KEY = "org_switcher_recent_v1";
const RECENT_MAX = 5;

/** Lower-case, accent-free text for matching "sudamérica" with "Sudamerica". */
export function normalize(text: string): string {
  return text.normalize("NFD").replaceAll(/\p{M}/gu, "").toLowerCase().trim();
}

/** Orgs whose name, slug or tax id contains every word of the query, by name. */
export function filterOrgs<T extends SwitcherOrg>(
  orgs: readonly T[],
  query: string
): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const sorted = [...orgs].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "es", { sensitivity: "base" })
  );
  if (words.length === 0) return sorted;
  return sorted.filter((org) => {
    const haystack = normalize(
      `${org.displayName} ${org.slug} ${org.taxId ?? ""}`
    );
    return words.every((word) => haystack.includes(word));
  });
}

/** Recent orgs that still exist, most recent first, without the active one. */
export function pickRecent<T extends SwitcherOrg>(
  orgs: readonly T[],
  recentSlugs: readonly string[],
  activeSlug: string
): T[] {
  const bySlug = new Map(orgs.map((org) => [org.slug, org]));
  return recentSlugs
    .filter((slug) => slug !== activeSlug)
    .map((slug) => bySlug.get(slug))
    .filter((org): org is T => org !== undefined)
    .slice(0, RECENT_MAX - 1);
}

/** Puts the slugs first, most recent first, keeping at most RECENT_MAX. */
export function pushRecent(
  recentSlugs: readonly string[],
  ...slugs: string[]
): string[] {
  const front = [...new Set(slugs)];
  return [
    ...front,
    ...recentSlugs.filter((slug) => !front.includes(slug)),
  ].slice(0, RECENT_MAX);
}

export function loadRecentSlugs(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]"
    );
    return Array.isArray(parsed)
      ? parsed.filter((slug): slug is string => typeof slug === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveRecentSlugs(slugs: readonly string[]): void {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    // localStorage unavailable
  }
}

/** Up to two initials, e.g. "Sudamerica Gps" → "SG", "eGPS" → "EG". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? "?").slice(0, 2).toUpperCase();
}
