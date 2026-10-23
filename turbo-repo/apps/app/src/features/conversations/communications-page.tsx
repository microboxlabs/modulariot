"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useControlTowerAccess } from "@/features/symptoms/maintainer/maintainer-api";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import ActivityTab from "./activity-tab";
import CommunicationsTabs, {
  COMMUNICATIONS_PANEL_ID,
  COMMUNICATIONS_TABS,
  tabId,
  type CommunicationsTab,
} from "./communications-tabs";
import RulesTab from "./rules-tab";
import TemplatesTab from "./templates-tab";

function tabOf(value: string | null): CommunicationsTab {
  return (COMMUNICATIONS_TABS as readonly string[]).includes(value ?? "")
    ? (value as CommunicationsTab)
    : "rules";
}

/** Settings › Comunicaciones: the rules that send messages on events, their templates and what they did. */
export default function CommunicationsPage({
  dict,
  lang,
}: Readonly<{ dict: I18nRecord; lang: string }>) {
  const d = dict?.communications as I18nRecord;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = tabOf(params.get("tab"));
  const { canMaintain } = useControlTowerAccess();

  const onTab = (next: CommunicationsTab) => {
    const q = new URLSearchParams(params.toString());
    if (next === "rules") q.delete("tab");
    else q.set("tab", next);
    const query = q.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex w-full items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
        <Breadcrumb
          dict={dict?.breadcrumb as I18nRecord}
          lang={lang}
          path={["user", "settings", "communications"]}
          disableLinks
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 pt-4 pb-10">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {tr("title", d)}
            </h1>
            <p className={`text-sm ${MUTED}`}>{tr("description", d)}</p>
          </div>
          <CommunicationsTabs tab={tab} d={d} onTab={onTab} />
          <div
            role="tabpanel"
            id={COMMUNICATIONS_PANEL_ID}
            aria-labelledby={tabId(tab)}
          >
            {tab === "rules" && (
              <RulesTab lang={lang} canWrite={canMaintain} d={d} />
            )}
            {tab === "templates" && (
              <TemplatesTab lang={lang} canWrite={canMaintain} d={d} />
            )}
            {tab === "activity" && <ActivityTab lang={lang} d={d} />}
          </div>
        </div>
      </div>
    </div>
  );
}
