import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { acknowledgeHandler } from "@/features/ext-tasks/handlers/acknowledge.handler";
import {
  handleApiError,
  unauthorizedResponse,
  badRequestResponse,
} from "@/app/api/utils/api-error-handler";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const body = await req.json();
    const { symptom_id, asset_id, trip_id, reason, invalidated_by, treatment_id } =
      body as {
        symptom_id?: string;
        asset_id?: string;
        trip_id?: string;
        reason?: string;
        invalidated_by?: string;
        treatment_id?: number;
      };

    if (!reason || reason.trim().length === 0) {
      return badRequestResponse("A reason is required to invalidate a symptom");
    }

    const result = await acknowledgeHandler({
      symptom_id,
      asset_id,
      trip_id,
      reason,
      invalidated_by,
      treatment_id,
      action: "invalidate_symptom",
      status_validation: "invalidated",
    });

    return Response.json(result);
  } catch (error) {
    return handleApiError(error, "invalidating symptom");
  }
}
