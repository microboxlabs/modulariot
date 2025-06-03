"use client";

import Stepped from "@/features/totem/stepped-elements";
import Welcome from "@/features/totem/welcome";
import { useState } from "react";



export default function TotemPage() {
  const [currentOption, setCurrentOption] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const options = [
    {
      interface: <Welcome setCurrentOption={setCurrentOption} currentOption={currentOption} />,
    },
    {
      interface: <Stepped setCurrentStep={setCurrentStep} currentStep={currentStep} />,
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center w-screen h-screen gap-10">
      {
        currentOption < options.length && options[currentOption].interface
      }
    </div>
  );
}
