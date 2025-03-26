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
      const rowData = [...columnHeaders];
      // Replace latitude,longitude with Google Maps link
      if (row.latitude && row.longitude) {
        const mapsLink = `https://www.google.com/maps?q=${row.latitude},${row.longitude}`;
        // Remove latitude and longitude from array and replace with maps link
        rowData.splice(rowData.indexOf('latitude'), 2, 'location');
        return rowData.map((field: any) => {
          if (field === 'location') {
            return mapsLink;
          }
          return row[field] || '';
        }).join(',');
      }
      return rowData.map((field: any) => row[field] || '').join(',');
    })
    .join('\n');

  // Combine headers and rows
  return headers + rows;
}

const headers = ["trip_id", "asset_id", "route", "speed", "heading", "timestamp", "location"];

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
      {((dict.symptoms as I18nRecord).csv_document as string)}
    </Button>
  );
}
