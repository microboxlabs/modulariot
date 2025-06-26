import SettingsTabs from "../../../components/SettingsTabs";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Organization Settings
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your organization's configuration and preferences.
        </p>
      </div>
      
      <SettingsTabs>
        {children}
      </SettingsTabs>
    </div>
  );
}