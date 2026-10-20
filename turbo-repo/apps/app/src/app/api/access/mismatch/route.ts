import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  accessSource,
  logAccessMismatch,
} from "@/features/auth/access/server-access";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

const MismatchSchema = z.object({
  key: z.string().min(1).max(200),
  context: z.string().max(300).optional(),
  byGroups: z.boolean(),
  byPermissions: z.boolean().nullable(),
});

/** Logs a gate the browser decided differently by groups and by permissions (shadow mode only). */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (accessSource() !== "shadow") {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = MismatchSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const scope = await resolveTenantScope();
  const { key, context, byGroups, byPermissions } = parsed.data;
  logAccessMismatch(
    {
      userEmail: session.user.email,
      org: scope.resolved ? scope.scope.activeOrg.slug : null,
      key,
      context: context ? `client:${context}` : "client",
    },
    { byGroups, byPermissions }
  );
  return new NextResponse(null, { status: 204 });
}
