import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@modulariot/db";
import { auth } from "@/lib/auth";
import { auth0Client } from "@/lib/api/auth0";

const credentialsParamsSchema = z.object({
  orgId: z.string().min(1),
  id: z.string().min(1),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string; id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { orgId, id: projectId } = params;

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
    const identityApp = await prisma.projectIdentityApp.findFirst({
      where: {
        projectId: projectId,
      },
    });

    if (!identityApp) {
      return NextResponse.json(
        { message: "Project not found" },
        { status: 404 }
      );
    }

    const appClient = await auth0Client.getClient(identityApp.externalAppId);

    const credentials = {
      auth0: {
        domain: identityApp?.tenant ? `${identityApp.tenant}.auth0.com` : "dev-example.auth0.com",
        clientId: identityApp?.externalAppId || "your_client_id_here",
        audience: "https://modulariot.com/v1/project/admin",
        grantType: "client_credentials",
        clientSecret: appClient.client_secret,
      },
      ingest: {
        url: process.env.NEXT_PUBLIC_INGEST_URL!,
        endpoint: `/v1/org/${orgId}/proj/${projectId}`,
      }
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