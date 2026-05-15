import MapTooltip from "../geographic-view/components/map-tooltip";
import CustomTable from "../common/components/custom-table/custom-table";
import { Button } from "flowbite-react";
import { HistoricSignal } from "./types/historic-signal.type";
import { useEffect, useState, memo } from "react";
import { I18nRecord } from "../i18n/i18n.service.types";
import { tr } from "../i18n/tr.service";
import { FormattedDate } from "../common/components/formatted-date";
import { handleDownloadCsv } from "./utils/download-csv";
import PulseDetailView from "./pulse-detail-view";

const SummaryTooltip = memo(function SummaryTooltip({
  data,
  dateRangeDisplayed,
  dict,
  selectedPulse,
  onClearSelection,
}: {
  data: HistoricSignal[];
  dateRangeDisplayed: {
    startDate: string;
    endDate: string;
  };
  dict: I18nRecord;
  selectedPulse: HistoricSignal | null;
  onClearSelection: () => void;
}) {
  const [loadingTable, setLoadingTable] = useState<boolean>(true);
  const [selectedData, setSelectedData] = useState<HistoricSignal[]>([]);
  const [tableData, setTableData] = useState<(string | React.ReactElement)[][]>(
    []
  );
  const [distance, setDistance] = useState<number>(0);

  // Process filtered data and distance calculation in useEffect
  useEffect(() => {
    // Convert date range to timestamps once for efficient comparison
    const startTimestamp = new Date(dateRangeDisplayed.startDate).getTime();
    const endTimestamp = new Date(dateRangeDisplayed.endDate).getTime();

    // Single pass: filter and calculate distance simultaneously
    let totalDistance = 0;
    const selected_data = data.filter((signal) => {
      const signalTimestamp = new Date(signal.timestamp);
      // Apply timezone adjustment to match the pulse-range layer behavior
      const localSignalTimestamp = new Date(signalTimestamp.getTime());
      const isInRange =
        localSignalTimestamp.getTime() >= startTimestamp &&
        localSignalTimestamp.getTime() <= endTimestamp;

      // If signal is in range, add to distance calculation (convert meters to kilometers)
      if (isInRange && signal.distance > 0) {
        totalDistance += signal.distance / 1000;
      }

      return isInRange;
    });

    setSelectedData(selected_data);
    setDistance(totalDistance);
  }, [data, dateRangeDisplayed]);

  useEffect(() => {
    let cancelled = false;

    const processTableData = async () => {
      setLoadingTable(true);

      const chunkSize = 100;
      const table_elements: (string | React.ReactElement)[][] = [];

      for (let i = 0; i < selectedData.length; i += chunkSize) {
        if (cancelled) return; // Exit if this effect was cleaned up

        const chunk = selectedData.slice(i, i + chunkSize);

        await new Promise((resolve) => setTimeout(resolve, 0));

        if (cancelled) return;

        const chunkElements = chunk.map((element: HistoricSignal) => {
          const date = new Date(element.timestamp);
          return [
            <FormattedDate key={element.timestamp} date={date} />,
            String(
              element.tripid !== "null"
                ? element.tripid
                : tr("signal_historic.no_trip", dict)
            ),
            String(element.speed || 0) + " Km/h",
            String(((element.distance || 0) / 1000).toFixed(1)) + " Km",
            `https://www.google.com/maps?q=${element.latitude},${element.longitude}`,
            String(element.assetid || ""),
          ];
        });

        table_elements.push(...chunkElements);
      }

      if (!cancelled) {
        setTableData(table_elements);
        setLoadingTable(false);
      }
    };

    processTableData();

    return () => {
      cancelled = true;
    };
  }, [selectedData, dict]);

  const hasPulseSelected = selectedPulse !== null;

  return (
    <MapTooltip
      start_right={true}
      left={5}
      top={5}
      setHoverInfo={() => {
        // Info when opened
      }}
      onExitAction={onClearSelection}
      canExit={hasPulseSelected}
    >
      {hasPulseSelected ? (
        <PulseDetailView pulse={selectedPulse} dict={dict} />
      ) : (
        <div className="p-2 pt-0 flex flex-col whitespace-nowrap text-sm font-light text-gray-700 dark:text-gray-300 gap-2">
          <p>
            {tr("signal_historic.selected_signals", dict)}:{" "}
            <span className="text-gray-700 dark:text-gray-300 font-semibold">
              {tableData.length}
            </span>
          </p>
          <p>
            {tr("signal_historic.distance_traveled", dict)}:{" "}
            <span className="text-gray-700 dark:text-gray-300 font-semibold">
              {distance.toFixed(1)}km
            </span>
          </p>
          <div className="h-60 w-90 bg-gray-50 dark:bg-gray-700 shadow-md rounded-lg border border-gray-300 dark:border-gray-600 flex flex-col flex-grow overflow-y-auto">
            {loadingTable ? (
              <div className="bg-gray-500 animate-pulse"></div>
            ) : (
              <CustomTable
                header={[
                  tr("signal_historic.timestamp", dict),
                  tr("signal_historic.tripid", dict),
                  tr("signal_historic.speed", dict),
                  tr("signal_historic.distance_between_signals", dict),
                  tr("signal_historic.location", dict),
                  tr("signal_historic.assetid", dict),
                ]}
                content={tableData}
                hoverable={true}
              />
            )}
          </div>
          <Button
            onClick={() =>
              handleDownloadCsv(selectedData, dict, dateRangeDisplayed)
            }
            disabled={selectedData.length === 0}
          >
            {tr("signal_historic.download_csv", dict)}
          </Button>
        </div>
      )}
    </MapTooltip>
  );
});

export default SummaryTooltip;
