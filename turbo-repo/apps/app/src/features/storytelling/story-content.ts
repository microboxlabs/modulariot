import type {
  DeckContent,
  DeckSlide,
  StoryKind,
  StorySection,
  StoryVersion,
} from "./storytelling.types";

/**
 * What the detail view renders for a version, decided from the story's kind
 * and the version's content. `empty` covers a version whose content does not
 * match its kind (a deck without slides, a PDF that is not base64).
 */
export type StoryRender =
  | { readonly type: "markdown"; readonly markdown: string }
  | { readonly type: "html"; readonly html: string }
  | { readonly type: "svg"; readonly svg: string }
  | { readonly type: "deck"; readonly deck: DeckContent }
  | { readonly type: "pdf"; readonly data: Uint8Array }
  | { readonly type: "sections"; readonly sections: readonly StorySection[] }
  | { readonly type: "empty" };

export function renderForVersion(
  kind: StoryKind,
  version: StoryVersion | null
): StoryRender {
  if (!version) return { type: "empty" };
  const content = version.content ?? "";
  switch (kind) {
    case "markdown":
      return content
        ? { type: "markdown", markdown: content }
        : { type: "empty" };
    case "html":
      return content ? { type: "html", html: content } : { type: "empty" };
    case "svg":
      return content ? { type: "svg", svg: content } : { type: "empty" };
    case "deck": {
      const deck = deckFrom(version);
      return deck ? { type: "deck", deck } : { type: "empty" };
    }
    case "pdf": {
      const data = base64ToBytes(content);
      return data ? { type: "pdf", data } : { type: "empty" };
    }
    case "sections": {
      const sections = sectionsFrom(version);
      return sections.length > 0
        ? { type: "sections", sections }
        : { type: "empty" };
    }
    default:
      return { type: "empty" };
  }
}

/** The structure lives in metadata; a version that only carries it as JSON
 * text in `content` is read from there instead. */
function structureOf(version: StoryVersion): Record<string, unknown> | null {
  if (version.metadata && Object.keys(version.metadata).length > 0)
    return version.metadata;
  if (!version.content) return null;
  try {
    const parsed: unknown = JSON.parse(version.content);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? "")) : [];
}

function toSlide(raw: unknown): DeckSlide | null {
  if (!isRecord(raw)) return null;
  const title = typeof raw.title === "string" ? raw.title : "";
  if (raw.type === "bullets")
    return { type: "bullets", title, items: strings(raw.items) };
  if (raw.type === "table") {
    const rows = Array.isArray(raw.rows) ? raw.rows.map(strings) : [];
    return { type: "table", title, headers: strings(raw.headers), rows };
  }
  if (raw.type === "title" || title) {
    const subtitle =
      typeof raw.subtitle === "string" ? raw.subtitle : undefined;
    return { type: "title", title, ...(subtitle ? { subtitle } : {}) };
  }
  return null;
}

export function deckFrom(version: StoryVersion): DeckContent | null {
  const structure = structureOf(version);
  const raw = structure?.slides;
  if (!Array.isArray(raw)) return null;
  const slides = raw
    .map(toSlide)
    .filter((slide): slide is DeckSlide => slide !== null);
  return slides.length > 0 ? { slides } : null;
}

const SECTION_TYPES = new Set([
  "heading",
  "text",
  "metric",
  "quote",
  "chart",
  "table",
]);

export function sectionsFrom(version: StoryVersion): StorySection[] {
  const structure = structureOf(version);
  const raw = structure?.sections;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (section): section is StorySection =>
      isRecord(section) &&
      typeof section.type === "string" &&
      SECTION_TYPES.has(section.type)
  );
}

/** Decodes base64 (tolerating a `data:` prefix); null when it is not base64. */
export function base64ToBytes(value: string): Uint8Array | null {
  const body = value
    .trim()
    .replace(/^data:[^,]*,/, "")
    .replace(/\s+/g, "");
  if (!body || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return null;
  try {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
      bytes[i] = binary.codePointAt(i) ?? 0;
    return bytes;
  } catch {
    return null;
  }
}

/** File name and bytes for the download button; null for kinds that are
 * built on demand (a deck becomes a .pptx on the server). */
export function downloadFor(
  render: StoryRender,
  baseName: string
): { filename: string; blob: Blob } | null {
  const name = baseName.replace(/[^\p{L}\p{N} _.-]+/gu, "").trim() || "story";
  switch (render.type) {
    case "markdown":
      return {
        filename: `${name}.md`,
        blob: new Blob([render.markdown], { type: "text/markdown" }),
      };
    case "html":
      return {
        filename: `${name}.html`,
        blob: new Blob([render.html], { type: "text/html" }),
      };
    case "svg":
      return {
        filename: `${name}.svg`,
        blob: new Blob([render.svg], { type: "image/svg+xml" }),
      };
    case "pdf":
      return {
        filename: `${name}.pdf`,
        blob: new Blob([render.data as BlobPart], { type: "application/pdf" }),
      };
    default:
      return null;
  }
}
