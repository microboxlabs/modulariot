import React, { useEffect } from "react";
import { CiCircleCheck } from "react-icons/ci";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Checkbox, Label } from "flowbite-react";
import { BiLogoMicrosoftTeams } from "react-icons/bi";

export default function EndTreatment({
  dict,
  isTeamsNotificationOn,
  setIsTeamsNotificationOn,
}: {
  dict: I18nRecord;
  isTeamsNotificationOn: boolean;
  setIsTeamsNotificationOn: (isTeamsNotificationOn: boolean) => void;
}) {
  useEffect(() => {
    console.log("isTeamsNotificationOn changed to:", isTeamsNotificationOn);
  }, [isTeamsNotificationOn]);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    setIsTeamsNotificationOn(newValue);
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Main centered content */}
      <div className="flex-grow flex flex-col items-center justify-center gap-2">
        <CiCircleCheck className="h-32 w-32 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {(dict.symptoms as I18nRecord).end_treatment as string}
        </h1>
      </div>

      {/* Bottom checkbox */}
      <div className="flex justify-center items-center gap-2 mt-auto mb-2">
        <Checkbox
          id="teams-notification"
          value={isTeamsNotificationOn.toString()}
          onChange={handleCheckboxChange}
          className="h-4 w-4"
        />
        <Label
          htmlFor="teams-notification"
          className="flex flex-row items-center gap-1 cursor-pointer"
        >
          {(dict.symptoms as I18nRecord).end_treatment_notification as string}{" "}
          <BiLogoMicrosoftTeams className="w-6 h-6" />
          Teams
        </Label>
      </div>
    </div>
  );
}
