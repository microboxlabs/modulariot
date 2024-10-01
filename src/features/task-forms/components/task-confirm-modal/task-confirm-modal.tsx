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
    <Modal
      dismissible
      show={openModal}
      onClose={() => setOpenModal(false)}
      size="4xl"
    >
      <Modal.Header className="border-none">
        {/* Título y subtítulo juntos */}
        <div className="flex flex-col items-start">
          <h2 className="text-base font-semibold">
            {(dict.modal as I18nRecord).title as string}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {(dict.modal as I18nRecord).subtitle as string}
          </p>
        </div>
      </Modal.Header>
      <Modal.Body className="border-none">
        <div className="space-y-2 flex flex-col items-center justify-center">
          <KanbanMove />
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
    </Modal>
  );
}
