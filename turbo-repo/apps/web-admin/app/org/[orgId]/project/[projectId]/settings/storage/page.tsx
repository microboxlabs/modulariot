import { Card } from "flowbite-react";
import { HardDrive } from "lucide-react";

export default function StoragePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Storage</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage storage settings, buckets, and file upload configurations.
        </p>
      </div>

      <Card>
        <div className="text-center py-12">
          <HardDrive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Storage Configuration
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {"This feature is coming soon. You'll be able to configure storage buckets and file management settings."}
          </p>
        </div>
      </Card>
    </div>
  );
}