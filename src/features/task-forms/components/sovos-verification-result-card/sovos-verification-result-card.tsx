import { Button, Card } from "flowbite-react";
import successImage from "@assets/images/kanban/sign-ok.gif";
import errorImage from "@assets/images/kanban/sign-failed.gif";
import Image from "next/image";
import { SovosVerificationCardProps } from "../sovos-start-verification-card/sovos-start-verification-card.types";
import { useSession } from "next-auth/react";

export default function SovosVerificationResultCard({
  msg,
  success,
  stepperController,
  task,
}: SovosVerificationCardProps) {
  const { data: session } = useSession();

  let imageUrl;
  let title;
  let description;
  if (success) {
    imageUrl = successImage;
    title = msg?.successTitle as string;
    description = msg?.successDescription as string;
  } else {
    imageUrl = errorImage;
    title = msg?.errorTitle as string;
    description = msg?.errorDescription as string;
  }
  const step = stepperController.currentStep();
  let personName = "";
  if (step === "step2") {
    personName = `${msg!.driver as string} 1: ${task.properties.mintral_driver1Name as string}`;
  }
  if (step === "step4") {
    personName = `${msg!.driver as string} 2: ${task.properties.mintral_driver2Name as string}`;
  }
  if (step === "step6") {
    personName = `${msg!.validator as string}: ${session?.user.name ?? ""}`;
  }
  return (
    <Card>
      <div className="flex flex-col min-w-96 items-center justify-center w-96">
        <div className="h-40	w-40">
          <Image src={imageUrl} alt="Not Found" className="object-cover" />
        </div>
        <h5 className="text-xl font-medium tracking-tight text-gray-900 dark:text-white mt-9">
          {title}
        </h5>
        <div className="text-center text-gray-500 text-justified p-4">
          {description}
        </div>
        <div className="text-center text-gray-400 text-justified p-4">
          {personName}
        </div>
        {!success && (
          <Button
            color="blue"
            theme={{ inner: { base: "px-5 py-3" } }}
            className="w-full px-0 py-px"
            onClick={() => stepperController.toStep("step1")}
          >
            {msg?.tryAgain as string}
          </Button>
        )}
        {success && (
          <Button
            color="blue"
            theme={{ inner: { base: "px-5 py-3" } }}
            className="w-full px-0 py-px"
            onClick={() => stepperController.toNextStep()}
          >
            {stepperController.hasNextStep()
              ? (msg?.continue as string)
              : (msg?.finish as string)}
          </Button>
        )}
      </div>
    </Card>
  );
}
