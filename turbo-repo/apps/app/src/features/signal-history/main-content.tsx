import { I18nRecord } from "../i18n/i18n.service.types";
import GeographicVisualization from "./geographic-visualization";
import { useHistoricPulse } from "./hooks/use-historic-pulse";
import { useSearchParams } from "next/navigation";
import { tr } from "../i18n/tr.service";

export default function SignalsHistory({
  dict,
  p_from,
  p_to,
}: {
  dict: I18nRecord;
  p_from: string;
  p_to: string;
}) {
  const searchParams = useSearchParams();
  const assetId = searchParams.get("license_plate") || "";

  const {
    positions,
    error: pulseError,
    isLoading: pulseLoading,
  } = useHistoricPulse(assetId, p_from, p_to);

  let emptyMessage: string | undefined;
  if (!pulseLoading && positions.length === 0) {
    emptyMessage = pulseError
      ? tr("signal_historic.signals_load_failed", dict)
      : tr("signal_historic.no_signals_in_range", dict);
  }

  return (
    <div className="flex flex-row gap-2 h-full overflow-hidden">
      <GeographicVisualization
        dict={dict}
        data={positions}
        isLoading={pulseLoading}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
