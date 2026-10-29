"use client";

import { useState } from "react";
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
  toGeocodingRequest,
  type GeocodingDraft,
} from "@/features/settings-admin/platform/platform-geocoding-form";
import { usePlatformGeocoding } from "@/features/settings-admin/platform/use-platform-geocoding";

interface ManagedGeocodingProviderModalProps {
  readonly isOpen: boolean;
  /** `pages.integrationConnections` subtree. */
  readonly dict: I18nRecord;
  /** `pages.userSettings.platform.geocoding` subtree. */
  readonly providerDict: I18nRecord;
  readonly onClose: () => void;
  /** Runs after the provider is saved; connects the organization. */
  readonly onSaved: () => Promise<void>;
}

const EMPTY_DRAFT: GeocodingDraft = {
  provider: "mapbox",
  credentialId: "",
  permanent: true,
  cost: "",
};

/**
 * Shown when a platform owner connects an organization before the platform
 * has a geocoding provider: sets the provider, then connects the organization.
 */
export function ManagedGeocodingProviderModal({
  isOpen,
  dict,
  providerDict,
  onClose,
  onSaved,
}: Readonly<ManagedGeocodingProviderModalProps>) {
  const { save } = usePlatformGeocoding();
  const [draft, setDraft] = useState<GeocodingDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<GeocodingDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const close = () => {
    setDraft(EMPTY_DRAFT);
    onClose();
  };

  const submit = async () => {
    const result = toGeocodingRequest(draft, false);
    if (!result.ok) {
      toast.error(trDynamic(result.error, providerDict));
      return;
    }
    setBusy(true);
    try {
      await save(result.value);
      setDraft(EMPTY_DRAFT);
      await onSaved();
    } catch {
      toast.error(tr("saveError", providerDict));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={isOpen} size="lg" onClose={close} dismissible={!busy}>
      <ModalHeader>{tr("managedGeocodingSetup.title", dict)}</ModalHeader>
      <ModalBody>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {tr("managedGeocodingSetup.body", dict)}
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
          {tr("managedGeocodingSetup.submit", dict)}
        </Button>
        <Button color="gray" disabled={busy} onClick={close}>
          {tr("common.cancel", dict)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
