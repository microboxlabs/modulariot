/**
 * Shared answer-block contract for the harness search routes.
 *
 * The miot-search skill answers with a JSON array of typed blocks
 * (intent / markdown / url). Both the buffered route (./route.ts) and the
 * streaming route (./stream/route.ts) parse that answer into a
 * `HarnessSearchResult`, so the parsing/validation lives here once.
 */

export type HarnessIntent = "ask" | "navigate" | "build";

export type HarnessBlock =
  | { type: "intent"; value: HarnessIntent }
  | { type: "markdown"; value: string }
  | { type: "url"; value: { url: string; name: string } };

export interface HarnessSearchResult {
  id: string;
  label: string;
  sublabel?: string;
  intent?: HarnessIntent;
  blocks: HarnessBlock[];
}

const HARNESS_INTENTS: ReadonlySet<string> = new Set(["ask", "navigate", "build"]);

/** Absolute http(s), or an app-relative path (single leading slash — a
 * protocol-relative `//host` is rejected). */
function isSafeHref(url: string): boolean {
  return /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//"));
}

function isValidBlock(item: unknown): item is HarnessBlock {
  if (!item || typeof item !== "object") return false;
  const b = item as Record<string, unknown>;
  if (b.type === "intent") {
    return typeof b.value === "string" && HARNESS_INTENTS.has(b.value);
  }
  if (b.type === "markdown") return typeof b.value === "string";
  if (b.type === "url") {
    if (!b.value || typeof b.value !== "object") return false;
    const v = b.value as Record<string, unknown>;
    return (
      typeof v.url === "string" &&
      isSafeHref(v.url) &&
      typeof v.name === "string"
    );
  }
  return false;
}

export function parseAnswerBlocks(answer: string): HarnessBlock[] {
  try {
    const parsed: unknown = JSON.parse(answer);
    if (Array.isArray(parsed)) {
      return parsed.filter(isValidBlock);
    }
  } catch {
    // fall through to plain-text fallback
  }
  return [{ type: "markdown", value: answer }];
}

export function buildLabel(blocks: HarnessBlock[]): string {
  const first = blocks.find((b): b is Extract<HarnessBlock, { type: "markdown" }> => b.type === "markdown");
  const raw = first?.value ?? "";
  const plain = raw.replace(/[*_`#[\]]/g, "").trim();
  return plain.slice(0, 120) + (plain.length > 120 ? "…" : "");
}

/** Fold a raw run answer into the search-result shape both routes return. */
export function toSearchResult(runId: string, answer: string): HarnessSearchResult {
  const parsed = parseAnswerBlocks(answer);
  // The skill emits the intent as a leading typed block — surface it as a
  // field and keep only renderable blocks.
  const intent = parsed.find(
    (b): b is Extract<HarnessBlock, { type: "intent" }> => b.type === "intent",
  )?.value;
  const blocks = parsed.filter((b) => b.type !== "intent");
  return {
    id: `harness:${runId}`,
    label: buildLabel(blocks),
    ...(intent && { intent }),
    blocks,
  };
}
