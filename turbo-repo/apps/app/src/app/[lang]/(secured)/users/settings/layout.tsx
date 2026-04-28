export default function SettingsLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <main className="h-full w-full overflow-auto">{children}</main>;
}
