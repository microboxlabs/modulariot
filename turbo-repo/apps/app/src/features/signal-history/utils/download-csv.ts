import { HistoricSignal } from "../types/historic-signal.type";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { formatDateString } from "@/features/common/components/formatted-date/formatted-date";
import { convertJSONToCSV } from "./json-to-csv";
import { tr } from "@/features/i18n/tr.service";

export function handleDownloadCsv(
  selectedData: HistoricSignal[],
  dict: I18nRecord,
  dateRangeDisplayed: { startDate: string; endDate: string }
) {
  const fixed_data = selectedData.map((signal: HistoricSignal) => {
    return {
      assetid: signal.assetid,
      tripid: signal.tripid,
      timestamp: formatDateString(signal.timestamp),
      speed: signal.speed,
      distance: (signal.distance / 1000).toFixed(1),
      location: `https://www.google.com/maps?q=${signal.latitude},${signal.longitude}`,
      heading: 0,
      latitude: signal.latitude,
      longitude: signal.longitude,
    };
  });

  const csvData = convertJSONToCSV(
    fixed_data,
    ["timestamp", "tripid", "speed", "distance", "location", "assetid"],
    [
      tr("signal_historic.timestamp", dict),
      tr("signal_historic.tripid", dict),
      tr("signal_historic.speed", dict),
      tr("signal_historic.distance_between_signals", dict),
      tr("signal_historic.location", dict),
      tr("signal_historic.assetid", dict),
    ]
  );
  const blob = new Blob([csvData], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Historico de viajes ${selectedData[0].assetid} ${formatDateString(dateRangeDisplayed.startDate)} - ${formatDateString(dateRangeDisplayed.endDate)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
