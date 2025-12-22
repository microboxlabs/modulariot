import { HistoricSignal } from "../types/historic-signal.type";

export function convertJSONToCSV(
  jsonData: HistoricSignal[],
  columnHeaders: string[]
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
            (row as unknown as Record<string, string>)[field] || ""
        )
        .join(";");
    })
    .join("\n");

  // Combine headers and rows
  return headers + rows;
}
