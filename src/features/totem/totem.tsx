"use client";

import { useState } from "react";
import Stepped from "./stepped-elements";
import Welcome from "./welcome";
import { I18nRecord } from "../i18n/i18n.service.types";

export default function Totem({ dict }: { dict: I18nRecord }) {
  const [currentOption, setCurrentOption] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const options = [
    {
      interface: (
        <Welcome
          setCurrentOption={setCurrentOption}
          currentOption={currentOption}
          dict={dict}
        />
      ),
    },
    {
      interface: (
        <Stepped
          setCurrentStep={setCurrentStep}
          currentStep={currentStep}
          dict={dict}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center w-screen h-screen gap-10">
      {currentOption < options.length && options[currentOption].interface}
    </div>
  );
}
