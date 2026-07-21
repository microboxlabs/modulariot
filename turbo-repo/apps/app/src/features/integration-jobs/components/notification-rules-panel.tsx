"use client";

import { useMemo, useState } from "react";
import { HiOutlinePlus, HiOutlineTrash, HiOutlineX } from "react-icons/hi";
import { ToggleSwitch } from "flowbite-react";
import { tr } from "@/features/i18n/tr.service";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import {
  E164_PATTERN,
  jobTypeLabel,
  type NotificationRule,
} from "../integration-job.types";
import { useNotificationRules, useSaveNotificationRule } from "../use-integration-jobs";

interface NotificationRulesPanelProps {
  readonly orgSlug: string;
  /** Job types seen in the ledger — the add-rule choices. */
  readonly jobTypes: string[];
  readonly dict: I18nRecord;
  readonly onClose: () => void;
}

/** The notification job type must never notify about itself (backend rejects it too). */
const SELF_TYPE = "job_failure_notification";
const DEFAULT_THROTTLE_SECONDS = 300;

/**
 * Right-hand console panel configuring "when jobs of this type park as FAILED,
 * WhatsApp these numbers": one card per rule with an enabled toggle, E.164
 * recipient chips and a throttle. Mirrors the JobDetailPanel aside idiom.
 */
