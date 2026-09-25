import { SELECTABLE_LANGUAGES, type LocalizedText } from "./types";

/** The text in `lang`, else the fallback language, else any there is. */
export function pickText(
  text: LocalizedText | null | undefined,
  lang: string
): string {
  if (!text) return "";
  return (
    text[lang] ||
    text[SELECTABLE_LANGUAGES[0]] ||
    Object.values(text).find(Boolean) ||
    ""
  );
}

/** Lower case, accents dropped, runs of anything else turned into one underscore — as the API makes values. */
export function slugify(text: string, max = 60): string {
  const slug = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, max)
    // Runs are already one underscore, so each end has at most one to drop.
    .replace(/^_/, "")
    .replace(/_$/, "");
  return slug;
}

/** A list key: a letter first, then letters, digits and underscores, 2 to 64 in all. */
export function toListKey(text: string): string {
  const slug = slugify(text, 64);
  if (/^[a-z]/.test(slug) && slug.length > 1) return slug;
  const rest = slugify(text, 59);
  return rest ? `list_${rest}` : "list";
}

/** Accent- and case-insensitive match against an option's value and every label. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}
