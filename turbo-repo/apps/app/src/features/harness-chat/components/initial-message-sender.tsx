"use client";

import { useAui } from "@assistant-ui/react";
import { useEffect, useRef, type FC } from "react";

export const InitialMessageSender: FC<{ initialMessage: string | null }> = ({
  initialMessage,
}) => {
  const aui = useAui();
  const sentRef = useRef(false);

  useEffect(() => {
    if (!initialMessage || sentRef.current) return;
    sentRef.current = true;
    aui.composer.setText(initialMessage);
    aui.composer.send();
  }, [initialMessage, aui]);

  return null;
};
