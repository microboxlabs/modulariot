import { auth } from "@/auth";
import { updateTask } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";
import {
  UpdateTaskPropertiesRequest,
  UpdateTaskPropertiesResponse,
} from "./route.types";
import { logger, logError } from "@/lib/logger";
import {
  getErrorMessage,
  getErrorStatus,
} from "@/app/api/utils/api-error-handler";

/**
 * API Route for updating task properties without ending the task.
 * This is inspired by Alfresco's formProcessor pattern but simplified
 * for inline editing use cases.
 *
 * The route handles property name mapping:
 * - Fields already prefixed with "prop_" are passed through directly
 * - Fields starting with "mintral_" are automatically prefixed with "prop_"
 * - Other fields are prefixed with "prop_" for Alfresco compatibility
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<UpdateTaskPropertiesResponse>> {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const json = (await request.json()) as UpdateTaskPropertiesRequest;
    const { taskId, properties } = json;

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          error: "taskId is required",
        },
        { status: 400 }
      );
    }

    if (!properties || Object.keys(properties).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "properties object is required and cannot be empty",
        },
        { status: 400 }
      );
    }

    // Build the update payload with proper property mapping
    const updatePayload: Record<string, unknown> = {};

    // Handle property name mapping (similar to endTask route)
    Object.entries(properties).forEach(([key, value]) => {
      // If already has prop_ prefix, use as-is
      if (key.startsWith("prop_")) {
        updatePayload[key] = value;
      }
      // For any other custom fields (including mintral_*), add prop_ prefix
      // This allows maximum flexibility for future editable fields
      else if (!key.startsWith("_")) {
        // Exclude internal fields
        const propKey = `prop_${key}`;
        updatePayload[propKey] = value;
      }
    });

    logger.info(
      `Updating task ${taskId} with properties: ${JSON.stringify(updatePayload)}`
    );

    // Call the Alfresco form processor to update the task
    await updateTask(session, "activiti$" + taskId, updatePayload);

    return NextResponse.json({
      success: true,
      updatedProperties: updatePayload,
    });
  } catch (error: unknown) {
    logError(error as Error, { context: "updating task properties" });

    const status = getErrorStatus(error);
    const errorMessage = getErrorMessage(error, "Failed to update task. Please try again.");

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status }
    );
  }
}
