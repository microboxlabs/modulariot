"use client";

import { useState } from "react";
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  TextInput,
} from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import {
  CHANGED_BAR,
  CHANGED_DOT,
} from "@/features/symptoms/maintainer/ui/changed";
import type { RuleChange } from "./rule-model";

function changesLabel(n: number, d: I18nRecord) {
  if (n === 0) return tr("draftNoChanges", d);
  if (n === 1) return tr("draftOneChange", d);
  return tr("draftChanges", d, { n: String(n) });
}

/** The bar at the bottom of the rule while it has a draft, like the symptom editor's. */
export default function RuleDraftBar({
  changes,
  errors,
  saving,
  saveError,
  nextVersion,
  d,
  onReview,
}: Readonly<{
  changes: RuleChange[];
  errors: number;
  saving: boolean;
  saveError: string | null;
  nextVersion: number;
  d: I18nRecord;
  onReview: () => void;
}>) {
  const blocked =
    errors > 0 || saving || saveError !== null || changes.length === 0;
  return (
    <section
      aria-label={tr("draftBarLabel", d)}
      className={`sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t bg-white/95 px-6 py-3 text-sm shadow-lg dark:bg-gray-800/95 ${CHANGED_BAR}`}
    >
      <span className={`h-2 w-2 rounded-full ${CHANGED_DOT}`} />
      <span className="text-gray-900 dark:text-white">
        {changesLabel(changes.length, d)}
      </span>
      <span className={`text-xs ${MUTED}`}>{tr("nextVersion", d)}</span>
      <span className="font-mono text-gray-900 dark:text-white">
        v{nextVersion}
      </span>
      {errors > 0 && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {errors === 1
            ? tr("oneError", d)
            : tr("errorsCount", d, { n: String(errors) })}
        </span>
      )}
      <span className={`text-xs ${MUTED}`}>
        {saving ? tr("saving", d) : tr("saved", d)}
      </span>
      {saveError && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {saveError}
        </span>
      )}
      <button
        type="button"
        className="text-blue-600 hover:underline dark:text-blue-400"
        onClick={onReview}
      >
        {tr("seeChanges", d)}
      </button>
      <Button
        size="sm"
        className="ml-auto"
        disabled={blocked}
        onClick={onReview}
      >
        {tr("publish", d)}
      </Button>
    </section>
  );
}

/** The changes of the draft and the reason to publish them. */
export function PublishRuleDialog({
  open,
  changes,
  canPublish,
  d,
  onClose,
  onPublish,
}: Readonly<{
  open: boolean;
  changes: RuleChange[];
  canPublish: boolean;
  d: I18nRecord;
  onClose: () => void;
  onPublish: (reason: string) => Promise<void>;
}>) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      await onPublish(reason.trim());
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal show={open} size="md" onClose={busy ? () => undefined : onClose}>
      <ModalHeader>{tr("publishTitle", d)}</ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-3">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
            {changes.map((c) => (
              <li key={c.key}>{c.text}</li>
            ))}
            {changes.length === 0 && (
              <li className="list-none">{tr("draftNoChanges", d)}</li>
            )}
          </ul>
          <div>
            <Label htmlFor="rule-publish-reason">{tr("reason", d)}</Label>
            <TextInput
              id="rule-publish-reason"
              value={reason}
              placeholder={tr("reasonPlaceholder", d)}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </ModalBody>
      <ModalFooter className="justify-end">
        <Button color="alternative" disabled={busy} onClick={onClose}>
          {tr("cancel", d)}
        </Button>
        <Button
          disabled={busy || !canPublish || !reason.trim()}
          onClick={() => void publish()}
        >
          {tr("publish", d)}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
