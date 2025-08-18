import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasAdminAccessForSession } from "@/features/auth/utils/admin-access";
import {
  createWebhookDefinition,
  updateWebhookDefinition,
  deleteWebhookDefinition,
  listWebhookDefinitions,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  CreateWebhookRequest,
  UpdateWebhookRequest,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";

/**
 * GET /api/admin/webhooks
 * List webhook definitions
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

    const webhooks = (await listWebhookDefinitions(session, site, kind))
      .webhookDefs;

    // Group webhooks by webhookKind for easier frontend consumption
    const groupedWebhooks = webhooks.reduce(
      (acc, webhook) => {
        const kind = webhook.webhookKind || "UNKNOWN";
        if (!acc[kind]) {
          acc[kind] = [];
        }
        acc[kind].push(webhook);
        return acc;
      },
      {} as Record<string, typeof webhooks>
    );

    return NextResponse.json({
      webhooks,
      groupedWebhooks,
      meta: {
        total: webhooks.length,
        groups: Object.keys(groupedWebhooks).length,
        site,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching webhook definitions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/webhooks
 * Create a new webhook definition
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

    const body: CreateWebhookRequest = await request.json();
    const { site, templateId, webhookUrl, webhookKind, template } = body;

    // Validate required fields
    if (!site || !templateId || !webhookUrl || !webhookKind) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: site, templateId, webhookUrl, webhookKind",
        },
        { status: 400 }
      );
    }

    // Validate webhook URL format
    try {
      new URL(webhookUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid webhook URL format" },
        { status: 400 }
      );
    }

    const webhook = await createWebhookDefinition(session, {
      site,
      templateId,
      webhookUrl,
      webhookKind,
      template,
    });

    return NextResponse.json({
      success: true,
      webhook,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating webhook definition:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/webhooks
 * Update a webhook definition
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

    const body: UpdateWebhookRequest = await request.json();
    const { webhookDef, templateId, webhookUrl, webhookKind, template } = body;

    // Validate required fields
    if (!webhookDef) {
      return NextResponse.json(
        { error: "webhookDef parameter is required" },
        { status: 400 }
      );
    }

    // Validate webhook URL format if provided
    if (webhookUrl) {
      try {
        new URL(webhookUrl);
      } catch {
        return NextResponse.json(
          { error: "Invalid webhook URL format" },
          { status: 400 }
        );
      }
    }

    const updatedWebhook = await updateWebhookDefinition(session, {
      webhookDef,
      templateId,
      webhookUrl,
      webhookKind,
      template,
    });

    return NextResponse.json({
      success: true,
      webhook: updatedWebhook,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating webhook definition:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/webhooks
 * Delete a webhook definition
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
    const webhookDefNodeRef = searchParams.get("webhookDef");

    if (!webhookDefNodeRef) {
      return NextResponse.json(
        { error: "webhookDef parameter is required" },
        { status: 400 }
      );
    }

    await deleteWebhookDefinition(session, webhookDefNodeRef);

    return NextResponse.json({
      success: true,
      deletedWebhook: webhookDefNodeRef,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error deleting webhook definition:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
