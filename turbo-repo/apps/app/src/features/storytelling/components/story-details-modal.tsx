"use client";

import { Modal, ModalBody, ModalHeader } from "flowbite-react";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { getArtifactTypeMeta } from "../artifact-type-meta";
import type { StoryItem } from "../storytelling.types";

interface StoryDetailsModalProps {
  readonly story: StoryItem | null;
  readonly lang: string;
  readonly onClose: () => void;
  readonly dict: I18nRecord;
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-sm text-gray-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

export default function StoryDetailsModal({
  story,
  lang,
  onClose,
  dict,
}: StoryDetailsModalProps) {
  const locale = lang === "en" ? "en-US" : "es-CL";
  const fmt = (date: string) => formatDateString(date, "date", locale);

  return (
    <Modal
      dismissible
      show={story !== null}
      onClose={onClose}
      size="md"
      className="backdrop-blur-[10px]"
      theme={{
        content: {
          inner:
            "relative flex max-h-[90dvh] flex-col rounded-lg border border-gray-300 bg-white shadow dark:border-gray-700 dark:bg-gray-800",
        },
      }}
    >
      {story && (
        <>
          <ModalHeader>{tr("details.title", dict)}</ModalHeader>
          <ModalBody>
            <p className="mb-2 text-base font-medium text-gray-900 dark:text-white">
              {story.title}
            </p>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <Row
                label={tr("details.type", dict)}
                value={trDynamic(
                  getArtifactTypeMeta(story.artifactType).labelKey,
                  dict
                )}
              />
              <Row
                label={tr("details.created", dict)}
                value={tr("attribution", dict, { name: story.createdBy, date: fmt(story.createdAt) })}
              />
              <Row
                label={tr("details.lastEdited", dict)}
                value={tr("attribution", dict, { name: story.updatedBy, date: fmt(story.updatedAt) })}
              />
              <Row label={tr("details.id", dict)} value={story.id} />
            </div>
          </ModalBody>
        </>
      )}
    </Modal>
  );
}
