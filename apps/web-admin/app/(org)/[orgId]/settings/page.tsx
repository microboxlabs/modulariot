import { redirect } from "next/navigation";

interface SettingsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { orgId } = await params;
  redirect(`/org/${orgId}/settings/general`);
}