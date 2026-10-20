"use client";

import { useState } from "react";
import { AccessAllowed } from "@/features/auth/components/access-allowed";
import { ACCESS_RULES } from "@/features/auth/access/access-rules";
import { UnclaimTaskModal } from "./unclaim-task-modal";
import { HiOutlineXCircle } from "react-icons/hi";

interface TaskOwnerDisplayProps {
  taskId: string;
  takenBy: string | null;
  dict: Record<string, string>;
}

export function TaskOwnerDisplay({
  taskId,
  takenBy,
  dict,
}: Readonly<TaskOwnerDisplayProps>) {
  const [showUnclaimModal, setShowUnclaimModal] = useState(false);
  const [currentOwner, setCurrentOwner] = useState(takenBy);

  // Hide if task is unclaimed
  if (!currentOwner) {
    return null;
  }

  const handleUnclaimSuccess = () => {
    // Update local state to hide the component
    setCurrentOwner(null);
  };

  return (
    <>
      <h2 className="text-xs font-light text-gray-500 dark:text-gray-400">
        {dict.taken_by}:{" "}
        <AccessAllowed
          rule={ACCESS_RULES.taskUnclaim}
          fallback={
            <span className="font-normal text-gray-800 dark:text-gray-200">
              {currentOwner}
            </span>
          }
        >
          <button
            onClick={() => setShowUnclaimModal(true)}
            className="inline-flex items-center gap-1 font-normal text-gray-800 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 transition-colors underline decoration-dotted underline-offset-2 hover:decoration-solid cursor-pointer"
            title={dict.unclaim_task}
            aria-label={dict.unclaim_task}
          >
            <span>{currentOwner}</span>
            <HiOutlineXCircle className="h-3.5 w-3.5" />
          </button>
        </AccessAllowed>
      </h2>

      <UnclaimTaskModal
        isOpen={showUnclaimModal}
        onClose={() => setShowUnclaimModal(false)}
        taskId={taskId}
        currentOwner={currentOwner}
        dict={dict}
        onSuccess={handleUnclaimSuccess}
      />
    </>
  );
}
