"use client";

import { HiClipboardList } from "react-icons/hi";
import { Breadcrumb } from "@/features/common/components/Breadcrumb/Breadcrumb";
import { SectionHeader } from "@/features/layout/components/section-header/section-header";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import ClientMapStarter from "@/features/geographic-view/components/client-map-starter";
import { GeographicProfileProvider } from "@/features/geographic-view/profiles/geographic-profile-context";
import ProfileDropdown from "@/features/geographic-view/profiles/profile-dropdown";

export default function GeographicViewShell({
  lang,
  dict,
}: Readonly<{
  lang: string;
  dict: I18nRecord;
}>) {
  const breadcrumbDict = dict["symptoms"] as I18nRecord;
  return (
    <GeographicProfileProvider>
      <div className="flex h-full w-full flex-col">
        <SectionHeader
          lang={lang}
          filterDict={dict as I18nRecord}
          leftContent={
            <div className="flex items-center">
              <Breadcrumb
                path={["mission_control", "geographic_view"]}
                lang={lang}
                rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
                dict={breadcrumbDict}
                disableLinks
              />
              <ProfileDropdown dict={dict} />
            </div>
          }
        />
        <div className="relative flex-1">
          <ClientMapStarter dict={dict} />
        </div>
      </div>
    </GeographicProfileProvider>
  );
}
