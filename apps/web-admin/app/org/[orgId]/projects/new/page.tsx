import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@modulariot/db";
import { CreateProjectForm } from "@/app/components/CreateProjectForm";

interface NewProjectPageProps {
  params: Promise<{
    orgId: string;
  }>;
}

async function getOrganizationsForUser(userEmail: string) {
  const memberships = await prisma.membership.findMany({
    where: {
      user: {
        email: userEmail,
      },
      role: {
        in: ["OWNER", "ADMIN"], // Only owners and admins can create projects
      },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return memberships.map((membership) => membership.organization);
}

export default async function NewProjectPage({ params }: NewProjectPageProps) {
  const session = await auth();

  if (!session?.user?.email) {
    notFound();
  }

  const organizations = await getOrganizationsForUser(session.user.email);
  const { orgId } = await params;
  // Check if user has access to the specified organization
  const currentOrg = organizations.find((org) => org.id === orgId);
  if (!currentOrg) {
    notFound();
  }

  return (
    <div className="grid place-items-center h-screen">
      <div className="max-w-lg w-full border rounded-2xl shadow-md bg-white dark:bg-slate-900 pt-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Create Project
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Set up your project with database and API configuration
          </p>
        </div>
        <CreateProjectForm
          orgId={orgId}
          organizations={organizations}
        />
      </div>
    </div>
  );
}