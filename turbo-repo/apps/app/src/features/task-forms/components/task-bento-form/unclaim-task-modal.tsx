"use client";

import { Button, Modal, ModalBody, ModalHeader } from "flowbite-react";
import { useState } from "react";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import { toast } from "sonner";

interface UnclaimTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  currentOwner: string;
  dict: Record<string, string>;
  onSuccess: () => void;
}

export function UnclaimTaskModal({
  isOpen,
  onClose,
  taskId,
  currentOwner,
  dict,
  onSuccess,
}: UnclaimTaskModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleUnclaim = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/app/api/task/unclaim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(dict.unclaim_task_success);
        onSuccess();
        onClose();
      } else {
        toast.error(dict.unclaim_task_error);
      }
    } catch (error) {
      toast.error(dict.unclaim_task_error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal show={isOpen} size="md" onClose={onClose} popup>
      <ModalHeader />
      <ModalBody>
        <div className="text-center">
          <HiOutlineExclamationCircle className="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200" />
          <h3 className="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
            {dict.unclaim_task_title}
          </h3>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            {dict.unclaim_task_description}
          </p>
          <div className="mb-5">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {dict.current_owner}: {currentOwner}
            </p>
          </div>
          <div className="flex justify-center gap-4">
            <Button
              color="failure"
              onClick={handleUnclaim}
              disabled={isLoading}
            >
              {dict.unclaim_task_confirm}
            </Button>
            <Button color="gray" onClick={onClose} disabled={isLoading}>
              {dict.unclaim_task_cancel}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
