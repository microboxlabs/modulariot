"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "flowbite-react";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import PlatformGeocodingFields from "@/features/settings-admin/platform/platform-geocoding-fields";
import {
  geocodingDraftFrom,
  toGeocodingRequest,
  type GeocodingDraft,
} from "@/features/settings-admin/platform/platform-geocoding-form";
import { usePlatformGeocoding } from "@/features/settings-admin/platform/use-platform-geocoding";

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

/** The platform's geocoding provider, set from Conexiones. */
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
  const configured = provider?.configured ?? false;
  const set = (patch: Partial<GeocodingDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (isOpen) {
      setDraft(
        provider?.configured ? geocodingDraftFrom(provider) : EMPTY_DRAFT
      );
    }
  }, [isOpen, provider]);

  const submit = async () => {
    const result = toGeocodingRequest(draft, configured);
    if (!result.ok) {
      toast.error(trDynamic(result.error, providerDict));
      return;
    }
    setBusy(true);
    try {
      await save(result.value);
      await onSaved();
    } catch {
      toast.error(tr("saveError", providerDict));
    } finally {
      setBusy(false);
    }
  };

  const platform = mode === "platform";
  return (
    <Modal show={isOpen} size="lg" onClose={onClose} dismissible={!busy}>
      <ModalHeader>{tr("managedGeocodingSetup.title", dict)}</ModalHeader>
      <ModalBody>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {platform
            ? tr("managedGeocodingSetup.platformBody", dict)
            : tr("managedGeocodingSetup.body", dict)}
        </p>
        <PlatformGeocodingFields
          dict={providerDict}
          draft={draft}
          busy={busy}
          onChange={set}
        />
      </ModalBody>
      <ModalFooter>
        <Button
          color="blue"
          disabled={busy || draft.credentialId === ""}
          onClick={submit}
        >
          {platform
            ? tr("common.save", dict)
            : tr("managedGeocodingSetup.submit", dict)}
        </Button>
        <Button color="gray" disabled={busy} onClick={onClose}>
          {tr("common.cancel", dict)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
