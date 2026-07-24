"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "flowbite-react";
import { HiX, HiClipboardCheck } from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  channelKey,
  conditionForTrigger,
  findTarget,
  triggerFromCondition,
  unmappedRequiredFields,
  type ChannelBindingDraft,
  type ChannelDraft,
  type DispatchTarget,
  type EventBinding,
} from "./review-binding.types";
import { checkTemplate } from "./review-template-validation";
import { ReviewConfigTab } from "./review-config-tab";
import { ReviewMappingTab } from "./review-mapping-tab";

type TabId = "config" | "mapping";

interface ReviewSettingsDrawerProps {
  readonly show: boolean;
  readonly onClose: () => void;
  /** Display title of the column being configured. */
  readonly laneTitle: string;
  /** Every channel attached to this column, own and inherited from a parent org. */
  readonly bindings: readonly EventBinding[];
  readonly targets: readonly DispatchTarget[];
  readonly onSave: (channels: ChannelBindingDraft[]) => void;
  readonly saving?: boolean;
  /** `pages.reviewProcess` subtree. */
  readonly dict: I18nRecord;
}

/** Templates serialized key-order-independently, so a re-keyed map is not "dirty". */
function stableTemplates(templates: Record<string, string>): [string, string][] {
  return Object.entries(templates).sort(([a], [b]) => (a < b ? -1 : 1));
}

/** A signature over the editable set, for the dirty check. */
function channelsSignature(
  enabled: boolean,
  channels: readonly ChannelDraft[]
): string {
  const rows = channels
    .map((channel) => [
      channelKey(channel.connectionId, channel.operationId),
      channel.trigger,
      stableTemplates(channel.templates),
    ])
    .sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1));
  return JSON.stringify([enabled, rows]);
}

function draftFromBinding(binding: EventBinding): ChannelDraft {
  return {
    connectionId: binding.connectionId,
    operationId: binding.operationId,
    trigger: triggerFromCondition(binding.matchCondition),
    templates: { ...binding.fieldTemplates },
  };
}

/**
 * Right-side settings drawer for a column's review process. Modelled on the dashboard
 * dashlet settings drawer (portal to body, slide-in, tabbed) so it reads the same as
 * the rest of the app.
 *
 * A column can fan its verdict out to several channels, so the drawer edits a *list*:
 * each attached channel carries its own trigger and its own field mapping, and Save
 * commits the whole set (the hook upserts what is attached and drops what was
 * detached). The master toggle arms or pauses the column's own channels together;
 * channels inherited from a parent org are shown for context but not editable here.
 */
