"use client";

import { Button, Modal, ModalBody, ModalHeader } from "flowbite-react";
import { HiCheckCircle, HiDocumentText, HiExclamationCircle } from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type { ApprovedItem, RejectedItem, ObservationEntry } from "../task-bento-form/bento-review-context";

function fmt(date: Date, locale: string): string {
  return new Date(date).toLocaleString(locale, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ObservationCard({ obs, locale }: Readonly<{ obs: ObservationEntry; locale: string }>) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        {obs.createdBy && (
          <span className="text-xs text-gray-400 dark:text-gray-500">{obs.createdBy}</span>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{fmt(obs.createdAt, locale)}</span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{obs.description}</p>
      {obs.replies && obs.replies.length > 0 && (
        <div className="flex flex-col gap-2 mt-0.5 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
          {obs.replies.map((reply) => (
            <div key={reply.id} className="flex flex-col gap-0.5 rounded px-1.5 py-1 -mx-1.5">
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{reply.description}</p>
              <div className="flex items-center gap-1.5">
                {reply.createdBy && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{reply.createdBy}</span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">{fmt(reply.createdAt, locale)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ITEM_STYLES = {
  approved: {
    border: "border-green-200 dark:border-green-800",
    header: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    text: "text-green-700 dark:text-green-300",
    Icon: HiCheckCircle,
    iconColor: "text-green-500",
  },
  rejected: {
    border: "border-red-200 dark:border-red-800",
    header: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-300",
    Icon: HiDocumentText,
    iconColor: "text-red-500",
  },
} as const;

function ReviewedItemCard({
  item,
  status,
  locale,
  noObservationsLabel,
}: Readonly<{
  item: ApprovedItem | RejectedItem;
  status: "approved" | "rejected";
  locale: string;
  noObservationsLabel?: string;
}>) {
  const s = ITEM_STYLES[status];
  const hasBody = item.observations.length > 0 || !!noObservationsLabel;
  return (
    <li className={`rounded-lg border ${s.border} overflow-hidden list-none`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${s.header} ${hasBody ? "border-b" : ""}`}>
        <s.Icon className={`w-3.5 h-3.5 ${s.iconColor} shrink-0`} />
        <span className={`text-xs font-medium ${s.text} truncate`}>{item.fileName}</span>
      </div>
      {item.observations.length > 0 ? (
        <div className="flex flex-col gap-2 p-3">
          {item.observations.map((obs) => (
            <ObservationCard key={obs.id} obs={obs} locale={locale} />
          ))}
        </div>
      ) : (
        noObservationsLabel && (
          <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
            {noObservationsLabel}
          </p>
        )
      )}
    </li>
  );
}

function ReviewSection({
  items,
  status,
  countLabel,
  locale,
  noObservationsLabel,
}: Readonly<{
  items: (ApprovedItem | RejectedItem)[];
  status: "approved" | "rejected";
  countLabel: string;
  locale: string;
  noObservationsLabel?: string;
}>) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{countLabel}</p>
      <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {items.map((item) => (
          <ReviewedItemCard
            key={item.fileName}
            item={item}
            status={status}
            locale={locale}
            noObservationsLabel={noObservationsLabel}
          />
        ))}
      </ul>
    </div>
  );
}

interface GoBackModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSubmitting?: boolean;
  outcomeLabel: string;
  approvedItems?: ApprovedItem[];
  rejectedItems: RejectedItem[];
  subtitle?: string;
  lang: string;
  dict: I18nRecord;
}

export default function GoBackModal({
  show,
  onClose,
  onConfirm,
  isSubmitting = false,
  outcomeLabel,
  approvedItems = [],
  rejectedItems,
  subtitle,
  lang,
  dict,
}: Readonly<GoBackModalProps>) {
  const hasItems = approvedItems.length > 0 || rejectedItems.length > 0;
  const rejectedCountKey = rejectedItems.length === 1
    ? "outcome.goBackModalRejectedCount_one"
    : "outcome.goBackModalRejectedCount";
  const approvedCountKey = approvedItems.length === 1
    ? "outcome.continueModalApprovedCount_one"
    : "outcome.continueModalApprovedCount";

  return (
    <Modal
      dismissible
      show={show}
      onClose={onClose}
      size="xl"
      theme={{
        content: {
          base: "relative w-full p-4 md:h-auto",
          inner: "relative flex max-h-[90dvh] flex-col rounded-lg bg-white dark:bg-gray-800 dark:border dark:border-gray-600 shadow",
        },
        header: {
          base: "flex items-center justify-between rounded-t border-b p-5 dark:border-gray-600",
          close: { base: "hidden" },
        },
        body: { base: "flex-1 overflow-auto px-5 pb-5" },
      }}
    >
      <ModalHeader className="border-none">
        <div className="flex flex-col">
          <span className="text-base font-semibold">{outcomeLabel}</span>
          <span className="text-sm text-gray-500 mt-1 font-normal">
            {subtitle ?? tr("outcome.goBackModalSubtitle", dict)}
          </span>
        </div>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          {hasItems ? (
            <div className="flex flex-col gap-4">
              <ReviewSection
                items={approvedItems}
                status="approved"
                countLabel={trDynamic(approvedCountKey, dict, { count: String(approvedItems.length) })}
                locale={lang}
              />
              <ReviewSection
                items={rejectedItems}
                status="rejected"
                countLabel={trDynamic(rejectedCountKey, dict, { count: String(rejectedItems.length) })}
                locale={lang}
                noObservationsLabel={tr("outcome.goBackModalNoMotives", dict)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
              <HiExclamationCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {tr("outcome.goBackModalNoMotives", dict)}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button color="blue" onClick={onConfirm} disabled={isSubmitting}>
              {tr("outcome.goBackModalConfirm", dict)}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
