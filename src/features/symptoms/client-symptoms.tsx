"use client";

import { useState } from "react";
import SymptomsCards from "./cards";
import SymptomsTable from "./table";

export default function ClientSymptoms({ dict }: { dict: any }) {
  const [showCards, setShowCards] = useState(true);

  return (
    <div
      className={`h-full flex flex-col overflow-y-auto ${showCards ? "gap-5" : ""}`}
    >
      <SymptomsCards showCards={showCards} dict={dict} />
      <SymptomsTable
        setShowCards={setShowCards}
        showCards={showCards}
        dict={dict}
      />
    </div>
  );
}
