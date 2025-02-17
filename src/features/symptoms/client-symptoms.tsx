"use client";

import { useState } from "react";
import SymptomsCards from "./cards";
import SymptomsTable from "./table";

export default function ClientSymptoms({ dict }: { dict: any }) {
  const [showCards, setShowCards] = useState(true);

  return (
    <div className="flex flex-col">
      <SymptomsCards 
        showCards={showCards} 
        dict={dict} 
      />
      <SymptomsTable 
        setShowCards={setShowCards} 
        showCards={showCards} 
        dict={dict} 
      />
    </div>
  );
}
