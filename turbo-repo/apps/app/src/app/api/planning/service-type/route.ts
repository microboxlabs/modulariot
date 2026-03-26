import { requireAuth } from "../../utils/alfresco-crud-client";
import { updateTaskServiceCategory } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";

const PatchBodySchema = z.object({
  taskId: z.string(),
  serviceTypeCode: z.string(),
});

export async function PATCH(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "taskId and serviceTypeCode are required" },
      { status: 400 }
    );
  }

  const { taskId, serviceTypeCode } = parsed.data;

  try {
    await updateTaskServiceCategory(authResult.session, taskId, serviceTypeCode);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error({ err: error }, "Failed to update service category");
    return NextResponse.json(
      { error: "Failed to update service category" },
      { status: 500 }
    );
  }
}
