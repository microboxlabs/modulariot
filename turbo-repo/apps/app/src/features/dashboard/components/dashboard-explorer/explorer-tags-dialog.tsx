"use client";

/**
 * Edits a dashboard's tags in the app's floating dialog, over a blurred page,
 * with the new-dashboard setup's tags step inside the setup's card: heading
 * and line under it, the field with its chips and suggestions, and the gray
 * footer with Cancel and Save.
 */
import { useState } from "react";
import { Button } from "flowbite-react";
import { HiCheck } from "react-icons/hi";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { BUTTON_SHAPE } from "../dashboard-setup/dashboard-setup";
import { TagsStep } from "../dashboard-setup/tags-step";

type T = (key: string, params?: Record<string, string>) => string;

interface ExplorerTagsDialogProps {
  title: string;
  /** The line under the title. */
  body: string;
  initialTags: readonly string[];
  /** Every tag the organization's dashboards use, suggested first. */
  knownTags: readonly string[];
  /** The setup's tags step texts: placeholder, suggestions and the rest. */
  t: T;
  saveLabel: string;
  cancelLabel: string;
  onSave: (tags: string[]) => void;
  onCancel: () => void;
}

export default function ExplorerTagsDialog({
  title,
  body,
  initialTags,
  knownTags,
  t,
  saveLabel,
  cancelLabel,
  onSave,
  onCancel,
}: Readonly<ExplorerTagsDialogProps>) {
  const [tags, setTags] = useState<string[]>([...initialTags]);
  return (
    <AbsoluteModal
      selected
      setSelected={onCancel}
      ariaLabel={title}
      maxWidth="42rem"
      className="w-full rounded-2xl border border-gray-200 bg-white text-left text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
    >
      <div className="w-full px-6 pb-4 pt-6 sm:px-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {body}
          </p>
        </div>
        <TagsStep
          tags={tags}
          onChange={setTags}
          t={t}
          known={knownTags}
          autoFocus
        />
      </div>
      <div className="flex w-full items-center justify-between gap-3 rounded-b-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
        <Button
          color="light"
          size="sm"
          type="button"
          onClick={onCancel}
          className={`w-1/3 ${BUTTON_SHAPE}`}
        >
          {cancelLabel}
        </Button>
        <Button
          color="blue"
          size="sm"
          type="button"
          onClick={() => onSave(tags)}
          className={`w-2/3 ${BUTTON_SHAPE}`}
        >
          <span className="flex items-center gap-1.5">
            <HiCheck className="h-3.5 w-3.5" />
            {saveLabel}
          </span>
        </Button>
      </div>
    </AbsoluteModal>
  );
}
