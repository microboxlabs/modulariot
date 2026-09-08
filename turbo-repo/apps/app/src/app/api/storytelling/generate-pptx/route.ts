import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildPptx } from "@/features/storytelling/build-pptx";
import { logger } from "@/lib/logger";
import type { DeckContent, DeckSlide } from "@/features/storytelling/storytelling.types";

// Deck/slide ceilings — this endpoint regenerates the .pptx on every download
// with no persistence, so an oversized posted body is pure wasted CPU/memory.
// Generous enough for any real deck, low enough to bound the work.
const MAX_SLIDES = 200;
const MAX_ITEMS_PER_SLIDE = 100;
const MAX_TABLE_ROWS = 500;
const MAX_TABLE_COLS = 50;
const MAX_STRING_LEN = 5_000;

function isStr(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_STRING_LEN;
}

function isStrArray(value: unknown, max: number): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every(isStr);
}

/** Validates one slide against its discriminated `type` — buildPptx reads
 * `items` / `headers` / `rows` off the slide without checking them, so a
 * payload like `{ type: "bullets" }` would otherwise throw at `.map`. */
function isDeckSlide(value: unknown): value is DeckSlide {
  if (typeof value !== "object" || value === null) return false;
  const slide = value as Record<string, unknown>;
  switch (slide.type) {
    case "title":
      return isStr(slide.title) && (slide.subtitle === undefined || isStr(slide.subtitle));
    case "bullets":
      return isStr(slide.title) && isStrArray(slide.items, MAX_ITEMS_PER_SLIDE);
    case "table":
      return (
        isStr(slide.title) &&
        isStrArray(slide.headers, MAX_TABLE_COLS) &&
        Array.isArray(slide.rows) &&
        slide.rows.length <= MAX_TABLE_ROWS &&
        slide.rows.every((row) => isStrArray(row, MAX_TABLE_COLS))
      );
    default:
      return false;
  }
}

function isDeckContent(value: unknown): value is DeckContent {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { slides?: unknown }).slides) &&
    (value as { slides: unknown[] }).slides.length <= MAX_SLIDES &&
    (value as { slides: unknown[] }).slides.every(isDeckSlide)
  );
}

/** Generates a real .pptx from the posted DeckContent (a "ppt" story's
 * slides, as stored in localStorage — see storytelling-store.ts) — no
 * server-side persistence, the deck is regenerated on every download. */
export async function POST(req: Request) {
  // Testing-only for now — gated the same way the /storytelling pages are
  // (see ENABLE_STORYTELLING in runtime-config.types.ts). No auth middleware
  // sits in front of /api, so this fail-closed check has to live here.
  if (process.env.ENABLE_STORYTELLING !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isDeckContent(body)) {
    return NextResponse.json({ error: "Body must be { slides: DeckSlide[] }" }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await buildPptx(body);
  } catch (err) {
    logger.error({ err }, "[storytelling/generate-pptx] buildPptx failed");
    return NextResponse.json({ error: "Failed to generate presentation" }, { status: 500 });
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
  });
}
