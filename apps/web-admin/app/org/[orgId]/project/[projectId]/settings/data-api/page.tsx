import { Card } from "flowbite-react";
import { Database } from "lucide-react";

export default function DataApiPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data API</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure your project's data access endpoints and permissions.
        </p>
      </div>

      <Card>
        <div className="text-center py-12">
          <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Data API Configuration
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            This feature is coming soon. You'll be able to configure data access patterns and API endpoints.
          </p>
        </div>
      </Card>
    </div>
  );
}