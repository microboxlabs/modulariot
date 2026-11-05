"use client";

import { useEffect, useState } from "react";
import { Label, Spinner, TextInput } from "flowbite-react";
import { HiOutlinePhotograph } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  PlatformSettingBadge,
  PlatformSettingButtons,
  PlatformSettingRemoveModal,
  usePlatformSettingActions,
} from "./platform-setting-controls";
import { usePlatformVehicleImages } from "./use-platform-vehicle-images";

interface PlatformVehicleImagesSectionProps {
  readonly dict: I18nRecord;
}

/**
 * The platform's vehicle image provider: a carimagesapi.com key and secret
 * used by every organization that has no provider of its own.
 */
export default function PlatformVehicleImagesSection({
  dict,
}: Readonly<PlatformVehicleImagesSectionProps>) {
  const { provider, isLoading, error, save, remove, test } =
    usePlatformVehicleImages();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const {
    busy,
    confirmRemove,
    setConfirmRemove,
    submit,
    check,
    confirmRemoval,
  } = usePlatformSettingActions(dict, { save, test, remove });

  // Reset only when what is stored changes, so a test does not wipe unsaved edits.
  const storedKey = provider?.apiKey ?? "";
  const storedSecret = provider?.secretPreview ?? null;
  useEffect(() => {
    setApiKey(storedKey);
    setApiSecret("");
  }, [storedKey, storedSecret]);

  const configured = provider?.configured ?? false;
  const canSave =
    apiKey.trim() !== "" && (configured || apiSecret.trim() !== "");

  const onSave = () =>
    submit({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }, () =>
      setApiSecret("")
    );

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HiOutlinePhotograph className="h-5 w-5 text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {tr("title", dict)}
          </h2>
        </div>
        {provider && <PlatformSettingBadge setting={provider} dict={dict} />}
      </div>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {tr("description", dict)}
      </p>

      {isLoading && <Spinner size="sm" className="mt-3" />}
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {tr("loadError", dict)}
        </p>
      )}

      {provider && (
        <div className="mt-4 flex max-w-xl flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="platform-vehicle-images-key">
              {tr("apiKey", dict)}
            </Label>
            <TextInput
              id="platform-vehicle-images-key"
              sizing="sm"
              autoComplete="off"
              placeholder="ci_…"
              value={apiKey}
              disabled={busy}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="platform-vehicle-images-secret">
              {tr("apiSecret", dict)}
            </Label>
            <TextInput
              id="platform-vehicle-images-secret"
              type="password"
              sizing="sm"
              autoComplete="off"
              placeholder={
                provider.secretPreview
                  ? tr("apiSecretKeep", dict, {
                      preview: provider.secretPreview,
                    })
                  : ""
              }
              value={apiSecret}
              disabled={busy}
              onChange={(e) => setApiSecret(e.target.value)}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {tr("apiSecretHint", dict)}
            </span>
          </div>
          <PlatformSettingButtons
            dict={dict}
            busy={busy}
            canSave={canSave}
            configured={configured}
            onSave={onSave}
            onTest={check}
            onRemove={() => setConfirmRemove(true)}
          />
        </div>
      )}

      <PlatformSettingRemoveModal
        dict={dict}
        isOpen={confirmRemove}
        busy={busy}
        onClose={() => setConfirmRemove(false)}
        onConfirm={confirmRemoval}
      />
    </section>
  );
}
