import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@modulariot/db";
import { auth } from "@/lib/auth";

const credentialsParamsSchema = z.object({
  orgId: z.string().min(1),
  projectId: z.string().min(1),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string; projectId: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { orgId, projectId } = credentialsParamsSchema.parse(params);

    // Check if user has access to the organization
    const membership = await prisma.membership.findFirst({
      where: {
        organization: {
          id: orgId,
        },
        user: {
          email: session.user.email,
        },
        role: {
          in: ["OWNER", "ADMIN", "MEMBER"], // All members can view credentials
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { message: "Forbidden: You don't have access to this organization" },
        { status: 403 }
      );
    }

    // Check if project exists in the organization
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: orgId,
      },
      include: {
        identityApp: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project not found" },
        { status: 404 }
      );
    }

    // TODO: Load real Auth0 credentials from ProjectIdentityApp
    // For now, return stubbed data
    const credentials = {
      auth0: {
        domain: project.identityApp?.tenant ? `${project.identityApp.tenant}.auth0.com` : "dev-example.auth0.com",
        clientId: project.identityApp?.externalAppId || "your_client_id_here",
        audience: "https://modulariot.com/v1/project/admin",
        grantType: "client_credentials",
        // Never expose client_secret in API response
      },
      ingest: {
        url: process.env.NEXT_PUBLIC_INGEST_URL || "https://ingest.miot.io",
        endpoint: `/v1/org/${orgId}/proj/${projectId}`,
      },
      project: {
        id: projectId,
        name: project.name,
        organizationId: orgId,
      },
    };

    return NextResponse.json(credentials);
  } catch (error) {
    console.error("Error fetching credentials:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid parameters", errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}