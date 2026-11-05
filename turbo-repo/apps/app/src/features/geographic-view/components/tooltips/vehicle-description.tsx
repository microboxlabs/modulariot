import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { field, useFleetAsset } from "@/features/fleet/fleet-api";
import { useMyAccess } from "@/features/settings-admin/team/team-api";

const VIEW = "fleet:assets.view";

/**
 * Model and year of the vehicle, from the fleet directory. Shows nothing when
 * the user can't view the fleet; a missing model reads "Sin modelo".
 */
export default function VehicleDescription({
  assetId,
  dict,
}: Readonly<{
  assetId: string;
  dict: I18nRecord;
}>) {
  const { can } = useMyAccess();
  const { data } = useFleetAsset(assetId, can(VIEW));
  if (!data) {
    return null;
  }

  const labels = dict.geographic_view as I18nRecord;
  const model = field(data, "brandModel")?.value;
  const year = field(data, "year")?.value;

  return (
    <>
      <div className="text-sm text-gray-600 dark:text-gray-300">
        {labels.vehicle_model as string}:{" "}
        {model ?? (labels.vehicle_no_model as string)}
      </div>
      {year && (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {labels.vehicle_year as string}: {year}
        </div>
      )}
    </>
  );
}
