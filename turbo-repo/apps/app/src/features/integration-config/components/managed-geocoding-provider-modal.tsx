"use client";

import { useEffect, useState } from "react";
import { HiOutlineLink } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import PlatformGeocodingFields from "@/features/settings-admin/platform/platform-geocoding-fields";
import {
  geocodingDraftFrom,
  toGeocodingRequest,
  type GeocodingDraft,
} from "@/features/settings-admin/platform/platform-geocoding-form";
import { usePlatformGeocoding } from "@/features/settings-admin/platform/use-platform-geocoding";
import { GEOCODING_LOGO } from "../connection-catalog";
import { IntegrationFormModal } from "./integration-form-modal";

interface ManagedGeocodingProviderModalProps {
  readonly isOpen: boolean;
  /**
   * `platform`: the Plataforma scope edits the platform's provider.
   * `organization`: an organization needs the provider before it is connected.
   */
  readonly mode: "platform" | "organization";
  /** `pages.integrationConnections` subtree. */
  readonly dict: I18nRecord;
  /** `pages.userSettings.platform.geocoding` subtree. */
  readonly providerDict: I18nRecord;
  readonly onClose: () => void;
  /** Runs after the provider is saved. */
  readonly onSaved: () => Promise<void>;
}

const EMPTY_DRAFT: GeocodingDraft = {
  provider: "mapbox",
  credentialId: "",
  permanent: true,
  cost: "",
};

/** The platform's geocoding provider, set from Conexiones in the connection modal's shell. */
export function ManagedGeocodingProviderModal({
  isOpen,
  mode,
  dict,
  providerDict,
  onClose,
  onSaved,
}: Readonly<ManagedGeocodingProviderModalProps>) {
  const { provider, save } = usePlatformGeocoding();
  const [draft, setDraft] = useState<GeocodingDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const configured = provider?.configured ?? false;
  const set = (patch: Partial<GeocodingDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setDraft(
        provider?.configured ? geocodingDraftFrom(provider) : EMPTY_DRAFT
      );
    }
  }, [isOpen, provider]);

  const submit = async () => {
    const result = toGeocodingRequest(draft, configured);
    if (!result.ok) {
      setError(new Error(trDynamic(result.error, providerDict)));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await save(result.value);
      await onSaved();
    } catch {
      setError(new Error(tr("saveError", providerDict)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IntegrationFormModal
      show={isOpen}
      isEdit={configured}
      title={tr("managedGeocodingSetup.title", dict)}
      subtitle={
        mode === "platform"
          ? tr("managedGeocodingSetup.platformBody", dict)
          : tr("managedGeocodingSetup.body", dict)
      }
      glyph={<HiOutlineLink className="h-5 w-5" />}
      logo={GEOCODING_LOGO}
      onClose={onClose}
      onSubmit={() => void submit()}
      error={error}
      saving={busy}
      dict={dict}
    >
      <PlatformGeocodingFields
        dict={providerDict}
        draft={draft}
        busy={busy}
        onChange={set}
      />
    </IntegrationFormModal>
  );
}
