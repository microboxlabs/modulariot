"use client";
import { Button, Card } from "flowbite-react";
import { SovosVerificationCardProps } from "./sovos-start-verification-card.types";
import {
  fakeValidateRut,
  validateRut,
} from "@/features/sovos-fingerprint/services/autentia";
import SmartCardIcon from "@/features/icons/smartcard";
import FingerprintIcon from "@/features/icons/figerprint";
import { useEffect, useRef, useState } from "react";
import { PersonEntry } from "@alfresco/js-api";
import { ShowNotification } from "@/features/notifications/notification";
import {
  getUserStatus,
  requestSovosFingerprintReuse,
  useUserGroups,
} from "@/features/common/providers/client-api.provider";
import { GroupAllowed } from "@/features/common/components/group-allowed/group-allowed";
export default function SovosStartVerificationCard({
  // lang,
  task,
  msg,
  pluginReady,
  stepperController,
  user,
  setValidationError,
  setFingerprintReuse,
  isFingerprintReuseNeeded,
}: SovosVerificationCardProps) {
  const [isVerificationInProgress, setIsVerificationInProgress] =
    useState(false);
  const { data: userGroups } = useUserGroups();

  const [fingerprintLoading, setFingerprintLoading] = useState<boolean>(false);

  const hasRun = useRef(false);
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    if (!isFingerprintReuseNeeded) return;

    console.log(getRut());
    console.log(task.mintral_serviceCode);

    try {
      setFingerprintLoading(true);
      requestSovosFingerprintReuse(
        getRut(),
        task.mintral_serviceCode as string,
      ).then((result) => {
        console.log(result);
        console.log(result?.fingerprintReuse?.tripFound);

        if (result?.fingerprintReuse?.tripFound) {
          //TODO: show information completed
          stepperController.toNextStep(false, {
            Erc: 0,
            ercText: "Reutilización de huella",
            NroAudit: "0",
            Rut: getRut(),
          });
          setFingerprintReuse && setFingerprintReuse(true);
          setFingerprintLoading(false);
        }
      });
    } catch (error) {
      //console.log(error);
      //ignore error
      setFingerprintLoading(false);
    }
  }, []);

  async function startVerification() {
    await getUserStatus();
    const currentStep = stepperController.currentStep();

    if (!pluginReady) return;
    const validator =
      process.env.NEXT_PUBLIC_SIMULATE_AUTENTIA === "true"
        ? fakeValidateRut
        : validateRut;
    setIsVerificationInProgress(true);
    setValidationError(null);
    validator(getRut())
      .then((result) => {
        if (result) {
          stepperController.toNextStep(false, { ...result, Rut: getRut() });
        }
      })
      .catch((error: unknown) => {
        ShowNotification({
          type: "error",
          message: (error as Error).message,
        });

        const errorMessage =
          error instanceof Error
            ? error.message
            : "Error durante la validación del RUT";
        setValidationError(errorMessage);
        let nextStep;
        if (!currentStep.startsWith("step")) {
          nextStep = 2;
        } else {
          nextStep = parseInt(currentStep.replace("step", ""));
          nextStep += 1;
        }
        stepperController.toStep(`step${nextStep}`, true);
      })
      .finally(() => {
        setIsVerificationInProgress(false);
      });
  }

  function getRut(): string {
    const currentStep = stepperController.currentStep();
    if (currentStep === "step1") {
      return task.mintral_driver1Rut as string;
    }
    if (currentStep === "step3") {
      return task.mintral_driver2Rut as string;
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
        <div className="text-gray-700 dark:text-gray-200 text-center text-justified p-4">
          {msg!.description as string}
        </div>
        {hasRun.current && !isVerificationInProgress && !fingerprintLoading && (
          <GroupAllowed
            userGroups={userGroups}
            notAllowedTo={["GROUP_MINTRAL_REVISOR"]}
          >
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
          </GroupAllowed>
        )}
      </div>
    </Card>
  );
}
