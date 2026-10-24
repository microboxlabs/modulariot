"use client";

import { useState } from "react";
import {
  Button,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  TextInput,
} from "flowbite-react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { BumpBadge } from "@/features/symptoms/maintainer/ui/badges";
import { MUTED } from "@/features/symptoms/maintainer/ui/card";
import {
  CHANGED_BAR,
  CHANGED_DOT,
} from "@/features/symptoms/maintainer/ui/changed";
import type { RuleBump } from "./conversations-types";
import { nextRuleVersion, RULE_BUMPS, type RuleChange } from "./rule-model";

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
  current,
  bump,
  d,
  onReview,
}: Readonly<{
  changes: RuleChange[];
  errors: number;
  saving: boolean;
  saveError: string | null;
  /** The version in force; null before the first publish. */
  current: string | null;
  /** What the draft calls for; null when it does what the version in force does. */
  bump: RuleBump | null;
  d: I18nRecord;
  onReview: () => void;
}>) {
  const blocked =
    errors > 0 || saving || saveError !== null || changes.length === 0 || !bump;
  return (
    <section
      aria-label={tr("draftBarLabel", d)}
      className={`sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t bg-white/95 px-6 py-3 text-sm shadow-lg dark:bg-gray-800/95 ${CHANGED_BAR}`}
    >
      <span className={`h-2 w-2 rounded-full ${CHANGED_DOT}`} />
      <span className="text-gray-900 dark:text-white">
        {changesLabel(changes.length, d)}
      </span>
      {bump && (
        <>
          <span className={`text-xs ${MUTED}`}>{tr("nextVersion", d)}</span>
          <span className="font-mono text-gray-900 dark:text-white">
            {nextRuleVersion(current, bump)}
          </span>
          <BumpBadge bump={bump} d={d} />
        </>
      )}
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

const BUMP_WHY: Record<RuleBump, string> = {
  MAJOR: "bumpWhyMajor",
  MINOR: "bumpWhyMinor",
  PATCH: "bumpWhyPatch",
};

const BUMP_LABEL: Record<RuleBump, string> = {
  MAJOR: "bumpMajor",
  MINOR: "bumpMinor",
  PATCH: "bumpPatch",
};

/** "0.1.0 → 0.2.0 MENOR why", like the symptom publish dialog. */
function VersionLine({
  current,
  bump,
  d,
}: Readonly<{ current: string | null; bump: RuleBump; d: I18nRecord }>) {
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2 text-sm font-normal">
      <span className="font-mono text-gray-500 dark:text-gray-400">
        {current ?? tr("unpublished", d)}
      </span>
      <span aria-hidden>→</span>
      <span className="font-mono font-semibold">
        {nextRuleVersion(current, bump)}
      </span>
      <BumpBadge bump={bump} d={d} />
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {trDynamic(BUMP_WHY[bump], d)}
      </span>
    </span>
  );
}

/** The changes of the draft, the version they make, and the reason to publish them. */
export function PublishRuleDialog({
  open,
  changes,
  current,
  bump,
  canPublish,
  d,
  onClose,
  onPublish,
}: Readonly<{
  open: boolean;
  changes: RuleChange[];
  current: string | null;
  /** The computed bump; null when nothing changed. */
  bump: RuleBump | null;
  canPublish: boolean;
  d: I18nRecord;
  onClose: () => void;
  onPublish: (reason: string, raise: RuleBump | null) => Promise<void>;
}>) {
  const [reason, setReason] = useState("");
  const [raise, setRaise] = useState<RuleBump | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The first publish is always 0.1.0, so only later ones can be raised.
  const higher =
    bump && current ? RULE_BUMPS.slice(RULE_BUMPS.indexOf(bump) + 1) : [];
  const shown = (raise && higher.includes(raise) ? raise : null) ?? bump;
  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      await onPublish(reason.trim(), shown === bump ? null : shown);
      setReason("");
      setRaise(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal show={open} size="md" onClose={busy ? () => undefined : onClose}>
      <ModalHeader>
        <span className="block">{tr("publishTitle", d)}</span>
        {shown && <VersionLine current={current} bump={shown} d={d} />}
      </ModalHeader>
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
          {higher.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <span>{tr("raiseTo", d)}</span>
              <Select
                sizing="sm"
                value={raise ?? ""}
                onChange={(e) =>
                  setRaise((e.target.value || null) as RuleBump | null)
                }
              >
                <option value="">{tr("raiseAuto", d)}</option>
                {higher.map((b) => (
                  <option key={b} value={b}>
                    {trDynamic(BUMP_LABEL[b], d)}
                  </option>
                ))}
              </Select>
            </label>
          )}
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
