import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DataSource } from "./maintainer-api";
import { SourceHelp, SourceSelect } from "./source-select";

const d = {
  sourceLabel: "Fuente",
  sourceHelp: "Qué es esta fuente",
  sourceHelpText: "Las fuentes se registran en Ajustes",
  sourceKindSignal: "Flujo",
  sourceKindCheck: "Programada",
};

const source = (
  key: string,
  name: string,
  kind: DataSource["kind"],
  cadence: string | null
) =>
  ({
    id: key,
    tenantCode: null,
    key,
    name,
    kind,
    root: "x",
    cadence,
    fields: [],
    samples: [],
  }) as DataSource;

const SOURCES = [
  source("gps_signal", "Señal GPS", "SIGNAL", "Cada pulso"),
  source("trip_check", "Revisión del viaje", "CHECK", null),
];

describe("SourceSelect", () => {
  it("lists the sources and reports the one chosen", () => {
    const onChange = vi.fn();
    render(
      <SourceSelect
        value="gps_signal"
        sources={SOURCES}
        readOnly={false}
        helpOpen={false}
        d={d}
        onChange={onChange}
        onToggleHelp={vi.fn()}
      />
    );
    const select = screen.getByLabelText("Fuente") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      "Señal GPS",
      "Revisión del viaje",
    ]);
    fireEvent.change(select, { target: { value: "trip_check" } });
    expect(onChange).toHaveBeenCalledWith("trip_check");
  });

  it("keeps a source the list does not know as its own option", () => {
    render(
      <SourceSelect
        value="legacy_source"
        sources={SOURCES}
        readOnly={false}
        helpOpen={false}
        d={d}
        onChange={vi.fn()}
        onToggleHelp={vi.fn()}
      />
    );
    const select = screen.getByLabelText("Fuente") as HTMLSelectElement;
    expect(select.value).toBe("legacy_source");
    expect(select.options[0]?.textContent).toBe("legacy_source");
  });

  it("opens the help and is disabled for readers", () => {
    const onToggleHelp = vi.fn();
    render(
      <SourceSelect
        value="gps_signal"
        sources={SOURCES}
        readOnly
        helpOpen
        d={d}
        onChange={vi.fn()}
        onToggleHelp={onToggleHelp}
      />
    );
    expect(
      (screen.getByLabelText("Fuente") as HTMLSelectElement).disabled
    ).toBe(true);
    const help = screen.getByLabelText("Qué es esta fuente");
    expect(help.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(help);
    expect(onToggleHelp).toHaveBeenCalled();
  });
});

describe("SourceHelp", () => {
  it("shows name, kind and cadence when there is one", () => {
    const { rerender } = render(<SourceHelp source={SOURCES[0]} d={d} />);
    expect(screen.getByText(/Flujo · Cada pulso/)).toBeTruthy();
    rerender(<SourceHelp source={SOURCES[1]} d={d} />);
    expect(screen.getByText(/Programada/).textContent).not.toContain("·  ");
    expect(
      screen.getByText("Las fuentes se registran en Ajustes")
    ).toBeTruthy();
  });
});
