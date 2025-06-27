import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@modulariot/db";
import { Card } from "flowbite-react";
import { Plus, Database } from "lucide-react";
import Link from "next/link";

interface ProjectsPageProps {
  params: {
    orgId: string;
  };
}

async function getOrganizationProjects(orgId: string, userEmail: string) {
  // Check if user has access to the organization
  const membership = await prisma.membership.findFirst({
    where: {
      organization: {
        id: orgId,
      },
      user: {
        email: userEmail,
      },
    },
    include: {
      organization: {
        include: {
          projects: {
            include: {
              region: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
  });

  if (!membership) {
    return null;
  }

  return {
    organization: membership.organization,
    projects: membership.organization.projects,
    canCreateProjects: ["OWNER", "ADMIN"].includes(membership.role),
  };
}

export default async function ProjectsPage({ params }: ProjectsPageProps) {
  const session = await auth();

  if (!session?.user?.email) {
    notFound();
  }

  const data = await getOrganizationProjects(params.orgId, session.user.email);

  if (!data) {
    notFound();
  }

  const { organization, projects, canCreateProjects } = data;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Projects
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your organization's projects
          </p>
        </div>
        {canCreateProjects && (
          <Link
            href={`/org/${params.orgId}/projects/new`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={20} className="mr-2" />
            New Project
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Database size={32} className="text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                No projects yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Create your first project to get started with ModularIoT.
              </p>
            </div>
            {canCreateProjects && (
              <Link
                href={`/org/${params.orgId}/projects/new`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus size={20} className="mr-2" />
                Create Project
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {project.region?.displayName || project.regionId}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                        Active
                      </span>
                      <span className="text-xs text-gray-500">
                        {project.dbEngine === "postgres_vector" ? "PostgreSQL + Vector" : "PostgreSQL"}
                      </span>
                    </div>
                  </div>
                  <Database size={20} className="text-gray-400" />
                </div>
                <div className="mt-4">
                  <Link
                    href={`/org/${params.orgId}/project/${project.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View project →
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TODO: Add project search and filtering */}
      {/* TODO: Add project status indicators */}
      {/* TODO: Add project usage metrics */}
      {/* TODO: Add bulk actions for multiple projects */}
    </div>
  );
}