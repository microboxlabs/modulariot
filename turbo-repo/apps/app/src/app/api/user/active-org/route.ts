import { auth } from "@/auth";
import { evictScopeCache } from "@/app/api/utils/tenant-scope";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Sets the active organization for the current user.
 * Stores the org slug in an httpOnly cookie and evicts the scope cache
 * so the next request picks up the new active org immediately.
 *
 * Body: { "slug": "traza" }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const slug = body.slug?.trim();
  if (!slug) {
    return NextResponse.json(
      { error: "slug is required" },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set("miot_active_org", slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  evictScopeCache(session.user.id);

  return NextResponse.json({ activeOrg: slug });
}
