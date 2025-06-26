import SettingsTabs from "../../../components/SettingsTabs";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
          Organization Settings
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your organization's configuration and preferences.
        </p>
      </div>
      <div className="container max-w-4xl">
        <SettingsTabs>
          {children}
        </SettingsTabs>
      </div>
    </div>
  );
}