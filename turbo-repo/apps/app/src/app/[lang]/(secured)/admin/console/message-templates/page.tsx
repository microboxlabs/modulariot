import { Suspense } from "react";
import { guardPage } from "@/features/auth/access/server-access";
import { ACCESS_RULES } from "@/features/auth/access/access-rules";
import { AdminMessageTemplatesConsole } from "@/features/common/components/admin-message-templates-console/admin-message-templates-console";
import { getDictionary } from "@/features/i18n/i18n.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

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
  await guardPage(
    ACCESS_RULES.adminConsole,
    "/admin/console/message-templates"
  );
  const { lang } = await params;
  const [, dictionary] = await getDictionary(lang);
  const dict = (dictionary.pages as I18nRecord)?.admin as I18nRecord;

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