export function ReviewSettingsDrawer({
  show,
  onClose,
  laneTitle,
  bindings,
  targets,
  onSave,
  saving = false,
  dict,
}: Readonly<ReviewSettingsDrawerProps>) {
  const ownBindings = useMemo(
    () => bindings.filter((binding) => !binding.inherited),
    [bindings]
  );
  const inheritedBindings = useMemo(
    () => bindings.filter((binding) => binding.inherited),
    [bindings]
  );

  const [activeTab, setActiveTab] = useState<TabId>("config");
  const [enabled, setEnabled] = useState(false);
  const [channels, setChannels] = useState<ChannelDraft[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  // Re-seed from the stored bindings every time the drawer opens, so a reopened form
  // never shows another column's draft.
  useEffect(() => {
    if (!show) return;
    setActiveTab("config");
    setEnabled(ownBindings.some((binding) => binding.enabled));
    const seeded = ownBindings.map(draftFromBinding);
    setChannels(seeded);
    setActiveChannelId(
      seeded.length > 0
        ? channelKey(seeded[0].connectionId, seeded[0].operationId)
        : null
    );
  }, [show, ownBindings]);

  function addChannel(target: DispatchTarget) {
    const key = channelKey(target.connectionId, target.operationId);
    setChannels((prev) => {
      if (prev.some((c) => channelKey(c.connectionId, c.operationId) === key)) {
        return prev;
      }
      const templates: Record<string, string> = {};
      target.fields.forEach((field) => {
        templates[field.id] = "";
      });
      // New channels default to "both": the safe superset, and the trigger the
      // producer actually populates today.
      return [
        ...prev,
        {
          connectionId: target.connectionId,
          operationId: target.operationId,
          trigger: "on_review",
          templates,
        },
      ];
    });
    setActiveChannelId(key);
    setActiveTab("mapping");
  }

  function detachChannel(key: string) {
    setChannels((prev) =>
      prev.filter((c) => channelKey(c.connectionId, c.operationId) !== key)
    );
    setActiveChannelId((current) => {
      if (current !== key) return current;
      const next = channels.find(
        (c) => channelKey(c.connectionId, c.operationId) !== key
      );
      return next ? channelKey(next.connectionId, next.operationId) : null;
    });
  }

  function patchChannel(key: string, patch: Partial<ChannelDraft>) {
    setChannels((prev) =>
      prev.map((c) =>
        channelKey(c.connectionId, c.operationId) === key ? { ...c, ...patch } : c
      )
    );
  }

  function editMapping(key: string) {
    setActiveChannelId(key);
    setActiveTab("mapping");
  }

  const activeChannel = channels.find(
    (c) => channelKey(c.connectionId, c.operationId) === activeChannelId
  );
  const activeTarget = activeChannel
    ? findTarget(targets, activeChannel.connectionId, activeChannel.operationId)
    : undefined;

  const committed: ChannelBindingDraft[] = useMemo(
    () =>
      channels.map((channel) => ({
        connectionId: channel.connectionId,
        operationId: channel.operationId,
        matchCondition: conditionForTrigger(channel.trigger),
        fieldTemplates: channel.templates,
        enabled,
      })),
    [channels, enabled]
  );

  const dirty = useMemo(() => {
    const storedChannels = ownBindings.map(draftFromBinding);
    const storedEnabled = ownBindings.some((binding) => binding.enabled);
    return (
      channelsSignature(enabled, channels) !==
      channelsSignature(storedEnabled, storedChannels)
    );
  }, [enabled, channels, ownBindings]);

  const blockingReason = useMemo(() => {
    // A template the server would refuse can never be stored, armed or not.
    for (const channel of channels) {
      const target = findTarget(
        targets,
        channel.connectionId,
        channel.operationId
      );
      const name = target?.connectionName ?? channel.connectionId;
      for (const [fieldId, template] of Object.entries(channel.templates)) {
        if (checkTemplate(template).status === "invalid") {
          return tr("validation.brokenTemplate", dict, {
            channel: name,
            field: fieldId,
          });
        }
      }
    }
    if (!enabled) return null;
    if (channels.length === 0) return tr("validation.noChannels", dict);
    for (const channel of channels) {
      const target = findTarget(
        targets,
        channel.connectionId,
        channel.operationId
      );
      const missing = unmappedRequiredFields(target, channel.templates);
      if (missing.length > 0) {
        return tr("validation.unmapped", dict, {
          channel: target?.connectionName ?? channel.connectionId,
          fields: missing.map((field) => field.id).join(", "),
        });
      }
    }
    return null;
  }, [enabled, channels, targets, dict]);

  // Whether there is anything to save, shown when nothing blocks it.
  const footerNote = !blockingReason && dirty ? tr("drawer.unsaved", dict) : "";

  if (typeof document === "undefined") return null;

  const mappingChannels = channels.map((channel) => {
    const target = findTarget(
      targets,
      channel.connectionId,
      channel.operationId
    );
    return {
      key: channelKey(channel.connectionId, channel.operationId),
      label: target?.connectionName ?? channel.connectionId,
    };
  });

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
              channels={channels}
              stored={ownBindings}
              inherited={inheritedBindings}
              onAddChannel={addChannel}
              onDetachChannel={detachChannel}
              onTriggerChange={(key, trigger) => patchChannel(key, { trigger })}
              onEditMapping={editMapping}
              dict={dict}
            />
          )}
          {show && activeTab === "mapping" && (
            <ReviewMappingTab
              target={enabled ? activeTarget : undefined}
              mappings={activeChannel?.templates ?? {}}
              onChange={(fieldId, template) => {
                if (!activeChannel) return;
                const key = channelKey(
                  activeChannel.connectionId,
                  activeChannel.operationId
                );
                patchChannel(key, {
                  templates: { ...activeChannel.templates, [fieldId]: template },
                });
              }}
              channels={mappingChannels}
              activeChannelId={activeChannelId}
              onSelectChannel={setActiveChannelId}
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
                onClick={() => onSave(committed)}
                disabled={saving || !dirty || Boolean(blockingReason)}
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
