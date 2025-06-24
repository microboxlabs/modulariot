"use client";

import { useState, useRef, useEffect } from "react";
import InfoCard from "./notification-types/info";

export default function NotificationCard({ data }: { data: any }) {
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
      return <InfoCard data={data} />;
    default:
      return (
        <div>
          Este mensaje no deberia ser visible, si lo ve, por favor, avise a
          soporte.
        </div>
      );
  }
}
