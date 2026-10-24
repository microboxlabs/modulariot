import { describe, expect, it } from "vitest";
import { signalsCsv } from "./download-csv";
import { HistoricSignal } from "../types/historic-signal.type";

const signal = (overrides: Partial<HistoricSignal>): HistoricSignal => ({
  assetid: "AB12",
  heading: 0,
  location: "",
  speed: 40,
  timestamp: "2026-10-22T10:00:00+00:00",
  tripid: "T1",
  distance: 1500,
  latitude: -33,
  longitude: -70,
  ...overrides,
});

describe("signalsCsv", () => {
  it("writes an empty trip cell and a zero distance when the signal has none", () => {
    const rows = signalsCsv(
      [
        signal({}),
        signal({
          tripid: undefined as unknown as string,
          distance: undefined as unknown as number,
        }),
        signal({ tripid: "null" }),
      ],
      {}
    )
      .split("\n")
      .slice(1)
      .map((row) => row.split(";"));

    expect(rows[0][1]).toBe("T1");
    expect(rows[0][3]).toBe("1.5");
    expect(rows[1][1]).toBe("");
    expect(rows[1][3]).toBe("0.0");
    expect(rows[2][1]).toBe("");
    expect(rows.flat().join(";")).not.toMatch(/undefined|NaN|null/);
  });
});
