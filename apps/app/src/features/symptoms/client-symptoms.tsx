"use client";

import { useState } from "react";
import SymptomsCards from "./cards";
import SymptomsTable from "./table";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function ClientSymptoms({ dict }: { dict: I18nRecord }) {
  const [showCards, setShowCards] = useState(true);
  const [_newConditionFiltering, setNewConditionFiltering] = useState<
    string | null
  >(null);

  function handle_clean() {
    localStorage.removeItem("symptoms");
    setNewConditionFiltering(null);
    globalThis.location.reload();
  }

  return (
    <div className="h-full flex flex-col overflow-visible w-full gap-0 max-w-screen-2xl mx-auto">
      <SymptomsCards
        showCards={showCards}
        dict={dict}
        settingsFunction={handle_clean}
      />
      <SymptomsTable
        setShowCards={setShowCards}
        showCards={showCards}
        dict={dict}
      />
    </div>
  );
}
