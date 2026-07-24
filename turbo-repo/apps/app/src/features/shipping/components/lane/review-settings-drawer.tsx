"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "flowbite-react";
import { HiX, HiClipboardCheck } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  findChannel,
  seedMappings,
  unmappedRequiredFields,
  type ReviewChannelDescriptor,
  type ReviewChannelId,
  type ReviewIntegrationConfig,
  type ReviewTrigger,
} from "./review-integration.types";
import {
  MOCK_REVIEW_CREDENTIALS,
  type ReviewCredentialOption,
} from "./review-credentials.mock";
import { ReviewConfigTab } from "./review-config-tab";
import { ReviewMappingTab } from "./review-mapping-tab";

type TabId = "config" | "mapping";

interface ReviewSettingsDrawerProps {
  readonly show: boolean;
  readonly onClose: () => void;
  /** Display title of the column being configured. */
  readonly laneTitle: string;
  readonly config: ReviewIntegrationConfig;
  readonly onSave: (config: ReviewIntegrationConfig) => void;
  readonly credentials?: readonly ReviewCredentialOption[];
  /** `pages.reviewProcess` subtree. */
  readonly dict: I18nRecord;
}

/** The subset of the config the drawer edits, for dirty comparison. */
function draftKey(config: {
  enabled: boolean;
  channelId: ReviewChannelId | null;
  credentialId: string | null;
  trigger: ReviewTrigger;
  mappings: Record<string, string>;
}): string {
  return JSON.stringify([
    config.enabled,
    config.channelId,
    config.credentialId,
    config.trigger,
    config.mappings,
  ]);
}

/**
 * Right-side settings drawer for a column's review process. Modeled on the
 * dashboard dashlet settings drawer (portal to body, slide-in, tabbed) so it
 * reads the same as the rest of the app.
 *
 * The review config is edited as a draft and committed by Save — unlike the
 * lane's view preferences, which stay inline in the column menu and apply
 * instantly.
 */
export function ReviewSettingsDrawer({
  show,
  onClose,
  laneTitle,
  config,
  onSave,
  credentials = MOCK_REVIEW_CREDENTIALS,
  dict,
}: Readonly<ReviewSettingsDrawerProps>) {
  const [activeTab, setActiveTab] = useState<TabId>("config");
  const [enabled, setEnabled] = useState(config.enabled);
  const [channelId, setChannelId] = useState<ReviewChannelId | null>(
    config.channelId
  );
  const [credentialId, setCredentialId] = useState<string | null>(
    config.credentialId
  );
  const [trigger, setTrigger] = useState<ReviewTrigger>(config.trigger);
  const [mappings, setMappings] = useState<Record<string, string>>(
    config.mappings
  );

  // Re-seed the draft from the stored config every time the drawer opens, so a
  // reopened form never shows another lane's draft.
  useEffect(() => {
    if (!show) return;
    setActiveTab("config");
    setEnabled(config.enabled);
    setChannelId(config.channelId);
    setCredentialId(config.credentialId);
    setTrigger(config.trigger);
    setMappings(config.mappings);
  }, [show, config]);

  useEffect(() => {
    if (!show) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [show, onClose]);

  const channel = findChannel(channelId);

  function selectChannel(next: ReviewChannelDescriptor) {
    if (!next.available) return;
    setChannelId(next.id);
    // Seed defaults only when moving to a channel with nothing mapped yet, so an
    // operator returning to an already-mapped channel keeps their work.
    setMappings((prev) =>
      Object.keys(prev).length > 0 && next.id === channelId
        ? prev
        : seedMappings(next)
    );
  }

  const dirty = useMemo(
    () =>
      draftKey({ enabled, channelId, credentialId, trigger, mappings }) !==
      draftKey(config),
    [enabled, channelId, credentialId, trigger, mappings, config]
  );

  // Disabling is always allowed; enabling requires a channel, a credential and
  // every required field mapped. Returns the reason Save is blocked, or null.
  const blockingReason = useMemo(() => {
    if (!enabled) return null;
    if (!channel) return tr("validation.channelRequired", dict);
    if (!credentialId) return tr("validation.credentialRequired", dict);
    const missing = unmappedRequiredFields(channel, mappings);
    if (missing.length > 0) {
      const names = missing
        .map((field) => trDynamic(field.labelKey, dict))
        .join(", ");
      return tr("validation.unmapped", dict, { fields: names });
    }
    return null;
  }, [enabled, channel, credentialId, mappings, dict]);

  function handleSave() {
    if (blockingReason) return;
    onSave({
      enabled,
      channelId,
      credentialId,
      trigger,
      mappings,
      registeredJobId: config.registeredJobId,
      lastRegisteredAt: config.lastRegisteredAt,
    });
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
        {/* Header */}
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

        {/* Tab bar */}
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

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {show && activeTab === "config" && (
            <ReviewConfigTab
              enabled={enabled}
              onEnabledChange={setEnabled}
              channelId={channelId}
              onSelectChannel={selectChannel}
              credentialId={credentialId}
              onCredentialChange={setCredentialId}
              trigger={trigger}
              onTriggerChange={setTrigger}
              credentials={credentials}
              stored={config}
              dict={dict}
            />
          )}
          {show && activeTab === "mapping" && (
            <ReviewMappingTab
              channel={enabled ? channel : undefined}
              mappings={mappings}
              onChange={(fieldId, template) =>
                setMappings((prev) => ({ ...prev, [fieldId]: template }))
              }
              dict={dict}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          {blockingReason && (
            <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
              {blockingReason}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">
              {!blockingReason && dirty ? tr("drawer.unsaved", dict) : ""}
            </span>
            <div className="flex gap-2">
              <Button color="gray" size="sm" onClick={onClose}>
                {tr("drawer.close", dict)}
              </Button>
              <Button
                color="blue"
                size="sm"
                onClick={handleSave}
                disabled={!dirty || Boolean(blockingReason)}
              >
                {tr("drawer.save", dict)}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
