import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { logManagementAPI, LogLevel } from "@/lib/logger";
import { hasAdminAccessForSession } from "@/features/auth/utils/admin-access";

/**
 * GET /api/admin/logs
 * Get all log handlers information
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session || !(await hasAdminAccessForSession(session))) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const handlers = logManagementAPI.getAllHandlers();
    const tree = logManagementAPI.getHandlerTree();

    return NextResponse.json({
      handlers,
      tree,
      meta: {
        total: handlers.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching log handlers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/logs
 * Update log level for one or more handlers
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !(await hasAdminAccessForSession(session))) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { handlerId, level, cascadeToChildren = false } = body;

    // Validate input
    if (!handlerId || !level) {
      return NextResponse.json(
        { error: "handlerId and level are required" },
        { status: 400 }
      );
    }

    const validLevels: LogLevel[] = [
      "fatal",
      "error",
      "warn",
      "info",
      "debug",
      "trace",
    ];
    if (!validLevels.includes(level)) {
      return NextResponse.json(
        {
          error: `Invalid log level. Must be one of: ${validLevels.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const success = logManagementAPI.setLogLevel(
      handlerId,
      level,
      cascadeToChildren
    );

    if (!success) {
      return NextResponse.json({ error: "Handler not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      handlerId,
      level,
      cascadeToChildren,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating log level:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/logs
 * Create a new log handler
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !(await hasAdminAccessForSession(session))) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, level, parent } = body;

    // Validate input
    if (!id || !name) {
      return NextResponse.json(
        { error: "id and name are required" },
        { status: 400 }
      );
    }

    if (level) {
      const validLevels: LogLevel[] = [
        "fatal",
        "error",
        "warn",
        "info",
        "debug",
        "trace",
      ];
      if (!validLevels.includes(level)) {
        return NextResponse.json(
          {
            error: `Invalid log level. Must be one of: ${validLevels.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    const logger = logManagementAPI.registerHandler(id, name, level, parent);

    return NextResponse.json({
      success: true,
      handler: {
        id,
        name,
        level: logger.level,
        parent,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating log handler:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/logs
 * Remove a log handler
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !(await hasAdminAccessForSession(session))) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const handlerId = searchParams.get("handlerId");

    if (!handlerId) {
      return NextResponse.json(
        { error: "handlerId parameter is required" },
        { status: 400 }
      );
    }

    const success = logManagementAPI.removeHandler(handlerId);

    if (!success) {
      return NextResponse.json({ error: "Handler not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      removedHandlerId: handlerId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error removing log handler:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
