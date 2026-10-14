"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Label, Spinner, TextInput } from "flowbite-react";
import { HiOutlinePhotograph } from "react-icons/hi";
import { toast } from "sonner";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ApiError } from "../data/json-client";
import {
  usePlatformVehicleImages,
  type PlatformVehicleImages,
} from "./use-platform-vehicle-images";

interface PlatformVehicleImagesSectionProps {
  readonly dict: I18nRecord;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
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
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

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

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      try {
        await save({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() });
        toast.success(tr("saved", dict));
      } catch (err) {
        toast.error(errorMessage(err, tr("saveError", dict)));
      }
    });

  const check = () =>
    run(async () => {
      try {
        const result = await test();
        if (result.success) toast.success(tr("testOk", dict));
        else toast.error(result.message ?? tr("testFailed", dict));
      } catch (err) {
        toast.error(errorMessage(err, tr("testFailed", dict)));
      }
    });

  const removeProvider = () =>
    run(async () => {
      try {
        await remove();
        setConfirmRemove(false);
        toast.success(tr("removed", dict));
      } catch (err) {
        toast.error(errorMessage(err, tr("removeError", dict)));
      }
    });

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HiOutlinePhotograph className="h-5 w-5 text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {tr("title", dict)}
          </h2>
        </div>
        {provider && <StatusBadge provider={provider} dict={dict} />}
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
          <div className="flex flex-wrap gap-2">
            <Button
              color="blue"
              size="sm"
              disabled={busy || !canSave}
              onClick={submit}
            >
              {tr("save", dict)}
            </Button>
            {configured && (
              <>
                <Button
                  color="alternative"
                  size="sm"
                  disabled={busy}
                  onClick={check}
                >
                  {tr("test", dict)}
                </Button>
                <Button
                  color="alternative"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirmRemove(true)}
                >
                  {tr("remove", dict)}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={removeProvider}
        isProcessing={busy}
        variant="danger"
        title={tr("removeTitle", dict)}
        description={tr("removeBody", dict)}
        confirmLabel={tr("remove", dict)}
      />
    </section>
  );
}

interface StatusBadgeProps {
  readonly provider: PlatformVehicleImages;
  readonly dict: I18nRecord;
}

function StatusBadge({ provider, dict }: Readonly<StatusBadgeProps>) {
  if (!provider.configured) {
    return <Badge color="gray">{tr("statusNone", dict)}</Badge>;
  }
  if (provider.lastTestResult === false) {
    return <Badge color="failure">{tr("statusFailed", dict)}</Badge>;
  }
  if (provider.lastTestResult === true) {
    return <Badge color="success">{tr("statusOk", dict)}</Badge>;
  }
  return <Badge color="warning">{tr("statusUntested", dict)}</Badge>;
}
