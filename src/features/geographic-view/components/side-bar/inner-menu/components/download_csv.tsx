"use client";

import { useMapPositions } from "@/features/common/providers/client-api.provider";
import { MapPosition } from "@/features/geographic-view/types/map";
import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { Button } from "flowbite-react";
import { RiFileChartLine } from "react-icons/ri";

function convertJSONToCSV(jsonData: any, columnHeaders: any) {
  // Check if JSON data is empty
  if (jsonData.length === 0) {
    return '';
  }

  // Create headers string
  const headers = columnHeaders.join(',') + '\n';

  // Map JSON data to CSV rows
  const rows = jsonData
    .map((row: any) => {
      // Map each row to CSV format
      return columnHeaders.map((field: any) => row[field] || '').join(',');
    })
    .join('\n');

  // Combine headers and rows
  return headers + rows;
}

const headers = ["trip_id", "asset_id", "route", "speed", "heading", "latitude", "longitude", "timestamp"];

export default function DownloadCSV({ dict, mapPositions }: { dict: I18nRecord, mapPositions: MapPosition[] }) {

  const csvData = convertJSONToCSV(mapPositions, headers);

  return (
    <Button
      color="blue"
      className="flex align-middle justify-center"
      onClick={() => {
        const blob = new Blob([csvData], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'map_positions.csv';
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <RiFileChartLine className="h-4 w-4 mr-2" />
      {((dict.symptoms as I18nRecord).svg_document as string)}
    </Button>
  );
}
