"use client";

import { useEffect, useState } from "react";
import Stepped from "./stepped-elements";
import Welcome from "./welcome";
import { I18nRecord } from "../i18n/i18n.service.types";
import { useSearchParams } from "next/navigation";

export default function Totem({ dict }: { dict: I18nRecord }) {
  const [currentOption, setCurrentOption] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const deviceId = searchParams.get("deviceId") ?? "unknown";
  const deviceLocation = searchParams.get("deviceLocation") ?? "unknown";
  const inicio = searchParams.get("inicio") ?? "unknown";
  const fingerprint = searchParams.get("fingerprint") ?? "unknown";

  useEffect(() => {
    if (inicio !== undefined && inicio !== null && inicio !== "unknown") {
      setCurrentOption(0);
    } else if (
      fingerprint !== undefined &&
      fingerprint !== null &&
      fingerprint !== "unknown"
    ) {
      setCurrentOption(1);
    }
  }, [inicio, fingerprint]);

  // Timer for inactivity - starts at step 1
  useEffect(() => {
    if (currentStep >= 1) {
      // Start 5-minute timer (300 seconds)
      setTimeRemaining(300);

      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            // Time's up - reload the page
            window.location.reload();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(interval);
      };
    } else {
      // Reset timer if we go back to earlier steps
      setTimeRemaining(null);
    }
  }, [currentStep]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

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
    <>
      {/* Inactivity Timer - Fixed to viewport top-left corner */}
      {timeRemaining !== null && (
        <div className="fixed top-4 left-4 bg-gray-800 dark:bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-mono">{formatTime(timeRemaining)}</span>
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-10 h-full">
        {currentOption < options.length && options[currentOption].interface}
      </div>
    </>
  );
}
