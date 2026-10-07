"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Label, Spinner, TextInput } from "flowbite-react";
import { HiOutlineMail } from "react-icons/hi";
import { toast } from "sonner";
import ConfirmationModal from "@/features/common/components/confirmation-modal/confirmation-modal";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { ApiError } from "../data/json-client";
import { isSender } from "../email/email.types";
import { usePlatformMail, type PlatformMail } from "./use-platform-mail";

interface PlatformMailSectionProps {
  readonly dict: I18nRecord;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * The platform's email sender: a Resend API key and sender address used for
 * invitations from every organization that has no sender of its own.
 */
export default function PlatformMailSection({
  dict,
}: PlatformMailSectionProps) {
  const { mail, isLoading, error, save, remove, test } = usePlatformMail();
  const [from, setFrom] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setFrom(mail?.from ?? "");
    setApiKey("");
  }, [mail]);

  const configured = mail?.configured ?? false;
  const fromValid = isSender(from);
  const canSave = fromValid && (configured || apiKey.trim() !== "");

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
        await save({ from: from.trim(), apiKey: apiKey.trim() });
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

  const removeSender = () =>
    run(async () => {
      try {
        await remove();
        setConfirmRemove(false);
        toast.success(tr("removed", dict));
      } catch (err) {
        toast.error(errorMessage(err, tr("saveError", dict)));
      }
    });

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HiOutlineMail className="h-5 w-5 text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {tr("title", dict)}
          </h2>
        </div>
        {mail && <StatusBadge mail={mail} dict={dict} />}
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

      {mail && (
        <div className="mt-4 flex max-w-xl flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="platform-mail-from">{tr("from", dict)}</Label>
            <TextInput
              id="platform-mail-from"
              sizing="sm"
              placeholder={tr("fromPlaceholder", dict)}
              color={from && !fromValid ? "failure" : undefined}
              value={from}
              disabled={busy}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {tr("fromHint", dict)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="platform-mail-key">{tr("apiKey", dict)}</Label>
            <TextInput
              id="platform-mail-key"
              type="password"
              sizing="sm"
              autoComplete="off"
              placeholder={
                mail.keyPreview
                  ? tr("apiKeyKeep", dict, { preview: mail.keyPreview })
                  : "re_…"
              }
              value={apiKey}
              disabled={busy}
              onChange={(e) => setApiKey(e.target.value)}
            />
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
        onConfirm={removeSender}
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
  readonly mail: PlatformMail;
  readonly dict: I18nRecord;
}

function StatusBadge({ mail, dict }: StatusBadgeProps) {
  if (!mail.configured) {
    return <Badge color="gray">{tr("statusNone", dict)}</Badge>;
  }
  if (mail.lastTestResult === false) {
    return <Badge color="failure">{tr("statusFailed", dict)}</Badge>;
  }
  if (mail.lastTestResult === true) {
    return <Badge color="success">{tr("statusOk", dict)}</Badge>;
  }
  return <Badge color="warning">{tr("statusUntested", dict)}</Badge>;
}
