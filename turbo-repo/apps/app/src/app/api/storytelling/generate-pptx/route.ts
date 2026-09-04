import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildPptx } from "@/features/storytelling/build-pptx";
import type { DeckContent } from "@/features/storytelling/storytelling.types";

function isDeckContent(value: unknown): value is DeckContent {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { slides?: unknown }).slides)
  );
}

/** Generates a real .pptx from the posted DeckContent (a "ppt" story's
 * slides, as stored in localStorage — see storytelling-store.ts) — no
 * server-side persistence, the deck is regenerated on every download. */
export async function POST(req: NextRequest) {
  // Same gate the storytelling pages use (see [id]/page.tsx) — otherwise an
  // authenticated user could hit this route directly and generate the demo
  // deck even with the feature flag off.
  if (process.env.ENABLE_STORYTELLING !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  const buffer = await buildPptx(body);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
  });
}
