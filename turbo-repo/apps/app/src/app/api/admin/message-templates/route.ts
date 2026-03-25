import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAdminAccessForSession } from "@/features/auth/utils/admin-access";
import {
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  listMessageTemplates,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";

/**
 * GET /api/admin/message-templates
 * List message templates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session || !(await hasAdminAccessForSession(session))) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const site = searchParams.get("site") || "mintral";
    const kind = searchParams.get("kind") || "MS_TEAMS";

    const templates = (await listMessageTemplates(session, site, kind))
      .templates;

    return NextResponse.json({
      templates,
      meta: {
        total: templates.length,
        site,
        kind,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching message templates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/message-templates
 * Create a new message template
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

    const body: CreateTemplateRequest = await request.json();
    const { site, kind, templateId, engineExt, content } = body;

    // Validate required fields
    if (!site || !kind || !templateId || !engineExt || !content) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: site, kind, templateId, engineExt, content",
        },
        { status: 400 }
      );
    }

    const template = await createMessageTemplate(session, {
      site,
      kind,
      templateId,
      engineExt,
      content,
    });

    return NextResponse.json({
      success: true,
      template,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating message template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/message-templates
 * Update a message template
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

    const body: UpdateTemplateRequest = await request.json();
    const { template, content } = body;

    // Validate required fields
    if (!template || !content) {
      return NextResponse.json(
        { error: "Missing required fields: template, content" },
        { status: 400 }
      );
    }

    const updatedTemplate = await updateMessageTemplate(session, {
      template,
      content,
    });

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating message template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/message-templates
 * Delete a message template
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
    const templateNodeRef = searchParams.get("template");

    if (!templateNodeRef) {
      return NextResponse.json(
        { error: "template parameter is required" },
        { status: 400 }
      );
    }

    await deleteMessageTemplate(session, templateNodeRef);

    return NextResponse.json({
      success: true,
      deletedTemplate: templateNodeRef,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error deleting message template:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
