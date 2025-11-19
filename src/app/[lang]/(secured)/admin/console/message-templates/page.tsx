import { Suspense } from "react";
import { auth } from "@/auth";
import { hasAdminAccessForSession } from "@/features/auth/utils/admin-access";
import { AdminMessageTemplatesConsole } from "@/features/common/components/admin-message-templates-console/admin-message-templates-console";
import { redirect } from "next/navigation";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

async function checkAdminAccess() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  try {
    const hasAccess = await hasAdminAccessForSession(session);

    if (!hasAccess) {
      redirect("/"); // Redirect to home if not admin
    }
  } catch (error) {
    console.error("Error checking admin access:", error);
    redirect("/");
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

export default async function MessageTemplatesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.pages as I18nRecord)?.admin as I18nRecord;
  // Check admin access server-side
  await checkAdminAccess();

  return (
    <div className="container mx-auto">
      <div className="w-full h-full flex flex-col overflow-auto">
        <Suspense fallback={<LoadingConsole />}>
          <AdminMessageTemplatesConsole dict={dict} />
        </Suspense>
      </div>
    </div>
  );
}
