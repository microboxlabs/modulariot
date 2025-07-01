import { redirect } from "next/navigation";

interface SettingsPageProps {
  params: Promise<{
    orgId: string;
    projectId: string;
  }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { orgId, projectId } = await params;
  redirect(`/org/${orgId}/project/${projectId}/settings/general`);
}