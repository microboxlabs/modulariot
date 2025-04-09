import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { DriverVerifiedCardProps } from "../driver-verified-card/driver-verified-card.types";
import { Checkbox, Label } from "flowbite-react";
import { TYPE_WFSHIP_MISSION_CONTROL_TRIP_INIT_TASK } from "../../services/form.service";
// import { TYPE_WFSHIP_MISSION_CONTROL_TRIP_INIT_TASK } from "../../services/form.service";

type TripManifestParamsProps = DriverVerifiedCardProps & {
  nativeGenerationEnabled: boolean;
  onNativeGenerationChange: (nativeGenerationEnabled: boolean) => void;
};

export function TripManifestParams({
  msg,
  task,
  nativeGenerationEnabled,
  onNativeGenerationChange,
}: TripManifestParamsProps) {
  if (task.taskFormKey !== TYPE_WFSHIP_MISSION_CONTROL_TRIP_INIT_TASK) {
    return null;
  }

  return (
    <>
      <div className="h-px bg-gray-300 w-full"></div>
      <h5 className="text-sm font-medium leading-loose dark:text-white text-gray-900">
        {(msg!.cards as I18nRecord).tripManifestParams as string}
      </h5>
      <div className="flex items-center gap-2">
        <Checkbox
          id="nativeGenerationEnabled"
          name="nativeGenerationEnabled"
          checked={nativeGenerationEnabled}
          onChange={(e) => onNativeGenerationChange(e.target.checked)}
        />
        <Label
          htmlFor="tripManifestParams"
          className="text-gray-400 text-sm font-normal"
        >
          {(msg!.cards as I18nRecord).nativeGenerationEnabled as string}
        </Label>
      </div>
    </>
  );
}
