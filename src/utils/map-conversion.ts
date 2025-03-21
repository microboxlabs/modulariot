export function parseWKBPoint(wkbPoint: string): [number, number] {
  try {
    // Skip first 8 bytes (endian + type + srid) by starting from position 18
    const lonHex = wkbPoint.substring(18, 34);
    const latHex = wkbPoint.substring(34, 50);

    // Convert hex to float64
    const longitude = hexToDouble(lonHex);
    const latitude = hexToDouble(latHex);

    return [longitude, latitude];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error parsing WKB point:", error);
    return [-70.668505, -33.439764]; // Santiago, Chile
  }
}

export function hexToDouble(hex: string): number {
  // Reverse byte order for little-endian
  const bytes = hex.match(/../g)?.reverse().join("") || "";
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);

  for (let i = 0; i < 8; i++) {
    view.setUint8(i, parseInt(bytes.substring(i * 2, i * 2 + 2), 16));
  }

  return view.getFloat64(0, false); // false for big-endian
}
