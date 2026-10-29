"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  HiOutlineChartBar,
  HiOutlineGlobeAlt,
  HiOutlineLocationMarker,
} from "react-icons/hi";
import FilterSearch from "@/features/common/components/filter-search";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import SectionMenu, {
  type SectionMenuEntry,
} from "@/features/common/components/section-menu";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import GeocodingUsage from "./geocoding-usage";
import ReviewQueue from "./review-queue";

type GeocodingSection = "review" | "usage";
const SECTIONS: readonly GeocodingSection[] = ["review", "usage"];

/** The section in `?section=`; the review queue when absent or unknown. */
export function geocodingSectionOf(params: URLSearchParams): GeocodingSection {
  const value = params.get("section");
  return SECTIONS.find((s) => s === value) ?? "review";
}

const SECTION_ICONS: Record<
  GeocodingSection,
  SectionMenuEntry<GeocodingSection>["icon"]
> = {
  review: HiOutlineLocationMarker,
  usage: HiOutlineChartBar,
};

/**
 * Settings › Geocodificación: locations to place by hand and the month's usage
 * against the quota. The provider is the platform's, set in Settings › Platform.
 */
export default function GeocodingPageContent({
  dict,
  lang,
}: Readonly<{ dict: I18nRecord; lang: string }>) {
  const d = dict?.geocoding as I18nRecord;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const section = geocodingSectionOf(params);
  const { activeOrg } = useOrgScopes();
  const orgSlug = activeOrg?.slug ?? null;
  const [q, setQ] = useState("");
  const rd = d?.review as I18nRecord;

  const onSection = (next: GeocodingSection) => {
    const query = new URLSearchParams(params.toString());
    if (next === "review") query.delete("section");
    else query.set("section", next);
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const sections: SectionMenuEntry<GeocodingSection>[] = SECTIONS.map((id) => ({
    id,
    label: tr(`sections.${id}.label`, d),
    description: tr(`sections.${id}.description`, d),
    icon: SECTION_ICONS[id],
  }));

  return (
    <SettingsPageShell
      breadcrumbDict={dict?.breadcrumb as I18nRecord}
      lang={lang}
      path={["user", "settings", "geocoding"]}
      icon={HiOutlineGlobeAlt}
      title={tr("pageTitle", d)}
      description={tr("pageDescription", d)}
      filters={
        section === "review" && (
          <FilterSearch
            value={q}
            onChange={setQ}
            label={tr("search", rd)}
            placeholder={tr("search", rd)}
          />
        )
      }
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 max-md:overflow-y-auto md:grid-cols-[320px_1fr]">
        <SectionMenu
          title={tr("menuTitle", d)}
          sections={sections}
          selected={section}
          onSelect={onSection}
        />
        <div className="-m-1 flex min-h-0 flex-col gap-4 p-1 md:overflow-y-auto">
          {section === "review" && <ReviewQueue q={q} d={rd} />}
          {section === "usage" && (
            <GeocodingUsage
              orgSlug={orgSlug}
              lang={lang}
              d={d?.usage as I18nRecord}
            />
          )}
        </div>
      </div>
    </SettingsPageShell>
  );
}
