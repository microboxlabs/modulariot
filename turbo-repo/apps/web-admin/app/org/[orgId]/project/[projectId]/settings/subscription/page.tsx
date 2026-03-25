import { Card } from "flowbite-react";
import { CreditCard } from "lucide-react";

export default function SubscriptionPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {"Manage your project's billing and subscription settings."}
        </p>
      </div>

      <Card>
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Subscription Management
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {"This feature is coming soon. You'll be able to manage billing, plans, and payment methods."}
          </p>
        </div>
      </Card>
    </div>
  );
}