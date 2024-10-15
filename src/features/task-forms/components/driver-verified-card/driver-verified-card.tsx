"use client";

import { Button, Card, Textarea, TextInput } from "flowbite-react";
import DriverUserIcon from "@/features/icons/driver-user";
import DriverContactInfo from "../driver-contact-info/driver-contact-info";
import { Driver } from "../driver-contact-info/driver-contact-info.type";
import DriverValidation from "../driver-validation-card/driver-validation-card";
import TripInformation from "../trip-information-card/trip-information";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useFormState } from "react-dom";
import { taskNextAction } from "../../services/client-form.service";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TaskNextActionState } from "../../services/form.service.types";
import { DriverVerifiedCardProps } from "./driver-verified-card.types";

export default function DriverVerifiedCard({
  lang,
  task,
  msg,
  entityInfo,
}: DriverVerifiedCardProps) {
  const [state, formAction] = useFormState<TaskNextActionState, FormData>(
    taskNextAction,
    {},
  );

  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.replace(
        `/${lang}/task/edit/${task.id.replace("activiti$", "")}?step=step3`,
      );
    }
  }, [state]);

  const driver1: Driver = {
    name: (task.properties.mintral_driver1Name as string) ?? "-",
    email: (task.properties.mintral_driver1Email as string) ?? "-",
    phone: (task.properties.mintral_driver1Phone as string) ?? "-",
    rut: (task.properties.mintral_driver1Rut as string) ?? "-",
    status: "verified",
    varName: "driver1",
  };
  let driver2: Driver | undefined;
  const driver2Name = task.properties.mintral_driver2Name as string;
  if (driver2Name && driver2Name.trim() !== "") {
    driver2 = {
      name: (task.properties.mintral_driver2Name as string) ?? "-",
      email: (task.properties.mintral_driver2Email as string) ?? "-",
      phone: (task.properties.mintral_driver2Phone as string) ?? "-",
      rut: (task.properties.mintral_driver2Rut as string) ?? "-",
      status: "verified",
      varName: "driver2",
    };
  }
  return (
    <Card className="gap-6 w-fit items-center justify-center">
      <div className="flex items-center justify-center">
        <DriverUserIcon />
      </div>
      <div className="h-px bg-gray-300 w-full"></div>
      <DriverContactInfo msg={msg!} driver={driver1} />
      {driver2 && (
        <>
          <div className="h-px bg-gray-300 w-full"></div>
          <DriverContactInfo msg={msg!} driver={driver2} />
        </>
      )}
      <div className="h-px bg-gray-300 w-full"></div>
      <DriverValidation msg={msg!} driver1={driver1} driver2={driver2} />

      <div className="h-px bg-gray-300 w-full"></div>
      <TripInformation
        msg={msg}
        task={task}
        lang={lang}
        entityInfo={entityInfo}
      />

      <div className="h-px bg-gray-300 w-full"></div>
      <form action={formAction}>
        <h5 className="text-sm font-medium leading-loose">
          {(msg!.cards as I18nRecord).comments as string}
        </h5>
        <div className="flex flex-col gap-6">
          <TextInput
            id="taskId"
            name="taskId"
            type="hidden"
            defaultValue={task.id}
          />
          <Textarea
            placeholder="Escribe aquí tus observaciones"
            defaultValue={task.properties.mintral_driverObservations as string}
            disabled={true}
          />
          <Button
            color="blue"
            type="submit"
            theme={{ inner: { base: "px-5 py-3" } }}
            className="w-full px-0 py-px"
          >
            {(msg!.buttons as I18nRecord).submit as string}
          </Button>
        </div>
      </form>
    </Card>
  );
}
