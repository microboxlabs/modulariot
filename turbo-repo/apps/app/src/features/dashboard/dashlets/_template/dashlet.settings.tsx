"use client";

import { useState } from "react";
import { TextInput, Label } from "flowbite-react";
import type { DashletSettingsProps } from "../types";
import type { DashletConfig } from "./dashlet";
import { SettingsShell } from "../common/settings-shell";
import { useSettingsDirty } from "../common/use-settings-dirty";

/**
 * Settings drawer for this dashlet.
 *
 * ## Dirty tracking (unsaved-changes protection)
 *
 * Every settings component **must** wire dirty tracking so that:
 * - The Save button is disabled until the user changes something.
 * - Closing the drawer with unsaved changes shows a confirmation modal.
 *
 * ### How it works
 * 1. Call `useSettingsDirty(isOpen, snapshot)` with an object containing
 *    **every** field that should participate in change detection.
 * 2. Pass the returned `isDirty` to `<SettingsShell isDirty={isDirty}>`.
 *
 * ### Adding a new field
 * When you add a new setting you must update **three** places:
 *   a) Add a `useState` for the field.
 *   b) Add the field to the snapshot object passed to `useSettingsDirty`.
 *   c) Include the field in `handleSave` → `onSave(...)`.
 *
 * Forgetting step (b) means the Save button won't react to changes in
 * that field and the unsaved-changes modal won't appear.
 */
export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  widgetId,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  // ── State ──────────────────────────────────────────────────────────
  // Add a useState for each config field.
  const [title, setTitle] = useState(config.title || "");

  // ── Dirty tracking ────────────────────────────────────────────────
  // Every field listed here enables Save-button toggling and the
  // unsaved-changes modal. When you add a new field, add it here too.
  const isDirty = useSettingsDirty(isOpen, { title });

  // ── Save handler ───────────────────────────────────────────────────
  // Include every field here. This is what gets persisted.
  const handleSave = () => {
    onSave({
      title: title.trim() || "Default Title",
      // Add other fields here
    });
    onClose();
  };

  return (
    <SettingsShell
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      dictionary={dictionary}
      widgetId={widgetId}
      isDirty={isDirty}
    >
      {/* Add your form fields here */}
      <div>
        <Label htmlFor="dashlet-title" className="mb-1 block text-sm">
          Title
        </Label>
        <TextInput
          id="dashlet-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter title..."
        />
      </div>
    </SettingsShell>
  );
}
