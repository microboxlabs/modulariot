"use client";

import { useEffect } from "react";

let isLoadedEventSource = false;
export default function SseListener() {
  useEffect(() => {
    if (isLoadedEventSource) return;
    const eventSource = new EventSource(
      `${process.env.NEXT_PUBLIC_ECM_API_URL}/api/v1/events/stream`,
    );
    isLoadedEventSource = true;
    eventSource.onmessage = (event) => {
      console.log(event.data);
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
  }, []);
  return null;
}
