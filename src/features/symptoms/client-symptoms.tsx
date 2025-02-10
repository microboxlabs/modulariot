"use client";

import { useState } from "react";
import SymptomsCards from "./cards";
import SymptomsTable from "./table";

export default function ClientSymptoms() {
  const [showCards, setShowCards] = useState(true);

  return (
    <div className="flex flex-col">
      <SymptomsCards showCards={showCards} />
      <SymptomsTable setShowCards={setShowCards} showCards={showCards} />
    </div>
  );
}
