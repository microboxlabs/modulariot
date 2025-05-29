"use client";

import { MapPosition } from "@/features/geographic-view/types/map";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Button } from "flowbite-react";
import { RiFileChartLine } from "react-icons/ri";

function convertJSONToCSV(
  jsonData: MapPosition[],
  columnHeaders: string[],
  dict: I18nRecord,
): string {
  // Check if JSON data is empty
  if (jsonData.length === 0) {
    return "";
  }

  // Create headers string
  const headers = columnHeaders.join(";") + "\n";

  // Map JSON data to CSV rows
  const rows = jsonData
    .map((row: any) => {
      const rowData = [...columnHeaders];

      if (row.symptom_condition) {
        row.symptom_condition =
          ((dict.symptoms as I18nRecord)[
            row.symptom_condition + ""
          ] as string) ?? row.symptom_condition;
      }
      if (row.speed_limit_condition) {
        row.speed_limit_condition =
          ((dict.symptoms as I18nRecord)[
            row.speed_limit_condition + ""
          ] as string) ?? row.speed_limit_condition;
      }

      // Replace latitude,longitude with Google Maps link
      if (row.latitude && row.longitude) {
        const mapsLink = `https://www.google.com/maps?q=${row.latitude},${row.longitude}`;
        // Remove latitude and longitude from array and replace with maps link
        rowData.splice(rowData.indexOf("latitude"), 2, "location");
        return rowData
          .map((field: string) => {
            if (field === "location") {
              return mapsLink;
            }
            return (row as unknown as Record<string, string>)[field] || "";
          })
          .join(";");
      }
      return rowData
        .map(
          (field: string) =>
            (row as unknown as Record<string, string>)[field] || "",
        )
        .join(";");
    })
    .join("\n");

  // Combine headers and rows
  return headers + rows;
}

const headers = [
  "trip_id",
  "asset_id",
  "carrier_name",
  "driver_name",
  "engine_status",
  "route",
  "speed",
  "heading",
  "timestamp",
  "estimated_arrival_time",
  "speed_limit_condition",
  "symptom_condition",
  "location",
];

export default function DownloadCSV({
  dict,
  mapPositions,
}: {
  dict: I18nRecord;
  mapPositions: MapPosition[];
}) {
  const csvData = convertJSONToCSV(mapPositions, headers, dict);

  return (
    <Button
      color="blue"
      className="flex align-middle justify-center"
      onClick={() => {
        const blob = new Blob([csvData], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Resumen_de_viajes.csv";
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <RiFileChartLine className="h-4 w-4 mr-2" />
      {(dict.symptoms as I18nRecord).csv_document as string}
    </Button>
  );
}
