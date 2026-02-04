"use client";

import { useState } from "react";
import { GroupAllowed } from "@/features/common/components/group-allowed/group-allowed";
import { UnclaimTaskModal } from "./unclaim-task-modal";
import { HiOutlineXCircle } from "react-icons/hi";

interface TaskOwnerDisplayProps {
  taskId: string;
  takenBy: string | null;
  userGroups: string[];
  dict: Record<string, string>;
}

const ADMIN_GROUPS = [
  "GROUP_ALFRESCO_ADMINISTRATORS",
  "GROUP_MINTRAL_SYSTEM_ADMIN",
];

export function TaskOwnerDisplay({
  taskId,
  takenBy,
  userGroups,
  dict,
}: TaskOwnerDisplayProps) {
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
        <GroupAllowed userGroups={userGroups} allowedTo={ADMIN_GROUPS}>
          <button
            onClick={() => setShowUnclaimModal(true)}
            className="inline-flex items-center gap-1 font-normal text-gray-800 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 transition-colors underline decoration-dotted underline-offset-2 hover:decoration-solid cursor-pointer"
            title={dict.unclaim_task}
            aria-label={dict.unclaim_task}
          >
            <span>{currentOwner}</span>
            <HiOutlineXCircle className="h-3.5 w-3.5" />
          </button>
        </GroupAllowed>
        <GroupAllowed userGroups={userGroups} notAllowedTo={ADMIN_GROUPS}>
          <span className="font-normal text-gray-800 dark:text-gray-200">
            {currentOwner}
          </span>
        </GroupAllowed>
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
