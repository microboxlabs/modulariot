import { Card } from "flowbite-react";
import { BarChart3 } from "lucide-react";

export default function UsagePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usage</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Monitor your project's resource consumption and usage metrics.
        </p>
      </div>

      <Card>
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Usage Analytics
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            This feature is coming soon. You'll be able to view detailed usage metrics and analytics.
          </p>
        </div>
      </Card>
    </div>
  );
}