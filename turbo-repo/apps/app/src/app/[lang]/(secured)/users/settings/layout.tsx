export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="h-full w-full overflow-auto">{children}</main>;
}
