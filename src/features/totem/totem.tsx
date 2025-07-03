"use client";

import { useState, useEffect } from "react";
import Stepped from "./stepped-elements";
import Welcome from "./welcome";
import { I18nRecord } from "../i18n/i18n.service.types";
import { useSearchParams } from "next/navigation";

export default function Totem({ dict }: { dict: I18nRecord }) {
  const [currentOption, setCurrentOption] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("deviceId") ?? "unknown";
  const deviceLocation = searchParams.get("deviceLocation") ?? "unknown";

  useEffect(() => {
    if (deviceId && deviceLocation) {
      console.log("Device ID:", deviceId);
      console.log("Device Location:", deviceLocation);
    }
  }, [deviceId, deviceLocation]);

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
          deviceId={deviceId}
          deviceLocation={deviceLocation}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-10 h-full">
      {currentOption < options.length && options[currentOption].interface}
    </div>
  );
}
