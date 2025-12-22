export function convertJSONToCSV(
  jsonData: any[],
  columnKeys: string[],
  columnHeaders?: string[]
): string {
  // Check if JSON data is empty
  if (jsonData.length === 0) {
    return "";
  }

  // Use provided headers or fallback to keys
  const headers = (columnHeaders || columnKeys).join(";") + "\n";

  // Map JSON data to CSV rows
  const rows = jsonData
    .map((row: any) => {
      // Use column keys to extract data in the specified order
      return columnKeys
        .map((key: string) => {
          // Special handling for location (latitude,longitude)
          if (key === "location" && row.latitude && row.longitude) {
            return `https://www.google.com/maps?q=${row.latitude},${row.longitude}`;
          }
          return (row as unknown as Record<string, string>)[key] || "";
        })
        .join(";");
    })
    .join("\n");

  // Combine headers and rows
  return headers + rows;
}
