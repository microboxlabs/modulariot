import MapTooltip from "../geographic-view/components/map-tooltip";
import CustomTable from "../common/components/custom-table/custom-table";
import { Button } from "flowbite-react";
import { HistoricSignal } from "./types/historic-signal.type";
import { useEffect, useState, useMemo, useCallback, memo } from "react";
import LoadableLabel from "../common/components/loadable-label/loadable-label";
import { convertJSONToCSV } from "./utils/json-to-csv";
import { I18nRecord } from "../i18n/i18n.service.types";
import { tr } from "../i18n/tr.service";

export type HistoricSignalCsv = {
  assetid: string;
  heading: number;
  location: string;
  speed: number;
  timestamp: string;
  tripid: string;
  distance: number;
  has_symptoms: boolean;
  latitude: number;
  longitude: number;
};

const SummaryTooltip = memo(function SummaryTooltip({
  data,
  dateRangeDisplayed,
  dict,
}: {
  data: HistoricSignal[];
  dateRangeDisplayed: {
    startDate: string;
    endDate: string;
  };
  dict: I18nRecord;
}) {
  const [loadingTable, setLoadingTable] = useState<boolean>(true);
  const [selectedData, setSelectedData] = useState<HistoricSignal[]>([]);
  const [tableData, setTableData] = useState<string[][]>([]);
  const [distance, setDistance] = useState<number>(0);

  // Process filtered data and distance calculation in useEffect
  useEffect(() => {
    // Convert date range to timestamps once for efficient comparison
    const startTimestamp = new Date(dateRangeDisplayed.startDate).getTime();
    const endTimestamp = new Date(dateRangeDisplayed.endDate).getTime();

    // Single pass: filter and calculate distance simultaneously
    let totalDistance = 0;
    const selected_data = data.filter((signal) => {
      const signalTimestamp = new Date(signal.timestamp).getTime();
      const isInRange =
        signalTimestamp >= startTimestamp && signalTimestamp <= endTimestamp;

      // If signal is in range, add to distance calculation (convert meters to kilometers)
      if (isInRange && signal.distance > 0) {
        totalDistance += signal.distance / 1000;
      }

      return isInRange;
    });

    setSelectedData(selected_data);
    setDistance(totalDistance);
  }, [data, dateRangeDisplayed]);

  // Non-blocking table data processing
  const processTableData = useCallback(async (data: HistoricSignal[]) => {
    setLoadingTable(true);

    // Process data in chunks to avoid blocking the UI
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }

    const table_elements: string[][] = [];

    for (const chunk of chunks) {
      // Process each chunk asynchronously
      await new Promise((resolve) => {
        setTimeout(() => {
          const chunkElements = chunk.map((element: HistoricSignal) => {
            // Format timestamp to DD/MM/YYYY HH:MM and handle timezone
            const date = new Date(element.timestamp);
            const adjustedDate = new Date(
              date.getTime() + date.getTimezoneOffset() * 60000
            );
            const formattedTimestamp =
              adjustedDate.toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }) +
              " " +
              adjustedDate.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });

            return [
              String(element.assetid),
              String(element.tripid),
              formattedTimestamp,
              String(element.speed),
              `https://www.google.com/maps?q=${element.latitude},${element.longitude}`,
            ];
          });

          table_elements.push(...chunkElements);
          resolve(void 0);
        }, 0); // setTimeout with 0ms allows the browser to process other tasks
      });
    }

    setTableData(table_elements);
    setLoadingTable(false);
  }, []);

  useEffect(() => {
    processTableData(selectedData);
  }, [selectedData, processTableData]);

  function handleDownload() {
    const csvData = convertJSONToCSV(selectedData, [
      tr("signal_historic.assetid", dict),
      tr("signal_historic.tripid", dict),
      tr("signal_historic.timestamp", dict),
      tr("signal_historic.speed", dict),
      tr("signal_historic.location", dict),
    ]);
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Historico de viajes ${data[0].assetid} ${dateRangeDisplayed.startDate} - ${dateRangeDisplayed.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <MapTooltip
      start_right={true}
      left={5}
      top={5}
      setHoverInfo={() => {
        // Info when oppened
      }}
      onExitAction={() => {
        // This should do something
      }}
    >
      <div className="p-2 pt-0 flex flex-col whitespace-nowrap text-sm font-light text-gray-700 gap-2">
        <p>
          {tr("signal_historic.distance_traveled", dict)}:{" "}
          <span className="text-gray-700 font-semibold">
            {distance.toFixed(1)}km
          </span>
        </p>
        <div className="h-60 w-90 bg-gray-50 dark:bg-gray-700 shadow-md rounded-lg border border-gray-300 dark:border-gray-600 flex flex-col flex-grow overflow-y-auto">
          {loadingTable ? (
            <div className="bg-gray-500 animate-pulse"></div>
          ) : (
            <CustomTable
              header={[
                tr("signal_historic.assetid", dict),
                tr("signal_historic.tripid", dict),
                tr("signal_historic.timestamp", dict),
                tr("signal_historic.speed", dict),
                tr("signal_historic.location", dict),
              ]}
              content={tableData}
              hoverable={true}
            />
          )}
        </div>
        <Button onClick={handleDownload} disabled={selectedData.length === 0}>
          {tr("signal_historic.download_csv", dict)}
        </Button>
      </div>
    </MapTooltip>
  );
});

export default SummaryTooltip;
