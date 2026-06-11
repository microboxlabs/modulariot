"use client";

import { useState, useEffect } from "react";
import { Button, Modal, ModalHeader, ModalBody } from "flowbite-react";
import { HiChevronDown, HiTrash } from "react-icons/hi2";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { MODAL_THEME } from "../../modal-theme";
import type { ObservationEntry } from "./observation.types";
import { relativeTime } from "./observation-utils";

export function ObservationCard({
  obs,
  dictionary,
  onDelete,
  onAddReply,
  onRemoveReply,
  pendingReplyRef,
}: Readonly<{
  obs: ObservationEntry;
  dictionary: I18nRecord;
  onDelete?: () => void;
  onAddReply?: (description: string) => void;
  onRemoveReply?: (replyId: string) => void;
  pendingReplyRef?: React.RefObject<{ text: string; send: () => void }>;
}>) {
  const [repliesOpen, setRepliesOpen] = useState(true);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const replyCount = (obs.replies ?? []).length;

  useEffect(() => {
    if (!pendingReplyRef || !isReplying) return;
    pendingReplyRef.current = {
      text: replyText,
      send: () => { if (replyText.trim()) { onAddReply?.(replyText.trim()); } },
    };
    return () => { pendingReplyRef.current = { text: "", send: () => {} }; };
  }, [replyText, isReplying, pendingReplyRef, onAddReply]);

  const handleReply = () => {
    if (!replyText.trim()) return;
    onAddReply?.(replyText.trim());
    setReplyText("");
    setIsReplying(false);
  };

  return (
    <div className="flex flex-col gap-1 group/card">

      {/* Header: [badges + name + date] · [delete] */}
      <div className="flex items-start gap-1.5">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 flex-1 min-w-0">
          <div className="flex flex-wrap gap-1">
            {obs.types.map((t) => (
              <span key={t} className="inline-flex items-center rounded bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                {tr(`bento.multimedia.obs_${t}`, dictionary)}
              </span>
            ))}
          </div>
          {obs.createdBy && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{obs.createdBy}</span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{relativeTime(obs.createdAt, dictionary)}</span>
        </div>
        {onDelete && (
          <div className="self-stretch flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(true)}
              title={tr("bento.multimedia.obs_delete", dictionary)}
              className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer opacity-100"
            >
              <HiTrash className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 dark:text-gray-300 wrap-break-word leading-relaxed">
        {obs.description}
      </p>

      {/* Delete confirmation modal */}
      <Modal
        dismissible
        show={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        size="sm"
        theme={MODAL_THEME}
      >
        <ModalHeader className="border-none">
          <span className="text-base font-semibold">{tr("bento.multimedia.obs_delete", dictionary)}</span>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {tr("bento.multimedia.obs_delete_confirm", dictionary)}
            </p>
            <div className="flex justify-end">
              <Button
                color="red"
                size="sm"
                onClick={() => { setIsDeleteConfirmOpen(false); onDelete?.(); }}
              >
                {tr("bento.multimedia.obs_delete", dictionary)}
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>

      {/* Actions row: replies toggle · reply */}
      {(replyCount > 0 || onAddReply) && (
        <div className="flex items-center gap-2">
          {replyCount > 0 && (
            <button
              type="button"
              onClick={() => setRepliesOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors cursor-pointer"
            >
              <HiChevronDown className={`w-3 h-3 transition-transform duration-150 ${repliesOpen ? "" : "-rotate-90"}`} />
              {replyCount} {replyCount === 1 ? tr("bento.multimedia.obs_reply_one", dictionary) : tr("bento.multimedia.obs_replies_many", dictionary)}
            </button>
          )}
          {onAddReply && (
            <button
              type="button"
              onClick={() => { setIsReplying((v) => !v); if (!isReplying) setRepliesOpen(true); }}
              className="text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              {tr("bento.multimedia.obs_reply", dictionary)}
            </button>
          )}
        </div>
      )}

      {/* Replies list */}
      {repliesOpen && replyCount > 0 && (
        <div className="flex flex-col gap-2 mt-0.5 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
          {(obs.replies ?? []).map((reply) => (
            <div key={reply.id} className="flex items-center gap-1.5 group/reply rounded px-1.5 py-1 -mx-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <p className="text-xs text-gray-600 dark:text-gray-300 wrap-break-word leading-relaxed">
                  {reply.description}
                </p>
                <div className="flex items-center gap-1.5">
                  {reply.createdBy && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">{reply.createdBy}</span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">{relativeTime(reply.createdAt, dictionary)}</span>
                </div>
              </div>
              {onRemoveReply && (
                <button
                  type="button"
                  onClick={() => onRemoveReply(reply.id)}
                  className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0 opacity-100"
                >
                  <HiTrash className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply form — below the replies list */}
      {isReplying && (
        <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={tr("bento.multimedia.obs_reply_placeholder", dictionary)}
            rows={2}
            autoFocus
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
          />
          <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={() => { setIsReplying(false); setReplyText(""); }}
              className="text-xs px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
              {tr("bento.multimedia.sidebar_obs_cancel", dictionary)}
            </button>
            <button type="button" onClick={handleReply} disabled={!replyText.trim()}
              className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
              {tr("bento.multimedia.obs_reply_send", dictionary)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
