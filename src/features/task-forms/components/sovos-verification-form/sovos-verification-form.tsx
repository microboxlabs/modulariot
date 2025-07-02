/* eslint-disable prettier/prettier */
/* eslint-disable @next/next/no-sync-scripts */
"use client";
import StepperNavigation from "@/features/layout/components/stepper-navigation/stepper-navigation";
import { TaskFormProps } from "../task-form/task-form.types";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import SovosStartVerificationCard from "../sovos-start-verification-card/sovos-start-verification-card";
import { useState } from "react";
import SovosVerificationResultCard from "../sovos-verification-result-card/sovos-verification-result-card";
import { StepperController } from "@/features/layout/components/stepper-navigation/stepper-navigation.types";
import { taskNextAction, taskSignDocument, taskSignIdCardDocument } from "../../services/client-form.service";
import SovosDeps from "../sovos-deps/sovos-deps";
import { useRouter } from "next/navigation";
import { AutentiaParamsGet } from "@/features/sovos-fingerprint/services/autentia.types";
import { TaskOutcome } from "../../services/form.service.types";
// import { useSession } from "next-auth/react";

export default function SovosVerificationForm({
  msg,
  task,
  lang,
  user,
  userGroups,
}: TaskFormProps) {
  // const { data: session } = useSession();
  const [pluginReady, setPluginReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audits, setAudits] = useState<AutentiaParamsGet[]>([]);
  const router = useRouter();
  const [stepper, setStepper] = useState({
    currentStep: "step1",
    isError: false,
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fingerprintReuse, setFingerprintReuse] = useState<boolean>(false);
  
  const handleSignDocument = async () => {
    setLoading(true);    
    console.log(audits);
    //let pos = 0;
    let results = [];
    for (const audit of audits) {
      const formData = new FormData();
      const signerRuts = audit.Rut ? audit.Rut : "";         
      
      
      /* if(pos != 0){
        formData.append("documentCode", results[pos-1]?.result?.code ?? "");
      } */
      if (audit.SerialNumber) {
        formData.append("taskId", task.id);
        formData.append("transitionId", "Viaje Iniciado");
        formData.append("bpmPackage", task.bpm_package as string);
        formData.append("serviceCode", task.mintral_serviceCode as string);      
        formData.append("signerRuts", signerRuts);
        formData.append("taskType", "sovosVerification");
        formData.append("serialNumbers", audit.SerialNumber);
        const result = await taskSignIdCardDocument({}, formData);
        if (result.success)  {
          results.push(result);
        }else{
          setStepper({
            ...stepper,
            isError: true,
          });
          return;
        }
      }else if (audit.NroAudit) {
        formData.append("taskId", task.id);
        formData.append("transitionId", "Viaje Iniciado");
        formData.append("bpmPackage", task.bpm_package as string);
        formData.append("serviceCode", task.mintral_serviceCode as string);      
        formData.append("signerRuts", audit.Rut);
        formData.append("taskType", "sovosVerification");
        formData.append("auditNumbers", audit.NroAudit);        
        const result = await taskSignDocument({}, formData);
        if (result.success)  {
          results.push(result);
        }else{
          setStepper({
            ...stepper,
            isError: true,
          });
          return;
        }
      }
      //pos++;
    }

    const formData = new FormData();
    formData.append("taskId", task.id);
    formData.append("transitionId", "Viaje Iniciado");
    formData.append("comments", "Firma de documentos");
    //formData.append("nativeGenerationEnabled", "true");
    //formData.append("reason", "Firma de documentos");
    //formData.append("reasonId", "sovosVerification");

    const response = await taskNextAction({}, formData);
      if (response.success)  {
        router.push(`/${lang}/shipping`);
      } else {
        setStepper({
          ...stepper,
          isError: true,
        });
      }
    /* const result = await taskSignDocument({}, formData);

    if (result.success) {
      router.push(`/${lang}/shipping`);
    } else {
      setStepper({
        ...stepper,
        isError: true,
      });
    } */
    setLoading(false);
    //TODO: toast check for some errors
  };

  const stepperController: StepperController = {
    isLoading: () => {
      return loading;
    },
    currentStep: () => {
      return stepper.currentStep;
    },
    toStep: (step: string, isError: boolean = false) => {
      return setStepper({
        ...stepper,
        currentStep: step,
        isError,
      });
    },
    toNextStep: (isError: boolean = false, audit?: AutentiaParamsGet) => {

      if (audit) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        setAudits([...audits, audit]);
      }

      if (stepper.currentStep === steps[steps.length - 1]) {
        handleSignDocument();
        return;
      }

      let nextStep = parseInt(stepper.currentStep.replace("step", ""));
      // if (steps.length === 4 && nextStep === 2) {
      //   nextStep = 5;
      // } else {
        nextStep += 1;
      // }
      return setStepper({
        ...stepper,
        currentStep: `step${nextStep}`,
        isError,
      });
    },
    toPrevStep: (isError: boolean = false) => {
      let prevStep = parseInt(stepper.currentStep.replace("step", ""));
      prevStep -= 1;
      return setStepper({
        ...stepper,
        currentStep: `step${prevStep}`,
        isError,
      });
    },
    hasNextStep: () => {
      return (
        parseInt(stepper.currentStep.replace("step", "")) < steps.length - 1
      );
    },
    toStepOutcome: (_outcome: TaskOutcome) => {
      // stepperController.toStep("step1");
    },
  };

  let steps = ["step1", "step2"];
  if (task.mintral_driver2Rut) {
    steps.push("step3", "step4");
  }
  /*steps.push("step5", "step6"); */ //remove despachador verification

  return (
    <div className="flex-1 flex flex-col items-center gap-6">
      <StepperNavigation
        msg={msg!.stepper as I18nRecord}
        currentStep={stepper.currentStep}
        isError={stepper.isError}
        routePaths={steps}
        trParams={{
          step2: {
            stepVal: `${msg!.driver as string} 1`,
          },
          step4: {
            stepVal: `${msg!.driver as string} 2`,
          },
          step6: {
            stepVal: `${msg!.validator as string}`,
          },
        }}
      />

      {(stepper.currentStep === "step1" ||
        stepper.currentStep === "step3" ||
        stepper.currentStep === "step5") && (
          <SovosStartVerificationCard
          lang={lang}
          msg={msg}
          task={task}
          user={user}
          userGroups={userGroups}
          pluginReady={pluginReady}
          stepperController={stepperController}
          isSovosVerification={true}
          validationError={validationError}
          setValidationError={setValidationError}
          isFingerprintReuseNeeded={true}
          fingerprintReuse={fingerprintReuse}
          setFingerprintReuse={setFingerprintReuse}
          />
        )}
      {(stepper.currentStep === "step2" ||
        stepper.currentStep === "step4" ||
        stepper.currentStep === "step6") && (
          <SovosVerificationResultCard
            lang={lang}
            msg={msg}
            task={task}
            pluginReady={pluginReady}
            stepperController={stepperController}
            success={!stepper.isError}
            isSovosVerification={true}
            user={user}
            userGroups={userGroups}
            validationError={validationError}
            setValidationError={setValidationError}
            isFingerprintReuseNeeded={true}
            fingerprintReuse={fingerprintReuse}
            setFingerprintReuse={setFingerprintReuse}
          />
        )}
      <SovosDeps onReady={() => setPluginReady(true)} />
    </div>
  );
}
