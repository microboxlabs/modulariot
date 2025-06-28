import ProjectSettingsShell from "@/app/components/ProjectSettingsShell";

export default function ProjectSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProjectSettingsShell>{children}</ProjectSettingsShell>;
}