"use client";

import { HiBellAlert } from "react-icons/hi2";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { CustomNotification } from "./notification";
import InnerData from "@/features/common/components/notification/notification-types/inner-data";
import InitialIdentifier from "@/features/common/components/user-related/initial-identifier";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

interface NotificationDebugTriggerProps {
  readonly dictionary: I18nRecord;
}

const MOCK_PAYLOAD = {
  title: "Trip outside initiated",
  message: "A trip has started outside the scheduled window.",
  creator: { name: "Debug User" },
  viewUrl: "#",
  properties: {
    identificadorServicio: "SRV-00123",
    cliente: "Acme Logistics",
    codigoCliente: "ACM-01",
    origen: "Santiago",
    destino: "Valparaíso",
    patenteCamion: "AB-CD-12",
    patenteRemolque: "EF-GH-34",
    fechaEstimadaArribo: "Fecha de arribo: 2026-09-23 14:00",
    fechaEstimadaSalida: "Fecha de salida: 2026-09-22 08:00",
    tipoServicio: "Standard",
    reason: "",
    rejectReason: "",
  },
};

/**
 * Floating dev-only button that fires the same ECM/Alfresco-style push
 * notification SseListener renders on a real "internalNotifications" SSE
 * event, using mock payload data — for visually testing that card without
 * needing a live event to arrive. Only rendered when ENABLE_DEV_TOOLS is on.
 */
export function NotificationDebugTrigger({ dictionary }: NotificationDebugTriggerProps) {
  const runtimeConfig = useRuntimeConfig();

  if (runtimeConfig?.ENABLE_DEV_TOOLS !== "true") {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Trigger sample notification"
      onClick={() =>
        CustomNotification(
          <div
            className=" flex w-full cursor-pointer flex-row items-center gap-2 rounded-md p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900"
            // See the matching comment in sse-listener.tsx: sonner's own
            // un-layered CSS beats Tailwind v4's @layer-utilities-wrapped
            // transition-colors/duration-300, so the transition has to be
            // set via inline style instead to actually take effect.
            style={{
              transitionProperty: "background-color",
              transitionDuration: "300ms",
              transitionTimingFunction: "ease",
            }}
          >
            <InitialIdentifier name={MOCK_PAYLOAD.creator.name} />
            <InnerData data={MOCK_PAYLOAD} dictionary={dictionary} />
          </div>,
        )
      }
      className="fixed right-4 bottom-20 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-white shadow-lg hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
    >
      <HiBellAlert className="h-6 w-6" />
    </button>
  );
}
