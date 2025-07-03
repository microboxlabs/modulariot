"use client";

import { useState, useRef, useEffect } from "react";
import InfoCard from "./notification-types/info";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function NotificationCard({
  data,
  dictionary,
}: {
  data: any;
  dictionary: I18nRecord;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showOptions) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (
        optionsRef.current &&
        !optionsRef.current.contains(target) &&
        !target.closest("[data-options-button]")
      ) {
        setShowOptions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showOptions]);

  switch (data.type.toUpperCase()) {
    case "INFO":
      return <InfoCard data={data} dictionary={dictionary} />;
    default:
      return (
        <div>
          Este mensaje no deberia ser visible, si lo ve, por favor, avise a
          soporte.
        </div>
      );
  }
}
