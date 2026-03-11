import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getPlainTextNode,
  uploadNodeContent,
  resolveNodeByPath,
  ensureFolder,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  handleApiError,
  unauthorizedResponse,
  badRequestResponse,
} from "@/app/api/utils/api-error-handler";

/**
 * GET /api/dashboard/config?site={siteShortName}&slug={slug}
 *
 * Reads a dashboard config JSON from Alfresco:
 *   Sites/{site}/documentLibrary/dashboard/{slug}-config.json
 *
 * Returns { data: <parsed JSON> } or { data: null } if the file doesn't exist yet.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return unauthorizedResponse();
  }

  const { searchParams } = request.nextUrl;
  const site = searchParams.get("site");
  const slug = searchParams.get("slug");

  if (!site || !slug) {
    return badRequestResponse("Missing required query parameters: site, slug");
  }

  try {
    const relativePath = `Sites/${site}/documentLibrary/dashboard/${slug}-config.json`;
    const nodeId = await resolveNodeByPath(session, relativePath);

    if (!nodeId) {
      return NextResponse.json({ data: null });
    }

    const content = await getPlainTextNode(session, nodeId);
    const parsed = JSON.parse(content);

    return NextResponse.json({ data: parsed });
  } catch (error) {
    return handleApiError(error, "reading dashboard config from Alfresco");
  }
}

/**
 * PUT /api/dashboard/config
 *
 * Saves a dashboard config JSON to Alfresco:
 *   Sites/{site}/documentLibrary/dashboard/{slug}-config.json
 *
 * Body: { site: string, slug: string, config: DashboardStorageSchema }
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const body = (await request.json()) as {
      site?: string;
      slug?: string;
      config?: unknown;
    };
    const { site, slug, config } = body;

    if (!site || !slug || !config) {
      return badRequestResponse(
        "Missing required fields: site, slug, config"
      );
    }

    // Ensure the "dashboard" folder exists under documentLibrary
    const docLibPath = `Sites/${site}/documentLibrary`;
    const docLibNodeId = await resolveNodeByPath(session, docLibPath);
    if (!docLibNodeId) {
      return NextResponse.json(
        { error: `documentLibrary not found for site '${site}'` },
        { status: 404 }
      );
    }
    await ensureFolder(session, docLibNodeId, "dashboard");

    // Upload the config file into the existing folder
    const filename = `${slug}-config.json`;
    const blob = new Blob([JSON.stringify(config)], {
      type: "application/json",
    });
    const file = new File([blob], filename, { type: "application/json" });

    const result = await uploadNodeContent(session, {
      filedata: file,
      siteId: site,
      containerId: "documentLibrary",
      uploadDirectory: "/dashboard",
      filename,
      overwrite: true,
    });

    if (!result || (result.status && result.status.code >= 400)) {
      return NextResponse.json(
        { error: result?.status?.message ?? "Upload failed" },
        { status: result?.status?.code ?? 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "saving dashboard config to Alfresco");
  }
}
