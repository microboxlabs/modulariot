import { Card } from "flowbite-react";
import { Shield } from "lucide-react";

export default function AuthenticationPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Authentication</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure authentication methods and security settings for your project.
        </p>
      </div>

      <Card>
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Authentication Settings
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {"This feature is coming soon. You'll be able to configure authentication providers and security policies."}
          </p>
        </div>
      </Card>
    </div>
  );
}