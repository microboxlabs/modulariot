import { MapPosition } from "../types/map";

export class MapService {
  static async getPositions(): Promise<MapPosition[]> {
    const response = await fetch("/app/api/map");
    if (!response.ok) {
      throw new Error("Failed to fetch map positions");
    }
    const data = (await response.json()) as MapPosition[];

    return data.map((position) => {
      const [longitude, latitude] = this.parseWKBPoint(position.location);
      return {
        ...position,
        longitude,
        latitude,
      };
    });
  }

  private static parseWKBPoint(wkbPoint: string): [number, number] {
    try {
      // Skip first 8 bytes (endian + type + srid) by starting from position 18
      const lonHex = wkbPoint.substring(18, 34);
      const latHex = wkbPoint.substring(34, 50);

      // Convert hex to float64
      const longitude = this.hexToDouble(lonHex);
      const latitude = this.hexToDouble(latHex);

      return [longitude, latitude];
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error parsing WKB point:", error);
      return [-70.668505, -33.439764]; // Santiago, Chile
    }
  }

  private static hexToDouble(hex: string): number {
    // Reverse byte order for little-endian
    const bytes = hex.match(/../g)?.reverse().join("") || "";
    // Convert to binary buffer and read as float64
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);

    for (let i = 0; i < 8; i++) {
      view.setUint8(i, parseInt(bytes.substring(i * 2, i * 2 + 2), 16));
    }

    return view.getFloat64(0, false); // false for big-endian
  }
}
