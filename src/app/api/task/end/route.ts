import { auth } from "@/auth";
import { endTask } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.next({
        status: 401,
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await request.json();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const taskId = json.taskId as string;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const transitionId: string | undefined = json.transitionId;
    const response = await endTask(session.user.ticket, taskId, transitionId);
    return NextResponse.json({
      success: true,
      status: 200,
      ...response,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    //"{\n    \"status\" : \n  {\n    \"code\" : 500,\n    \"name\" : \"Internal Error\",\n    \"description\" : \"An error inside the HTTP server which prevented it from fulfilling the request.\"\n  },  \n  \n  \"message\" : \"08170003 Wrapped Exception (with status template): 08170049 Failed to execute script 'classpath*:alfresco\\/templates\\/webscripts\\/org\\/alfresco\\/repository\\/workflow\\/end-task.post.js': Exception while invoking TaskListener: Exception while invoking TaskListener: com.mintral.errors.AlerceTripInitError: {\\\"code\\\":\\\"ERROR_ACCION\\\",\\\"message\\\":\\\"Se ha producido un error al realizar la acci\\u00f3n.\\\",\\\"involvedObject\\\":{\\\"numero_servicio\\\":\\\"1135279\\\",\\\"respuesta\\\":\\\"VIAJE SIN CONDUCTOR ASIGNADO\\\"}}\",  \n  \"exception\" : \"\",\n  \n  \"callstack\" : \n  [\n\n  ],\n  \n  \"server\" : \"\",\n  \"time\" : \"Sep 17, 2024, 12:14:07 AM\"\n}\n\n"
    if (error instanceof Error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const errorMessage = parseErrorAsJson(error);
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      success: false,
      status: 500,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      error: (error?.message as string) ?? "Unknown error",
    });
  }
}

function parseErrorAsJson(error: Error): {
  code: string;
  message: string;
  exceptionType: string;
  details: Record<string, unknown>;
} {
  try {
    const parsedError = JSON.parse(error.message) as Record<string, unknown>;
    const errorMessage = parsedError.message as string;
    // Regex to extract exception type and JSON details
    const regex = /(\w+(?:\.\w+)*Error): ({.*})/;
    const match = errorMessage.match(regex);

    if (match) {
      const [, exceptionType, jsonDetails] = match;
      const details = JSON.parse(jsonDetails) as Record<string, unknown>;

      return {
        code: (details.code as string) || "UNKNOWN_ERROR",
        message: (details.message as string) || "An unknown error occurred",
        exceptionType,
        details,
      };
    }

    throw new Error("Unable to parse error details");
  } catch (parseError) {
    return {
      code: "PARSE_ERROR",
      message: "Failed to parse error message",
      exceptionType: "UnknownError",
      details: {},
    };
  }
}
