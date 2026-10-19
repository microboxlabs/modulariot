"use client";

import { useEffect, useState } from "react";
import { Label, Spinner, TextInput } from "flowbite-react";
import { HiOutlineMail } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { isSender } from "../email/email.types";
import {
  PlatformSettingBadge,
  PlatformSettingButtons,
  PlatformSettingRemoveModal,
  usePlatformSettingActions,
} from "./platform-setting-controls";
import { usePlatformMail } from "./use-platform-mail";

interface PlatformMailSectionProps {
  readonly dict: I18nRecord;
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
  const {
    busy,
    confirmRemove,
    setConfirmRemove,
    submit,
    check,
    confirmRemoval,
  } = usePlatformSettingActions(dict, { save, test, remove });

  // Reset only when what is stored changes, so a test does not wipe unsaved edits.
  const storedFrom = mail?.from ?? "";
  const storedKey = mail?.keyPreview ?? null;
  useEffect(() => {
    setFrom(storedFrom);
    setApiKey("");
  }, [storedFrom, storedKey]);

  const configured = mail?.configured ?? false;
  const fromValid = isSender(from);
  const canSave = fromValid && (configured || apiKey.trim() !== "");

  const onSave = () => submit({ from: from.trim(), apiKey: apiKey.trim() });

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HiOutlineMail className="h-5 w-5 text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {tr("title", dict)}
          </h2>
        </div>
        {mail && <PlatformSettingBadge setting={mail} dict={dict} />}
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
