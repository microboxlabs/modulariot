import { Button, Modal } from "flowbite-react";
import { TaskConfirmModalProps } from "./task-confirm-modal.types";
"use client";

import { Button, Label, Modal, Textarea } from "flowbite-react";
import {
  ErrorWithAlfrescoError,
  TaskConfirmModalProps,
} from "./task-confirm-modal.types";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { taskNextAction } from "../../services/client-form.service";
import { useState } from "react";
import { useRouter } from "next/navigation";
import KanbanMove from "@/features/icons/kanban-move";
import { ErrorAlert } from "../error-alert";
export default function TaskConfirmModal({
  openModal,
  setOpenModal,
  outcome,
  outcomeLabel,
  taskId,
  dict,
  commentsFieldEnabled = false,
}: PropsWithI18nDict<TaskConfirmModalProps>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<ErrorWithAlfrescoError | undefined>();
  const router = useRouter();

  async function handleConfirm() {
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append("taskId", taskId);
      formData.append("transitionId", outcome!);
      const response = await taskNextAction({}, formData);
      if (response.success) {
        setIsProcessing(false);
        setOpenModal(false);
        router.push(`/shipping`);
        return;
      }
      console.error(response);
      setIsProcessing(false);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      setError(error as ErrorWithAlfrescoError);
    }
  }

  async function onClose() {
    setIsProcessing(false);
    setError(undefined);
    setOpenModal(false);
  }

  return (
    <Modal dismissible show={openModal} onClose={onClose} size="4xl">
      <form onSubmit={handleConfirm}>
        <Modal.Header className="border-none">
          <div className="flex flex-col items-start">
            <h2 className="text-base font-semibold">
              {(dict.modal as I18nRecord).title as string}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {(dict.modal as I18nRecord).subtittle as string}
            </p>
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="flex flex-col">
            <div className="flex items-center justify-center">
              {!commentsFieldEnabled && <KanbanMove />}
            </div>
            {commentsFieldEnabled && (
              <div className="flex-1 flex flex-col gap-y-2">
                <Label htmlFor="comments">{tr("modal.reason", dict)}:</Label>
                <Textarea id="comments" name="comments" required rows={8} />
              </div>
            )}
          </div>
          <div className="mt-4 px-6 space-y-2">
            {error && <ErrorAlert error={error} />}
          </div>
        </Modal.Body>
        <Modal.Footer className="border-none flex justify-end">
          <Button
            isProcessing={isProcessing}
            color="blue"
            onClick={handleConfirm}
          >
            {tr("modal.confirm", dict, { outcome: outcomeLabel ?? "outcome" })}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
