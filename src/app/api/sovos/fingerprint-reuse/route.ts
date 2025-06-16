import { NextRequest, NextResponse } from "next/server";

const cache: Record<string, { value: any; expires: number }> = {};
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { rut, result } = await request.json();
    if (!rut || !result) {
      return NextResponse.json(
        { error: "Missing rut or result" },
        { status: 400 },
      );
    }
    // Save to cache with 1 day expiration
    cache[rut] = { value: result, expires: Date.now() + ONE_DAY_MS };
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save result" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rut = searchParams.get("rut");
  if (!rut) {
    return NextResponse.json({ error: "Missing rut" }, { status: 400 });
  }
  const cached = cache[rut];
  if (!cached || cached.expires < Date.now()) {
    return NextResponse.json(
      { error: "Not found or expired" },
      { status: 404 },
    );
  }
  return NextResponse.json({ result: cached.value });
}
