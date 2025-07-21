"use client";

import { CustomNotification } from "@/features/notifications/notification";
import React, { useEffect, useRef } from "react";
import { configureLocale } from "@/features/common/services/days.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import InnerData from "@/features/common/components/notification/notification-types/inner-data";

// Global singleton to track SSE connection
let globalEventSource: EventSource | null = null;
let globalNotificationHandlers: Set<(event: any) => void> = new Set();
let isInitialized = false;

export default function SseListener({
  tenantId,
  dictionary,
}: {
  dictionary: I18nRecord;
  tenantId: string | null | undefined;
}) {
  configureLocale();

  const lastNotificationRef = useRef<string>("");
  const notificationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Initialize the global EventSource if not already done
    if (!isInitialized) {
      globalEventSource = new EventSource(
        `${process.env.NEXT_PUBLIC_ECM_API_URL}/api/v1/events/tenant/${tenantId}/stream`,
      );

      isInitialized = true;
      globalEventSource.onmessage = (event: MessageEvent) => {
        const parsed_event = JSON.parse(event.data);

        if (parsed_event.eventType === "internalNotifications") {
          // Notify all registered handlers
          globalNotificationHandlers.forEach((handler) => {
            handler(event);
          });
        }

        const _a = {
          id: "54903c4e-eeab-4b37-b8d6-a26260caf57d",
          eventType: "create",
          payload: {
            taskFormKey: "wfship:tripOutsideInitiatedTask",
            taskId: "699920",
            instanceId: "699805",
          },
          timestamp: "2024-09-11T04:54:00.510587504Z",
          metadata: null,
        };
      };
    }

    // Add this component's handler to the global handlers
    const handler = (event: any) => {
      const parsed_event = JSON.parse(event.data);

      if (parsed_event.eventType === "internalNotifications") {
        // Create a unique identifier for this notification
        const notificationId = `${parsed_event.payload.message}-${parsed_event.payload.timestamp}`;

        // Check if this is a duplicate notification
        if (lastNotificationRef.current === notificationId) {
          return;
        }

        // Clear any existing timeout
        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }

        // Set a timeout to allow the same notification again after 5 seconds
        notificationTimeoutRef.current = window.setTimeout(() => {
          lastNotificationRef.current = "";
        }, 1000);

        // Update the last notification reference
        lastNotificationRef.current = notificationId;

        CustomNotification(
          <div
            className=" w-fit flex flex-row gap-2 items-center cursor-pointer rounded-md transition-all duration-300 hover:bg-gray-300 dark:hover:bg-gray-700 p-2"
            onClick={() => {
              window.location.href = parsed_event.payload.viewUrl;
            }}
          >
            <div className="w-10 h-10 flex-shrink-0 rounded-full bg-gray-500 text-gray-800 flex items-center justify-center ">
              <p className="flex items-center justify-center text-white">
                {parsed_event.payload.creator.name.charAt(0).toUpperCase()}
              </p>
            </div>
            <InnerData data={parsed_event.payload} dictionary={dictionary} />
          </div>,
        );
      }
    };

    globalNotificationHandlers.add(handler);

    return () => {
      globalNotificationHandlers.delete(handler);
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [dictionary]);

  return null;
}
