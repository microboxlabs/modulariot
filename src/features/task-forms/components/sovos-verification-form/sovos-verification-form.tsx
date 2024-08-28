/* eslint-disable @next/next/no-sync-scripts */
"use client";
import StepperNavigation from "@/features/layout/components/stepper-navigation/stepper-navigation";
import { TaskFormProps } from "../task-form/task-form.types";
import { useSearchParams } from "next/navigation";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import SovosStartVerificationCard from "../sovos-start-verification-card/sovos-start-verification-card";
import Script from "next/script";
import { useState } from "react";
// import { useSession } from "next-auth/react";
declare global {
  interface Window { plgAutentiaJS: any; }
}
export default function SovosVerificationForm({
  msg,
  task,
  lang,
}: TaskFormProps) {
  // const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [pluginReady, setPluginReady] = useState(false);
  let steps = ["step1", "step2"];
  if (task.properties.mintral_driver2Name) {
    steps.push("step3", "step4");
  }
  steps.push("step5", "step6");

  
  const currentStep = searchParams.get("step") ?? steps[0];
  return (
    <div className="flex-1 flex flex-col items-center gap-6">
      <StepperNavigation
        msg={msg!.stepper as I18nRecord}
        currentStep={currentStep}
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

      {(currentStep === "step1" || currentStep=== "step3" || currentStep === "step5") && (
        <SovosStartVerificationCard lang={lang} msg={msg} task={task} pluginReady={pluginReady} />
      )}
      <Script type="text/javascript" src="/app/autentia/jquery-2.1.4.min.js"></Script>
    <Script type="text/javascript" src="/app/autentia/json2.js"></Script>
    <Script type="text/javascript" src="/app/autentia/blockui.js"></Script>
    <Script type="text/javascript" src="/app/autentia/jsbn.js"></Script>
    <Script type="text/javascript" src="/app/autentia/jsbn2.js"></Script>
    <Script type="text/javascript" src="/app/autentia/rsa.js"></Script>
    <Script type="text/javascript" src="/app/autentia/rsa2.js"></Script>
      <Script
        type="text/javascript"
        src="/app/autentia/base64.js"
       
      ></Script>
      <Script
        type="text/javascript"
        src="/app/autentia/crypto-1.1.min.js"
       
      ></Script>

      <Script src="/app/autentia/yahoo-min.js"></Script>
      <Script src="/app/autentia/core.js"></Script>
      <Script src="/app/autentia/md5.js"></Script>
      <Script src="/app/autentia/sha1.js"></Script>
      <Script src="/app/autentia/sha256.js"></Script>
      <Script src="/app/autentia/ripemd160.js"></Script>
      <Script src="/app/autentia/x64-core.js"></Script>
      <Script src="/app/autentia/sha512.js"></Script>

      <Script
        type="text/javascript"
        src="/app/autentia/rsapem-1.1.min.js"
       
      ></Script>
      <Script
        type="text/javascript"
        src="/app/autentia/rsasign-1.2.min.js"
       
      ></Script>
      <Script
        type="text/javascript"
        src="/app/autentia/asn1hex-1.1.min.js"
       
      ></Script>
      <Script
        type="text/javascript"
        src="/app/autentia/x509-1.1.min.js"
       
      ></Script>
      <Script
        type="text/javascript"
        src="/app/autentia/pluginautentiav3.js"
        onReady={() => {
          setPluginReady(true);
        }}></Script>
    </div>
  );
}
