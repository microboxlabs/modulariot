"use client";

import { useState, type ReactNode } from "react";
import { Spinner } from "flowbite-react";
import {
  HiOutlineChartBar,
  HiOutlineChip,
  HiOutlineCreditCard,
  HiOutlineGlobeAlt,
  HiOutlineKey,
  HiOutlineMap,
  HiOutlinePhotograph,
  HiOutlineShare,
  HiOutlineTemplate,
  HiOutlineTruck,
  HiServer,
} from "react-icons/hi";
import SettingsPageShell from "@/features/common/components/settings-page-shell";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import MailTemplateEditor from "../mail-templates/mail-template-editor";
import BrandingSection from "./branding-section";
import HarnessPlanSection from "./harness-plan-section";
import ModelProvidersSection from "./model-providers-section";
import ModelUsageCard from "./model-usage-card";
import PlatformVehicleImagesSection from "./platform-vehicle-images-section";
import PlatformGeocodingSection from "./platform-geocoding-section";
import GeocodingPlanSection from "./geocoding-plan-section";
import DataSharingSection from "./data-sharing-section";
import PlatformOwnersCard from "./platform-owners-card";
import PlatformSectionList, {
  type PlatformSectionEntry,
} from "./platform-section-list";
import { useIsPlatformOwner } from "./use-platform-membership";
import type { PlatformSection } from "./platform.types";

interface PlatformPageContentProps {
  /** `pages.userSettings` subtree. */
  readonly dict: I18nRecord;
  readonly lang: string;
}

/**
 * Settings › Platform.
 *
 * Settings that belong to no organization: they span every tenant, so they sit
 * apart from the org-scoped pages rather than under a chosen organization.
 *
 * One page with a left-hand menu rather than a page per section, matching
 * Settings › Organizations. There are few enough platform settings that
 * spreading them across the sidebar would say more about the navigation than
 * about the product.
 *
 * The page is reachable by URL even though the navigation hides it from
 * non-owners, so it re-checks membership itself. The modulith refuses the
 * writes either way; this only decides whether to offer a surface that could
 * not work.
 */
export default function PlatformPageContent({
  dict,
  lang,
}: PlatformPageContentProps) {
  const platformDict = (dict?.platform as I18nRecord) ?? {};
  const brandingDict = (platformDict?.branding as I18nRecord) ?? {};
  const superusersDict = (platformDict?.superusers as I18nRecord) ?? {};
  const modelsDict = (platformDict?.models as I18nRecord) ?? {};
  const vehicleImagesDict = (platformDict?.vehicleImages as I18nRecord) ?? {};
  const geocodingDict = (platformDict?.geocoding as I18nRecord) ?? {};
  const geocodingPlanDict = (platformDict?.geocodingPlan as I18nRecord) ?? {};
  const sharingDict = (platformDict?.sharing as I18nRecord) ?? {};
  const templatesDict = (dict?.mailTemplates as I18nRecord) ?? {};
  const planDict = (platformDict?.plan as I18nRecord) ?? {};
  const usageDict = (platformDict?.usage as I18nRecord) ?? {};
  const breadcrumbDict = dict?.breadcrumb as I18nRecord;

  const { isPlatformOwner, isLoading } = useIsPlatformOwner();
  const [selected, setSelected] = useState<PlatformSection>("branding");

  const group = {
    brand: tr("groups.brand", platformDict),
    access: tr("groups.access", platformDict),
    ai: tr("groups.ai", platformDict),
    geocoding: tr("groups.geocoding", platformDict),
  };

  const sections: readonly PlatformSectionEntry[] = [
    {
      id: "branding",
      label: tr("title", brandingDict),
      description: tr("menuHint", brandingDict),
      icon: HiOutlinePhotograph,
      group: group.brand,
    },
    {
      id: "vehicleImages",
      label: tr("title", vehicleImagesDict),
      description: tr("menuHint", vehicleImagesDict),
      icon: HiOutlineTruck,
      group: group.brand,
    },
    {
      id: "templates",
      label: tr("title", templatesDict),
      description: tr("menuHint", templatesDict),
      icon: HiOutlineTemplate,
      group: group.brand,
    },
    {
      id: "superusers",
      label: tr("title", superusersDict),
      description: tr("menuHint", superusersDict),
      icon: HiOutlineKey,
      group: group.access,
    },
    {
      id: "sharing",
      label: tr("title", sharingDict),
      description: tr("menuHint", sharingDict),
      icon: HiOutlineShare,
      group: group.access,
    },
    {
      id: "models",
      label: tr("title", modelsDict),
      description: tr("menuHint", modelsDict),
      icon: HiOutlineChip,
      group: group.ai,
    },
    {
      id: "plan",
      label: tr("title", planDict),
      description: tr("menuHint", planDict),
      icon: HiOutlineCreditCard,
      group: group.ai,
    },
    {
      id: "usage",
      label: tr("title", usageDict),
      description: tr("menuHint", usageDict),
      icon: HiOutlineChartBar,
      group: group.ai,
    },
    {
      id: "geocoding",
      label: tr("menuTitle", geocodingDict),
      description: tr("menuHint", geocodingDict),
      icon: HiOutlineGlobeAlt,
      group: group.geocoding,
    },
    {
      id: "geocodingPlan",
      label: tr("menuTitle", geocodingPlanDict),
      description: tr("menuHint", geocodingPlanDict),
      icon: HiOutlineMap,
      group: group.geocoding,
    },
  ];

  const panels: Record<PlatformSection, ReactNode> = {
    branding: <BrandingSection dict={brandingDict} lang={lang} />,
    superusers: <PlatformOwnersCard dict={superusersDict} />,
    models: <ModelProvidersSection dict={modelsDict} />,
    vehicleImages: <PlatformVehicleImagesSection dict={vehicleImagesDict} />,
    geocoding: <PlatformGeocodingSection dict={geocodingDict} />,
    geocodingPlan: <GeocodingPlanSection dict={geocodingPlanDict} />,
    sharing: <DataSharingSection dict={sharingDict} lang={lang} />,
    templates: (
      <MailTemplateEditor scope="platform" dict={templatesDict} lang={lang} />
    ),
    plan: <HarnessPlanSection dict={planDict} />,
    usage: <ModelUsageCard dict={usageDict} lang={lang} />,
  };

  return (
    <SettingsPageShell
      breadcrumbDict={breadcrumbDict}
      lang={lang}
      path={["user", "settings", "platform"]}
      icon={HiServer}
      title={tr("title", platformDict)}
      description={tr("description", platformDict)}
    >
      {isLoading && <Spinner size="md" />}

      {!isLoading && !isPlatformOwner && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <p className="font-medium">{tr("notOwnerTitle", platformDict)}</p>
          <p className="mt-1">{tr("notOwnerBody", platformDict)}</p>
        </div>
      )}

      {!isLoading && isPlatformOwner && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
          <PlatformSectionList
            sections={sections}
            selected={selected}
            onSelect={setSelected}
            dict={platformDict}
          />
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
            {panels[selected]}
          </div>
        </div>
      )}
    </SettingsPageShell>
  );
}
