"use client";

import { useEffect, useState } from "react";
import { Button, Select, TextInput } from "flowbite-react";
import { SettingsFormField } from "@/features/settings-admin/components/settings-form-field";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import {
  GPS_PROVIDER_OPTIONS,
  gpsProviderNameById,
} from "./gps-provider-options";

export default function GpsProviderRequestForm({
  onSubmit,
  onCancel,
}: Readonly<{
  onSubmit: (data: {
    providerId: string;
    providerName: string;
    organizationName: string;
  }) => void;
  onCancel: () => void;
}>) {
  const { activeOrg } = useOrgScopes();
  const [providerId, setProviderId] = useState(GPS_PROVIDER_OPTIONS[0].id);
  const [organizationName, setOrganizationName] = useState("");
  const [hasEditedOrgName, setHasEditedOrgName] = useState(false);

  useEffect(() => {
    if (!hasEditedOrgName && activeOrg?.displayName) {
      setOrganizationName(activeOrg.displayName);
    }
  }, [activeOrg?.displayName, hasEditedOrgName]);

  const handleSubmit = () => {
    if (!organizationName.trim()) return;
    onSubmit({
      providerId,
      providerName: gpsProviderNameById(providerId),
      organizationName: organizationName.trim(),
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <div className="flex flex-col gap-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <SettingsFormField id="gps-provider-select" label="GPS provider">
            <Select
              id="gps-provider-select"
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
            >
              {GPS_PROVIDER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </SettingsFormField>

          <SettingsFormField
            id="gps-provider-org-name"
            label="Organization name"
          >
            <TextInput
              id="gps-provider-org-name"
              value={organizationName}
              onChange={(event) => {
                setHasEditedOrgName(true);
                setOrganizationName(event.target.value);
              }}
            />
          </SettingsFormField>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button size="xs" color="alternative" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="xs"
            color="blue"
            onClick={handleSubmit}
            disabled={!organizationName.trim()}
          >
            Ask permission
          </Button>
        </div>
      </div>
    </div>
  );
}
