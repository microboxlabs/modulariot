"use client";

import { CustomNotification } from "@/features/notifications/notification";
import React, { useEffect, useRef } from "react";
import { configureLocale } from "@/features/common/services/days.service";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import InnerData from "@/features/common/components/notification/notification-types/inner-data";
import InitialIdentifier from "@/features/common/components/user-related/initial-identifier";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";

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

  const runtimeConfig = useRuntimeConfig();
  const lastNotificationRef = useRef<string>("");
  const notificationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Wait for runtime config and tenantId before connecting
    if (!runtimeConfig?.ECM_PUBLIC_URL || !tenantId) return;

    // Initialize the global EventSource if not already done
    if (!isInitialized) {
      globalEventSource = new EventSource(
        `${runtimeConfig.ECM_PUBLIC_URL}/api/v1/events/tenant/${tenantId}/stream`
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
            className=" w-full flex flex-row gap-2 items-center cursor-pointer rounded-md p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
            // sonner injects its own CSS as an un-layered <style> tag with
            // `[data-sonner-toast]>* { transition: opacity .4s }`. Tailwind
            // v4 wraps all utility classes (transition-colors, duration-300,
            // ...) in `@layer utilities`, and per the CSS cascade-layers
            // spec, un-layered rules always beat layered ones regardless of
            // specificity — so sonner's rule silently wins the
            // transition-property/-duration for this element no matter what
            // Tailwind classes are used, leaving background-color with no
            // transition at all (an instant snap on hover). Setting the
            // transition here via inline style sidesteps layers entirely,
            // since inline styles always outrank any stylesheet rule.
            style={{
              transitionProperty: "background-color",
              transitionDuration: "300ms",
              transitionTimingFunction: "ease",
            }}
            onClick={() => {
              window.location.href = parsed_event.payload.viewUrl;
            }}
          >
            <InitialIdentifier name={parsed_event.payload.creator.name} />
            <InnerData data={parsed_event.payload} dictionary={dictionary} />
          </div>
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
  }, [dictionary, runtimeConfig, tenantId]);

  return null;
}