export default function NotificationRulesPanel({
  orgSlug,
  jobTypes,
  dict,
  onClose,
}: NotificationRulesPanelProps) {
  const { rules, isLoading, error, refresh } = useNotificationRules(orgSlug);
  const { save, remove, saving, saveError, clearError } = useSaveNotificationRule(orgSlug);
  // Job types the user is adding a first rule for (not yet persisted).
  const [draftTypes, setDraftTypes] = useState<string[]>([]);
  const [addSelection, setAddSelection] = useState("");
  // saveError is shared hook state — remember whose save failed so only that
  // card shows it.
  const [errorType, setErrorType] = useState<string | null>(null);

  const ruledTypes = useMemo(() => new Set(rules.map((rule) => rule.jobType)), [rules]);
  const addableTypes = useMemo(
    () =>
      [...new Set([...jobTypes, ...draftTypes])]
        .filter((type) => type !== SELF_TYPE && !ruledTypes.has(type) && !draftTypes.includes(type))
        .sort((a, b) => a.localeCompare(b)),
    [jobTypes, draftTypes, ruledTypes],
  );

  const cards: Array<{ jobType: string; rule: NotificationRule | null }> = [
    ...rules.map((rule) => ({ jobType: rule.jobType, rule: rule as NotificationRule | null })),
    ...draftTypes.filter((type) => !ruledTypes.has(type)).map((jobType) => ({ jobType, rule: null })),
  ];

  const handleSaved = (jobType: string) => {
    setDraftTypes((types) => types.filter((type) => type !== jobType));
    void refresh();
  };

  return (
    <aside className="sticky top-4 flex max-h-[calc(100vh-10rem)] flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* header */}
      <div className="flex items-start gap-2 px-4 pt-4">
        <div className="min-w-0 flex-1">
          <span className="text-base font-semibold text-gray-900 dark:text-white">
            {tr("notifications.title", dict)}
          </span>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tr("notifications.subtitle", dict)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={tr("detail.close", dict)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <HiOutlineX className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            {tr("notifications.loadError", dict)}
          </div>
        )}
        {!error && !isLoading && cards.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">
            {tr("notifications.empty", dict)}
          </p>
        )}
        {cards.map(({ jobType, rule }) => (
          <RuleCard
            key={jobType}
            jobType={jobType}
            rule={rule}
            dict={dict}
            saving={saving === jobType}
            saveError={errorType === jobType ? saveError : null}
            onSave={async (upsert) => {
              clearError();
              setErrorType(null);
              if (await save(jobType, upsert)) handleSaved(jobType);
              else setErrorType(jobType);
            }}
            onDelete={
              rule
                ? async () => {
                    clearError();
                    setErrorType(null);
                    if (await remove(jobType)) handleSaved(jobType);
                    else setErrorType(jobType);
                  }
                : () => setDraftTypes((types) => types.filter((type) => type !== jobType))
            }
          />
        ))}

        {/* add a rule for a job type that has none yet */}
        {addableTypes.length > 0 && (
          <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
            <select
              value={addSelection}
              onChange={(event) => setAddSelection(event.target.value)}
              className="h-8 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="">{tr("notifications.addType", dict)}</option>
              {addableTypes.map((type) => (
                <option key={type} value={type}>
                  {jobTypeLabel(type)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!addSelection}
              onClick={() => {
                setDraftTypes((types) => [...types, addSelection]);
                setAddSelection("");
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <HiOutlinePlus className="h-3.5 w-3.5" />
              {tr("notifications.add", dict)}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

interface RuleCardProps {
  readonly jobType: string;
  readonly rule: NotificationRule | null;
  readonly dict: I18nRecord;
  readonly saving: boolean;
  readonly saveError: Error | null;
  readonly onSave: (rule: { recipients: string[]; enabled: boolean; throttleSeconds: number }) => void;
  readonly onDelete: () => void;
}

function RuleCard({ jobType, rule, dict, saving, saveError, onSave, onDelete }: RuleCardProps) {
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [recipients, setRecipients] = useState<string[]>(rule?.recipients ?? []);
  const [throttleSeconds, setThrottleSeconds] = useState(
    rule?.throttleSeconds ?? DEFAULT_THROTTLE_SECONDS,
  );
  const [recipientInput, setRecipientInput] = useState("");
  const [inputError, setInputError] = useState(false);

  const dirty =
    rule == null ||
    enabled !== rule.enabled ||
    throttleSeconds !== rule.throttleSeconds ||
    recipients.join(",") !== rule.recipients.join(",");

  const addRecipient = () => {
    const candidate = recipientInput.trim();
    if (!E164_PATTERN.test(candidate)) {
      setInputError(true);
      return;
    }
    setInputError(false);
    if (!recipients.includes(candidate)) setRecipients([...recipients, candidate]);
    setRecipientInput("");
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
          {jobTypeLabel(jobType)}
        </span>
        <ToggleSwitch
          checked={enabled}
          onChange={setEnabled}
          label={tr("notifications.enabled", dict)}
          sizing="sm"
        />
      </div>

      {/* recipients */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
          {tr("notifications.recipients", dict)}
        </span>
        {recipients.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipients.map((recipient) => (
              <span
                key={recipient}
                className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              >
                {recipient}
                <button
                  type="button"
                  onClick={() => setRecipients(recipients.filter((entry) => entry !== recipient))}
                  aria-label={`${tr("notifications.removeRecipient", dict)} ${recipient}`}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <HiOutlineX className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <input
            value={recipientInput}
            onChange={(event) => {
              setRecipientInput(event.target.value);
              setInputError(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addRecipient();
              }
            }}
            placeholder={tr("notifications.recipientPlaceholder", dict)}
            className={`h-7 flex-1 rounded-lg border bg-white px-2 font-mono text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-300 ${
              inputError
                ? "border-red-400 dark:border-red-500"
                : "border-gray-300 dark:border-gray-600"
            }`}
          />
          <button
            type="button"
            onClick={addRecipient}
            className="h-7 rounded-lg border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {tr("notifications.addRecipient", dict)}
          </button>
        </div>
        {inputError && (
          <span className="text-[11px] text-red-600 dark:text-red-400">
            {tr("notifications.invalidRecipient", dict)}
          </span>
        )}
        {recipients.length === 0 && !inputError && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {tr("notifications.noRecipients", dict)}
          </span>
        )}
      </div>

      {/* throttle */}
      <label className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        {tr("notifications.throttle", dict)}
        <input
          type="number"
          min={0}
          value={throttleSeconds}
          onChange={(event) => setThrottleSeconds(Math.max(0, Number(event.target.value) || 0))}
          className="h-7 w-20 rounded-lg border border-gray-300 bg-white px-2 text-right font-mono text-xs text-gray-700 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
        />
      </label>

      {saveError && !saving && (
        <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {saveError.message || tr("notifications.saveError", dict)}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          aria-label={tr("notifications.delete", dict)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20 dark:hover:text-red-400"
        >
          <HiOutlineTrash className="h-3.5 w-3.5" />
          {tr("notifications.delete", dict)}
        </button>
        <button
          type="button"
          disabled={saving || !dirty || recipients.length === 0}
          onClick={() => onSave({ recipients, enabled, throttleSeconds })}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {saving ? "…" : tr("notifications.save", dict)}
        </button>
      </div>
    </div>
  );
}
