"use client";

import { useState } from "react";
import SymptomsCards from "./cards";
import SymptomsTable from "./table";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

export default function ClientSymptoms({ dict }: { dict: I18nRecord }) {
  const [showCards, setShowCards] = useState(true);

  return (
    <div className="h-full flex flex-col overflow-visible w-full gap-2">
      <SymptomsCards showCards={showCards} dict={dict} />
      <SymptomsTable
        setShowCards={setShowCards}
        showCards={showCards}
        dict={dict}
      />
    </div>
  );
}
