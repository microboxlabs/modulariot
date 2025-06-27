import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@modulariot/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

const createProjectSchema = z.object({
  organizationId: z.string().min(1, "Organization is required"),
  name: z.string()
    .min(3, "Project name must be at least 3 characters")
    .max(20, "Project name must be less than 20 characters")
    .regex(/^[a-z0-9-]+$/, "Project name must contain only lowercase letters, numbers, and hyphens"),
  regionId: z.string().min(1, "Region is required"),
  superadminPassword: z.string().min(8, "Password must be at least 8 characters"),
  securityMode: z.enum(["api_and_connection", "connection_only"]),
  apiSchema: z.enum(["public", "dedicated"]),
  dbEngine: z.enum(["postgres", "postgres_vector"]),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createProjectSchema.parse(body);

    // Check if user has access to the organization
    const membership = await prisma.membership.findFirst({
      where: {
        organization: {
          id: validatedData.organizationId,
        },
        user: {
          email: session.user.email,
        },
        role: {
          in: ["OWNER", "ADMIN"], // Only owners and admins can create projects
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { message: "Forbidden: You don't have permission to create projects in this organization" },
        { status: 403 }
      );
    }

    // Generate slug from project name
    const slug = slugify(validatedData.name);

    // Check if project slug already exists in the organization
    const existingProject = await prisma.project.findFirst({
      where: {
        organizationId: validatedData.organizationId,
        slug: slug,
      },
    });

    if (existingProject) {
      return NextResponse.json(
        { message: "A project with this name already exists in the organization" },
        { status: 400 }
      );
    }

    // Hash the superadmin password
    const hashedPassword = await bcrypt.hash(validatedData.superadminPassword, 12);

    // Create the project
    const project = await prisma.project.create({
      data: {
        name: validatedData.name,
        slug: slug,
        regionId: validatedData.regionId,
        superadminPassword: hashedPassword,
        organizationId: validatedData.organizationId,
        securityMode: validatedData.securityMode,
        apiSchema: validatedData.apiSchema,
        dbEngine: validatedData.dbEngine,
      },
    });

    // TODO: Trigger project infrastructure setup (database creation, API endpoints, etc.)
    // TODO: Send notification to organization members
    // TODO: Log audit event

    return NextResponse.json(
      { projectId: project.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating project:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Validation error", errors: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}