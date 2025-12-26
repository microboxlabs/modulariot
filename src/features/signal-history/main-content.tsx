import { I18nRecord } from "../i18n/i18n.service.types";
import GeographicVisualization from "./geographic-visualization";
import { useHistoricPulse } from "./hooks/use-historic-pulse";
import { useSearchParams } from "next/navigation";

export default function SignalsHistory({ dict }: { dict: I18nRecord }) {
  const searchParams = useSearchParams();
  const assetId = searchParams.get("license_plate") || "";
  const p_from = searchParams.get("start_date") || "";
  const p_to = searchParams.get("end_date") || "";

  const {
    positions,
    error: pulseError,
    isLoading: pulseLoading,
  } = useHistoricPulse(assetId, p_from || "", p_to || "");

  return (
    <div className="flex flex-row gap-2 h-full overflow-hidden">
      <GeographicVisualization
        dict={dict}
        data={positions}
        isLoading={pulseLoading}
      />
    </div>
  );
}
