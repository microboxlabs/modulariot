"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "flowbite-react";
import { HiX, HiClipboardCheck } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  conditionForTrigger,
  findTarget,
  triggerFromCondition,
  unmappedRequiredFields,
  type DispatchTarget,
  type EventBinding,
  type ReviewTrigger,
  type UpsertBindingRequest,
} from "./review-binding.types";
import { ReviewConfigTab } from "./review-config-tab";
import { ReviewMappingTab } from "./review-mapping-tab";

type TabId = "config" | "mapping";

/** The half of an upsert the drawer owns; the hook adds event type and scope. */
export type BindingDraft = Omit<
  UpsertBindingRequest,
  "eventType" | "scopeKind" | "scopeKey"
>;

interface ReviewSettingsDrawerProps {
  readonly show: boolean;
  readonly onClose: () => void;
  /** Display title of the column being configured. */
  readonly laneTitle: string;
  /** The stored binding for this column, own or inherited from a parent org. */
  readonly binding: EventBinding | undefined;
  readonly targets: readonly DispatchTarget[];
  readonly onSave: (draft: BindingDraft) => void;
  readonly saving?: boolean;
  /** `pages.reviewProcess` subtree. */
  readonly dict: I18nRecord;
}

function draftKey(draft: BindingDraft): string {
  return JSON.stringify([
    draft.enabled,
    draft.connectionId,
    draft.operationId,
    draft.matchCondition,
    draft.fieldTemplates,
  ]);
}

/**
 * Right-side settings drawer for a column's review process. Modelled on the dashboard
 * dashlet settings drawer (portal to body, slide-in, tabbed) so it reads the same as
 * the rest of the app.
 *
 * The binding is edited as a draft and committed by Save — unlike the lane's view
 * preferences, which stay inline in the column menu and apply instantly.
 */
export function ReviewSettingsDrawer({
  show,
  onClose,
  laneTitle,
  binding,
  targets,
  onSave,
  saving = false,
  dict,
}: Readonly<ReviewSettingsDrawerProps>) {
  const [activeTab, setActiveTab] = useState<TabId>("config");
  const [enabled, setEnabled] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<ReviewTrigger>("on_reject");
  const [templates, setTemplates] = useState<Record<string, string>>({});

  // Re-seed from the stored binding every time the drawer opens, so a reopened form
  // never shows another column's draft.
  useEffect(() => {
    if (!show) return;
    setActiveTab("config");
    setEnabled(binding?.enabled ?? false);
    setConnectionId(binding?.connectionId ?? null);
    setOperationId(binding?.operationId ?? null);
    setTrigger(triggerFromCondition(binding?.matchCondition));
    setTemplates(binding?.fieldTemplates ?? {});
  }, [show, binding]);

  const selected = findTarget(targets, connectionId, operationId);

  function selectTarget(next: DispatchTarget) {
    setConnectionId(next.connectionId);
    setOperationId(next.operationId);
    // Seed a blank row per contract field only when nothing is mapped yet, so an
    // operator returning to an already-mapped channel keeps their work.
    setTemplates((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const seeded: Record<string, string> = {};
      next.fields.forEach((field) => {
        seeded[field.id] = "";
      });
      return seeded;
    });
  }

  const draft: BindingDraft = useMemo(
    () => ({
      connectionId: connectionId ?? "",
      operationId,
      matchCondition: conditionForTrigger(trigger),
      fieldTemplates: templates,
      enabled,
    }),
    [connectionId, operationId, trigger, templates, enabled]
  );

  const stored: BindingDraft | null = binding
    ? {
        connectionId: binding.connectionId,
        operationId: binding.operationId,
        matchCondition: binding.matchCondition as Record<string, unknown>,
        fieldTemplates: binding.fieldTemplates,
        enabled: binding.enabled,
      }
    : null;

  const dirty = stored === null ? enabled : draftKey(draft) !== draftKey(stored);

  // An inherited binding is shown for context but belongs to the parent org.
  const readOnly = binding?.inherited ?? false;

  const blockingReason = useMemo(() => {
    if (!enabled) return null;
    if (!selected) return tr("validation.channelRequired", dict);
    const missing = unmappedRequiredFields(selected, templates);
    if (missing.length > 0) {
      return tr("validation.unmapped", dict, {
        fields: missing.map((field) => field.id).join(", "),
      });
    }
    return null;
  }, [enabled, selected, templates, dict]);

  // Whose binding this is, or whether there is anything to save — one line, because
  // the two states are mutually exclusive and only one can be shown.
  let footerNote = "";
  if (readOnly) {
    footerNote = tr("drawer.readOnly", dict);
  } else if (!blockingReason && dirty) {
    footerNote = tr("drawer.unsaved", dict);
  }

  if (typeof document === "undefined") return null;

  const tabs: readonly { id: TabId; label: string }[] = [
    { id: "config", label: tr("drawer.tabConfig", dict) },
    { id: "mapping", label: tr("drawer.tabMapping", dict) },
  ];

  return createPortal(
    <div
      className={`fixed inset-0 z-[800] transition-all duration-300 ${
        show ? "visible opacity-100" : "invisible opacity-0"
      }`}
    >
      <button
        type="button"
        aria-label={tr("drawer.close", dict)}
        onClick={onClose}
        className={`absolute inset-0 cursor-default bg-black/20 transition-opacity duration-300 ${
          show ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        aria-label={tr("drawer.title", dict)}
        className={`absolute right-0 top-0 flex h-full w-[30rem] max-w-full flex-col border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 dark:border-gray-700 dark:bg-gray-800 ${
          show ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              <HiClipboardCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {tr("drawer.title", dict)}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tr("drawer.subtitle", dict, { lane: laneTitle })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr("drawer.close", dict)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <HiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 px-2 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary-500 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {show && activeTab === "config" && (
            <ReviewConfigTab
              enabled={enabled}
              onEnabledChange={setEnabled}
              targets={targets}
              selected={selected}
              onSelectTarget={selectTarget}
              trigger={trigger}
              onTriggerChange={setTrigger}
              stored={binding}
              dict={dict}
            />
          )}
          {show && activeTab === "mapping" && (
            <ReviewMappingTab
              target={enabled ? selected : undefined}
              mappings={templates}
              onChange={(fieldId, template) =>
                setTemplates((prev) => ({ ...prev, [fieldId]: template }))
              }
              dict={dict}
            />
          )}
        </div>

        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          {blockingReason && (
            <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
              {blockingReason}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">{footerNote}</span>
            <div className="flex gap-2">
              <Button color="gray" size="sm" onClick={onClose}>
                {tr("drawer.close", dict)}
              </Button>
              <Button
                color="blue"
                size="sm"
                onClick={() => onSave(draft)}
                disabled={readOnly || saving || !dirty || Boolean(blockingReason)}
              >
                {saving ? tr("drawer.saving", dict) : tr("drawer.save", dict)}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
