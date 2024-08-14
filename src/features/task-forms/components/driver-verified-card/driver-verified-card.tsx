import { Card, Textarea } from "flowbite-react";
import { TaskFormProps } from "../task-form/task-form.types";
import DriverUserIcon from "@/features/icons/driver-user";
import DriverContactInfo from "../driver-contact-info/driver-contact-info";
import { Driver } from "../driver-contact-info/driver-contact-info.type";
import DriverValidation from "../driver-validation-card/driver-validation-card";
import TripInformation from "../trip-information/trip-information";

export default function DriverVerifiedCard({ lang, task, msg }: TaskFormProps) {
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
      <TripInformation msg={msg} task={task} lang={lang} />

      <div className="h-px bg-gray-300 w-full"></div>
      <Textarea
        placeholder="Escribe aquí tus observaciones"
        defaultValue={task.properties.mintral_driverObservations as string}
        disabled={true}
      />
    </Card>
  );
}
