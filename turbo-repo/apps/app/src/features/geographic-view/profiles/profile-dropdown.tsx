"use client";

import { Dropdown, DropdownItem } from "flowbite-react";
import { HiChevronDown } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  GEOGRAPHIC_PROFILES,
  type GeographicProfileId,
} from "./geographic-profiles";
import { useGeographicProfile } from "./geographic-profile-context";

function profileLabel(id: GeographicProfileId, dict: I18nRecord): string {
  if (id === "admin") return tr("geographic_view.profiles.admin", dict);
  return tr("geographic_view.profiles.other", dict);
}

export default function ProfileDropdown({
  dict,
}: Readonly<{ dict: I18nRecord }>) {
  const { profileId, setProfileId } = useGeographicProfile();

  return (
    <div className="ml-3 flex items-center gap-2 border-l border-gray-200 pl-3 dark:border-gray-700">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {tr("geographic_view.profiles.label", dict)}
      </span>
      <Dropdown
        label=""
        inline
        dismissOnClick
        renderTrigger={() => (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            {profileLabel(profileId, dict)}
            <HiChevronDown className="h-4 w-4 text-gray-400" />
          </button>
        )}
      >
        {(Object.keys(GEOGRAPHIC_PROFILES) as GeographicProfileId[]).map(
          (id) => {
            const enabled = GEOGRAPHIC_PROFILES[id].enabled;
            return (
              <DropdownItem
                key={id}
                disabled={!enabled}
                onClick={() => setProfileId(id)}
              >
                {profileLabel(id, dict)}
                {!enabled
                  ? ` — ${tr("geographic_view.profiles.comingSoon", dict)}`
                  : ""}
              </DropdownItem>
            );
          }
        )}
      </Dropdown>
    </div>
  );
}
