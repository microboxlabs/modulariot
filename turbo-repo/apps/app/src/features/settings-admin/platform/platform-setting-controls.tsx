"use client";

import { useState } from "react";
import { Badge, Button } from "flowbite-react";
import { toast } from "sonner";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ApiError } from "../data/json-client";

/** What the platform API answers for a stored setting. */
interface PlatformSettingStatus {
  configured: boolean;
  lastTestResult: boolean | null;
}

interface PlatformSettingApi<B> {
  save: (body: B) => Promise<void>;
  /** Absent for a setting the modulith cannot check. */
  test?: () => Promise<{ success: boolean; message: string | null }>;
  remove: () => Promise<void>;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Save, test and remove for a platform setting section: one action at a time,
 * each reported in a toast.
 */
export function usePlatformSettingActions<B>(
  dict: I18nRecord,
  { save, test, remove }: PlatformSettingApi<B>
) {
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const submit = (body: B, onSaved?: () => void) =>
    run(async () => {
      try {
        await save(body);
        onSaved?.();
        toast.success(tr("saved", dict));
      } catch (err) {
        toast.error(errorMessage(err, tr("saveError", dict)));
      }
    });

  const check = () =>
    run(async () => {
      if (!test) return;
      try {
        const result = await test();
        if (result.success) toast.success(tr("testOk", dict));
        else toast.error(result.message ?? tr("testFailed", dict));
      } catch (err) {
        toast.error(errorMessage(err, tr("testFailed", dict)));
      }
    });

  const confirmRemoval = () =>
    run(async () => {
      try {
        await remove();
        setConfirmRemove(false);
        toast.success(tr("removed", dict));
      } catch (err) {
        toast.error(errorMessage(err, tr("removeError", dict)));
      }
    });

  return {
    busy,
    confirmRemove,
    setConfirmRemove,
    submit,
    check,
    confirmRemoval,
  };
}

interface PlatformSettingBadgeProps {
  readonly setting: PlatformSettingStatus;
  readonly dict: I18nRecord;
}

export function PlatformSettingBadge({
  setting,
  dict,
}: Readonly<PlatformSettingBadgeProps>) {
  if (!setting.configured) {
    return <Badge color="gray">{tr("statusNone", dict)}</Badge>;
  }
  if (setting.lastTestResult === false) {
    return <Badge color="failure">{tr("statusFailed", dict)}</Badge>;
  }
  if (setting.lastTestResult === true) {
    return <Badge color="success">{tr("statusOk", dict)}</Badge>;
  }
  return <Badge color="warning">{tr("statusUntested", dict)}</Badge>;
}

interface PlatformSettingButtonsProps {
  readonly dict: I18nRecord;
  readonly busy: boolean;
  readonly canSave: boolean;
  readonly configured: boolean;
  readonly onSave: () => void;
  /** No Test button without it. */
  readonly onTest?: () => void;
  readonly onRemove: () => void;
}

/** Save, and test and remove once something is stored. */
export function PlatformSettingButtons({
  dict,
  busy,
  canSave,
  configured,
  onSave,
  onTest,
  onRemove,
}: Readonly<PlatformSettingButtonsProps>) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        color="blue"
        size="sm"
        disabled={busy || !canSave}
        onClick={onSave}
      >
        {tr("save", dict)}
      </Button>
      {configured && (
        <>
          {onTest && (
            <Button
              color="alternative"
              size="sm"
              disabled={busy}
              onClick={onTest}
            >
              {tr("test", dict)}
            </Button>
          )}
          <Button
            color="alternative"
            size="sm"
            disabled={busy}
            onClick={onRemove}
          >
            {tr("remove", dict)}
          </Button>
        </>
      )}
    </div>
  );
}

interface PlatformSettingRemoveModalProps {
  readonly dict: I18nRecord;
  readonly isOpen: boolean;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

export function PlatformSettingRemoveModal({
  dict,
  isOpen,
  busy,
  onClose,
  onConfirm,
}: Readonly<PlatformSettingRemoveModalProps>) {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isProcessing={busy}
      variant="danger"
      title={tr("removeTitle", dict)}
      description={tr("removeBody", dict)}
      confirmLabel={tr("remove", dict)}
    />
  );
}
