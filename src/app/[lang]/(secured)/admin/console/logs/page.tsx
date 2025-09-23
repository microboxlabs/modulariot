import { Suspense } from "react";
import { auth } from "@/auth";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { AdminLogConsole } from "@/features/common/components/admin-log-console/admin-log-console";
import { redirect } from "next/navigation";
import { logError } from "@/lib/logger";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import { HiClipboardList } from "react-icons/hi";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord, ParamsWithLang } from "@/features/i18n/i18n.service.types";

// Admin groups that can access log management
const ADMIN_GROUPS = [
  "GROUP_ALFRESCO_ADMINISTRATORS",
  "GROUP_MINTRAL_SYSTEM_ADMIN",
];

async function checkAdminAccess() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  try {
    const userGroups = await getGroupsForPerson(session);
    const hasAccess = userGroups.some((group) => ADMIN_GROUPS.includes(group));

    if (!hasAccess) {
      redirect("/shipping"); // Redirect to home if not admin
    }
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      context: "checkAdminAccess",
    });
    redirect("/shipping");
  }
}

function LoadingConsole() {
  return (
    <div className="p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function LogManagementPage({
  params: { lang },
}: ParamsWithLang) {
  // Check admin access server-side
  await checkAdminAccess();
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.pages as I18nRecord)?.admin as I18nRecord;
  return (
    <div className="w-full h-full flex flex-col overflow-auto">
      <div className="inline-block align-middle relative">
        <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
          <div>
            <nav className="text-sm text-gray-600 mb-4">
              <ClientBreadcrumb
                path={[
                  "breadcrumb.admin",
                  "breadcrumb.console",
                  "breadcrumb.logs",
                ]}
                rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
                dict={dict}
              />
            </nav>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-blue-800 font-medium">
                Admin Log Management
              </h3>
              <p className="text-blue-700 text-sm mt-1">
                Manage log levels for all application components in real-time.
                Changes take effect immediately.
              </p>
            </div>
          </div>
        </div>
        <div className="h-screen w-full overflow-auto">
          <Suspense fallback={<LoadingConsole />}>
            <AdminLogConsole />
          </Suspense>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-700">
            <h4 className="font-medium mb-2">Quick Tips:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Use "debug" level for detailed troubleshooting</li>
              <li>Use "info" level for normal production logging</li>
              <li>
                Use "warn" or "error" levels to reduce noise in production
              </li>
              <li>
                Use "Cascade" button to apply a level to all child loggers
              </li>
              <li>Changes are persistent and survive application restarts</li>
            </ul>
          </div>
        </div>
      </div>
      <div className=""></div>
    </div>
  );
}
