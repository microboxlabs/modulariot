"use client";

import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { useEffect, useState } from "react";
import { GoClockFill } from "react-icons/go";
import { Tooltip } from "flowbite-react";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function TimeElement({
  task,
  dict,
  endTime,
}: {
  task: TaskResponse;
  dict: I18nRecord;
  endTime: string;
}) {
  const [_currentTime, setCurrentTime] = useState(new Date());
  let timeDifference = getTimeDifference(task);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (endTime) {
    return null;
  }

  return (
    <Tooltip
      style="auto"
      content={
        <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-nowrap flex flex-row">
          {(dict.bento as I18nRecord).trip_duration as string}
          <span className="block lg:hidden mr-2 lg:mr-0">:</span>
          <span className="text-gray-900 dark:text-gray-100 block lg:hidden">
            {timeDifference}
          </span>
        </div>
      }
    >
      <div className="h-10 flex justify-center items-center p-2 border border-gray-300 dark:border-gray-700 hover:border-gray-500 dark:hover:border-gray-500 rounded-lg transition-all duration-100 bg-white dark:bg-gray-800 gap-2 w-fit text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer">
        <div className="flex flex-row gap-2 items-center">
          <GoClockFill className="w-5 h-5" width={30} height={30} />
          <p className="text-sm text-gray-900 dark:text-gray-100 lg:block hidden whitespace-nowrap">
            {timeDifference}
          </p>
        </div>
      </div>
    </Tooltip>
  );
}

function getTimeDifference(task: TaskResponse) {
  // Handle different date formats and ensure proper timezone handling
  let creationDate: Date;
  const dateString = task.cm_created as string;

  if (!dateString) {
    return "0s";
  }

  // If the date string already has timezone info (ends with Z or has +), use it as is
  if (dateString.endsWith("Z") || dateString.includes("+")) {
    creationDate = new Date(dateString);
  } else {
    // If no timezone info, assume it's UTC and add Z suffix
    creationDate = new Date(dateString + "Z");
  }

  const now = new Date();
  const diffInMs = Math.abs(now.getTime() - creationDate.getTime());

  const years = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 365));
  const months = Math.floor(
    (diffInMs % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 30),
  );
  const days = Math.floor(
    (diffInMs % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24),
  );
  const hours = Math.floor(
    (diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const minutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffInMs % (1000 * 60)) / 1000);

  const parts = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}m`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.length > 0 ? parts.join(" ") : "0s";
}
