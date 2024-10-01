"use client";
import { Button, Card } from "flowbite-react";
import { SovosVerificationCardProps } from "./sovos-start-verification-card.types";
import {
  fakeValidateRut,
  validateRut,
} from "@/features/sovos-fingerprint/services/autentia";
import SmartCardIcon from "@/features/icons/smartcard";
import FingerprintIcon from "@/features/icons/figerprint";
import { useState } from "react";
import { PersonEntry } from "@alfresco/js-api";

export default function SovosStartVerificationCard({
  // lang,
  task,
  msg,
  pluginReady,
  stepperController,
  user,
}: SovosVerificationCardProps) {
  const [isVerificationInProgress, setIsVerificationInProgress] =
    useState(false);
  function startVerification() {
    const currentStep = stepperController.currentStep();

    if (!pluginReady) return;
    const validator =
      process.env.NEXT_PUBLIC_SIMULATE_AUTENTIA === "true"
        ? fakeValidateRut
        : validateRut;
    setIsVerificationInProgress(true);
    validator(getRut())
      .then((result) => {
        if (result) {
          stepperController.toNextStep(false, { ...result, Rut: getRut() });
        }
      })
      .catch((_error) => {
        let nextStep;
        if (!currentStep.startsWith("step")) {
          nextStep = 2;
        } else {
          nextStep = parseInt(currentStep.replace("step", ""));
          nextStep += 1;
        }
        stepperController.toStep(`step${nextStep}`, true);
      });
  }

  function getRut(): string {
    const currentStep = stepperController.currentStep();
    if (currentStep === "step1") {
      return task.properties.mintral_driver1Rut as string;
    }
    if (currentStep === "step3") {
      return task.properties.mintral_driver2Rut as string;
    }
    const userObj = JSON.parse(user!) as PersonEntry;
    return userObj?.entry.jobTitle ?? "";
  }

  return (
    <Card>
      <div className="flex flex-col min-w-96 items-center justify-center w-96">
        <div className="h-40	w-40">
          {isVerificationInProgress ? (
            <FingerprintIcon state="in_progress" />
          ) : (
            <SmartCardIcon />
          )}
        </div>
        <h5 className="text-xl font-medium tracking-tight text-gray-900 dark:text-white mt-9">
          {msg!.title as string}
        </h5>
        <div className="text-gray-900">{msg!.subtitle as string}</div>
        <div className="text-center text-justified p-4">
          {msg!.description as string}
        </div>
        {!isVerificationInProgress && (
          <Button
            color={pluginReady ? "blue" : "gray"}
            theme={{ inner: { base: "px-5 py-3" } }}
            className="w-full px-0 py-px"
            isProcessing={!pluginReady}
            onClick={startVerification}
          >
            {pluginReady
              ? (msg?.startVerification as string)
              : (msg?.initiatingAutentia as string)}
          </Button>
        )}
      </div>
    </Card>
  );
}
