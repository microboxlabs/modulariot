import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const editor = vi.hoisted(() => ({ insertIntoFocused: vi.fn() }));
vi.mock("./cel-editor", () => editor);

import type { Preview } from "./maintainer-api";
import SampleTree, { sampleLabel, useSourceSamples } from "./sample-tree";

const d = {
  insertField: "Insertar {path}",
  sampleOf: "Muestra {n} de {total}",
  previousSample: "Anterior",
  nextSample: "Siguiente",
};

const SAMPLES = [
  {
    signal: {
      vehicle: { plate: "AB1234", weight_kg: 28400 },
      trip: { active: true, route: "Ruta 5" },
      zone: null,
    },
  },
  { signal: { trip: { active: false } } },
];

describe("sampleLabel", () => {
  it("reads plate, route and time when the sample has them", () => {
    const label = sampleLabel({
      signal: {
        received_at: "2026-09-29T21:31:04-03:00",
        vehicle: { plate: "AB1234" },
        trip: { route: "Ruta 5" },
      },
    });
    expect(label).toMatch(/^AB1234 · Ruta 5 · \d{1,2}:\d{2}/);
    expect(sampleLabel({ signal: { received_at: "no es fecha" } })).toBeNull();
    expect(sampleLabel({ signal: { trip: { active: true } } })).toBeNull();
  });
});

describe("SampleTree", () => {
  beforeEach(() => editor.insertIntoFocused.mockReset());

  it("inserts a field's path on click and offers it to drag", () => {
    render(
      <SampleTree
        samples={SAMPLES}
        index={0}
        readOnly={false}
        d={d}
        onIndex={vi.fn()}
      />
    );
    const leaf = screen.getByLabelText("Insertar signal.vehicle.weight_kg");
    expect(leaf.textContent).toBe("weight_kg : 28400");
    fireEvent.click(leaf);
    expect(editor.insertIntoFocused).toHaveBeenCalledWith(
      "signal.vehicle.weight_kg"
    );
    const setData = vi.fn();
    fireEvent.dragStart(leaf, { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      "signal.vehicle.weight_kg"
    );
    expect(screen.getByLabelText("Insertar signal.zone").textContent).toBe(
      "zone : null"
    );
    expect(screen.getByText("AB1234 · Ruta 5")).toBeTruthy();
  });

  it("folds a branch and changes sample", () => {
    const onIndex = vi.fn();
    render(
      <SampleTree
        samples={SAMPLES}
        index={0}
        readOnly={false}
        d={d}
        onIndex={onIndex}
      />
    );
    const vehicle = screen.getByRole("button", { name: "vehicle" });
    expect(vehicle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(vehicle);
    expect(vehicle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Insertar signal.vehicle.plate")).toBeNull();
    expect(
      (screen.getByLabelText("Anterior") as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Siguiente"));
    expect(onIndex).toHaveBeenCalledWith(1);
  });

  it("shows the sample without insert buttons for readers, and its number when it has no label", () => {
    render(
      <SampleTree
        samples={SAMPLES}
        index={1}
        readOnly
        d={d}
        onIndex={vi.fn()}
      />
    );
    expect(screen.queryAllByLabelText(/^Insertar/)).toHaveLength(0);
    expect(
      screen.getAllByText(
        (_, el) => el?.tagName === "DIV" && el.textContent === "active : false"
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Muestra 2 de 2")).toBeTruthy();
    expect(
      (screen.getByLabelText("Siguiente") as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("tags the fields the engine cannot read yet", () => {
    render(
      <SampleTree
        samples={SAMPLES}
        index={0}
        notInEngine={new Set(["signal.vehicle.weight_kg"])}
        readOnly={false}
        d={{ ...d, engineNotYetTag: "motor: aún no" }}
        onIndex={vi.fn()}
      />
    );
    expect(
      screen.getByLabelText("Insertar signal.vehicle.weight_kg").textContent
    ).toBe("weight_kg : 28400motor: aún no");
    expect(screen.getAllByText("motor: aún no")).toHaveLength(1);
  });

  it("renders nothing without samples", () => {
    const { container } = render(
      <SampleTree
        samples={[]}
        index={0}
        readOnly={false}
        d={d}
        onIndex={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("useSourceSamples", () => {
  const preview = (source: string, n: number): Preview => ({
    source,
    samples: [
      {
        sample: { n },
        activates: true,
        measure: null,
        level: null,
        error: null,
      },
    ],
  });

  it("keeps the last samples while a new preview is on its way", () => {
    const first = preview("gps_signal", 1);
    const { result, rerender } = renderHook(
      ({ p, source }) => useSourceSamples(p, source),
      {
        initialProps: {
          p: first as Preview | undefined,
          source: "gps_signal" as string | null,
        },
      }
    );
    expect(result.current).toBe(first.samples);
    rerender({ p: undefined, source: "gps_signal" });
    expect(result.current).toBe(first.samples);
    const second = preview("gps_signal", 2);
    rerender({ p: second, source: "gps_signal" });
    expect(result.current).toBe(second.samples);
  });

  it("drops another source's samples at once", () => {
    const { result, rerender } = renderHook(
      ({ p, source }) => useSourceSamples(p, source),
      {
        initialProps: {
          p: preview("gps_signal", 1) as Preview | undefined,
          source: "gps_signal" as string | null,
        },
      }
    );
    rerender({ p: undefined, source: "trip_check" });
    expect(result.current).toEqual([]);
    rerender({ p: preview("trip_check", 3), source: "trip_check" });
    expect(result.current[0]?.sample).toEqual({ n: 3 });
  });
});
