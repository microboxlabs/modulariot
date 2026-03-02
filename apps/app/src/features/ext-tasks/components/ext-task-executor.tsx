"use client";

import { useEffect, useState } from "react";
import { Card, Spinner } from "flowbite-react";
import {
  HiCheckCircle,
  HiExclamationCircle,
  HiClock,
  HiXCircle,
} from "react-icons/hi";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import type { TaskExecutionStatus } from "../ext-task.types";

interface ExtTaskExecutorProps {
  token: string;
  taskType: string;
  dict: I18nDictionary;
}

type ViewState = "loading" | TaskExecutionStatus;

const STATUS_MAP: Record<number, TaskExecutionStatus> = {
  410: "expired",
  404: "invalid",
  400: "invalid",
};

export default function ExtTaskExecutor({
  token,
  taskType,
  dict,
}: ExtTaskExecutorProps) {
  const [state, setState] = useState<ViewState>("loading");
  const t = dict.ext_tasks;

  useEffect(() => {
    let cancelled = false;

    async function execute() {
      try {
        const res = await fetch("/app/api/ext/tasks/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, taskType }),
        });

        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          setState(data.status as TaskExecutionStatus);
        } else {
          const mapped = STATUS_MAP[res.status];
          setState(mapped ?? "error");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    execute();
    return () => {
      cancelled = true;
    };
  }, [token, taskType]);

  return (
    <Card className="w-full">
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        {state === "loading" && (
          <>
            <Spinner size="xl" />
            <p className="text-gray-600 dark:text-gray-400">{t.processing}</p>
          </>
        )}

        {state === "completed" && (
          <>
            <HiCheckCircle className="h-16 w-16 text-green-500" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {t.completed}
            </p>
          </>
        )}

        {state === "already_completed" && (
          <>
            <HiCheckCircle className="h-16 w-16 text-blue-500" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {t.already_completed}
            </p>
          </>
        )}

        {state === "expired" && (
          <>
            <HiClock className="h-16 w-16 text-yellow-500" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {t.expired}
            </p>
          </>
        )}

        {state === "invalid" && (
          <>
            <HiXCircle className="h-16 w-16 text-red-500" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {t.invalid}
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <HiExclamationCircle className="h-16 w-16 text-red-500" />
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {t.error}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
