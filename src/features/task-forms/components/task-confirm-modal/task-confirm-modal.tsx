"use client";

import { Button, Modal } from "flowbite-react";
import { TaskConfirmModalProps } from "./task-confirm-modal.types";
import {
  I18nRecord,
  PropsWithI18nDict,
} from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { taskNextAction } from "../../services/client-form.service";
import { useState } from "react";
import { useRouter } from "next/navigation";
import KanbanMove from "@/features/icons/kanban-move";
export default function TaskConfirmModal({
  openModal,
  setOpenModal,
  outcome,
  outcomeLabel,
  taskId,
  dict,
}: PropsWithI18nDict<TaskConfirmModalProps>) {
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
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
  }

  return (
    <Modal dismissible show={openModal} onClose={() => setOpenModal(false)}>
      <Modal.Header>{(dict.modal as I18nRecord).title as string}</Modal.Header>
      <Modal.Body>
        <div className="space-y-2 flex flex-col items-center justify-center">
          <KanbanMove />
          <p className="text-base leading-relaxed text-gray-500 dark:text-gray-400 px-8">
            Estás a punto de enviar la tarea a la siguiente etapa:{" "}
            <strong>{outcomeLabel}</strong> Si estás seguro, acciona el botón{" "}
            <strong>
              {tr("modal.confirm", dict, {
                outcome: outcomeLabel ?? "outcome",
              })}
            </strong>
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button
          isProcessing={isProcessing}
          color="blue"
          onClick={handleConfirm}
        >
          {tr("modal.confirm", dict, { outcome: outcomeLabel ?? "outcome" })}
        </Button>
        <Button
          color="gray"
          onClick={() => setOpenModal(false)}
          className=":ring-blue-700 focus:text-blue-700 enabled:hover:text-blue-700"
        >
          {(dict.modal as I18nRecord).cancel as string}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
