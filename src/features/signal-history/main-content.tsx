import { I18nRecord } from "../i18n/i18n.service.types";
import GeographicVisualization from "./geographic-visualization";
import { useHistoricPulse } from "./hooks/use-historic-pulse";

export default function SignalsHistory({ dict }: { dict: I18nRecord }) {
  const urlParams = new URLSearchParams(window.location.search);
  const assetId = urlParams.get("license_plate") || "";
  const p_from = urlParams.get("start_date") || "";
  const p_to = urlParams.get("end_date") || "";

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
