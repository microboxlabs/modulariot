import { redirect } from "next/navigation";

interface SettingsPageProps {
  params: {
    orgId: string;
    projectId: string;
  };
}

export default function SettingsPage({ params }: SettingsPageProps) {
  redirect(`/org/${params.orgId}/project/${params.projectId}/settings/general`);
}