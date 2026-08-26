"use client";

import { Modal, ModalBody } from "flowbite-react";
import { FaWhatsapp } from "react-icons/fa";
import { HiEnvelope, HiLink } from "react-icons/hi2";
import { toast } from "sonner";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { StoryItem } from "../storytelling.types";

interface StoryShareModalProps {
  readonly story: StoryItem | null;
  readonly lang: string;
  readonly onClose: () => void;
  readonly dict: I18nRecord;
}

// Manually prefixed with the "/app" basePath — this builds a plain string,
// not a next/link href, so unlike <Link> it won't get that prefix for free
// (same reason Breadcrumb.tsx prepends it by hand for its own raw <a> hrefs).
function shareUrl(story: StoryItem, lang: string): string {
  if (typeof window === "undefined") return story.title;
  return `${window.location.origin}/app/${lang}/storytelling/${encodeURIComponent(story.id)}`;
}

const ROW =
  "flex w-full items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700";

export default function StoryShareModal({ story, lang, onClose, dict }: StoryShareModalProps) {
  async function handleCopyLink() {
    if (!story) return;
    try {
      await navigator.clipboard.writeText(shareUrl(story, lang));
      toast.success(tr("share.copied", dict));
    } catch {
      toast.error(tr("share.copyFailed", dict));
    }
    onClose();
  }

  function handleEmail() {
    if (!story) return;
    const url = shareUrl(story, lang);
    window.open(`mailto:?subject=${encodeURIComponent(story.title)}&body=${encodeURIComponent(url)}`);
    onClose();
  }

  function handleWhatsapp() {
    if (!story) return;
    const url = shareUrl(story, lang);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${story.title} ${url}`)}`,
      "_blank",
      "noopener,noreferrer"
    );
    onClose();
  }

  return (
    <Modal dismissible show={story !== null} onClose={onClose} size="sm">
      {story && (
        <>
          <div className="p-4 md:p-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {tr("share.title", dict)}
            </h3>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">{story.title}</p>
          </div>

          <ModalBody className="flex flex-col gap-2 pt-0">
            <button type="button" onClick={handleCopyLink} className={ROW}>
              <HiLink className="h-5 w-5 shrink-0 text-gray-400" />
              {tr("share.copyLink", dict)}
            </button>
            <button type="button" onClick={handleEmail} className={ROW}>
              <HiEnvelope className="h-5 w-5 shrink-0 text-gray-400" />
              {tr("share.email", dict)}
            </button>
            <button type="button" onClick={handleWhatsapp} className={ROW}>
              <FaWhatsapp className="h-5 w-5 shrink-0 text-gray-400" />
              {tr("share.whatsapp", dict)}
            </button>
          </ModalBody>
        </>
      )}
    </Modal>
  );
}
