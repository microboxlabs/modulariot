import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SelectableField from "./selectable-field";
import type { Selectable } from "../types";

vi.mock("../selectables-api", () => ({
  useSelectableOptions: () => ({ data: undefined, isLoading: false }),
}));

const dict = {
  placeholder: "Selecciona…",
  create: "Crear «{value}»",
  noResults: "Sin resultados",
  loading: "Cargando…",
  max: "Máximo {count}",
  pickParentFirst: "Primero elige un valor en «{list}»",
  clear: "Limpiar",
  remove: "Quitar {label}",
};

function list(overrides: Partial<Selectable>): Selectable {
  return {
    key: "delay_reason",
    name: { es: "Motivo" },
    description: {},
    mode: "SINGLE",
    settings: {},
    groups: [],
    source: { kind: "STATIC" },
    options: [
      {
        value: "traffic",
        label: { es: "Tráfico", en: "Traffic" },
        group: "route",
      },
      {
        value: "detour",
        label: { es: "Desvío", en: "Detour" },
        group: "route",
      },
      {
        value: "dock_busy",
        label: { es: "Andén ocupado" },
        group: "destination",
      },
    ],
    ...overrides,
  };
}

/** Holds the value like a form would, and reports every change. */
function Harness({
  selectable,
  onChange,
  parentValues,
}: Readonly<{
  selectable: Selectable;
  onChange: (v: string[]) => void;
  parentValues?: string[];
}>) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <SelectableField
      list={selectable}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      lang="en"
      dict={dict}
      parentValues={parentValues}
      parentName="Región"
    />
  );
}

describe("SelectableField", () => {
  it("shows labels in the user's language, grouped, and filters by accent-free search", async () => {
    const onChange = vi.fn();
    const groups = [
      { key: "route", label: { es: "En ruta", en: "On the road" } },
      { key: "destination", label: { es: "En destino", en: "At destination" } },
    ];
    render(<Harness selectable={list({ groups })} onChange={onChange} />);

    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("On the road")).toBeInTheDocument();
    expect(screen.getByText("At destination")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("combobox"), "desvio");
    expect(
      screen.queryByRole("option", { name: /Traffic/ })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: /Detour/ }));

    expect(onChange).toHaveBeenLastCalledWith(["detour"]);
    expect(screen.getByRole("combobox")).toHaveValue("Detour");
  });

  it("keeps several choices as removable badges and stops at the cap", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        selectable={list({ mode: "MULTIPLE", settings: { maxSelections: 2 } })}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: /Traffic/ }));
    await userEvent.click(screen.getByRole("option", { name: /Detour/ }));
    expect(onChange).toHaveBeenLastCalledWith(["traffic", "detour"]);
    expect(
      screen.getByRole("option", { name: /Andén ocupado/ })
    ).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Máximo 2")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Quitar Traffic" })
    );
    expect(onChange).toHaveBeenLastCalledWith(["detour"]);
  });

  it("adds a typed tag when the list allows new values", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        selectable={list({ mode: "MULTIPLE", settings: { creatable: true } })}
        onChange={onChange}
      />
    );

    await userEvent.type(screen.getByRole("combobox"), "Frágil");
    await userEvent.click(
      screen.getByRole("option", { name: "Crear «Frágil»" })
    );

    expect(onChange).toHaveBeenLastCalledWith(["Frágil"]);
  });

  it("still takes typed tags when search is off, without filtering the options", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        selectable={list({
          mode: "MULTIPLE",
          settings: { creatable: true, searchable: false },
        })}
        onChange={onChange}
      />
    );

    await userEvent.type(screen.getByRole("combobox"), "Frágil");
    expect(screen.getByRole("option", { name: /Traffic/ })).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("option", { name: "Crear «Frágil»" })
    );

    expect(onChange).toHaveBeenLastCalledWith(["Frágil"]);
  });

  it("does not add a typed tag past the cap", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        selectable={list({
          mode: "MULTIPLE",
          settings: { creatable: true, maxSelections: 1 },
        })}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: /Traffic/ }));
    await userEvent.type(screen.getByRole("combobox"), "Frágil");

    expect(
      screen.getByRole("option", { name: "Crear «Frágil»" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("waits for the list it depends on, then shows only that parent's options", async () => {
    const communes = list({
      settings: { dependsOn: "region" },
      options: [
        { value: "santiago", label: { es: "Santiago" }, parent: "CL-RM" },
        { value: "valparaiso", label: { es: "Valparaíso" }, parent: "CL-VS" },
      ],
    });
    const { rerender } = render(
      <Harness selectable={communes} onChange={vi.fn()} />
    );
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "placeholder",
      "Primero elige un valor en «Región»"
    );

    rerender(
      <Harness
        selectable={communes}
        onChange={vi.fn()}
        parentValues={["CL-VS"]}
      />
    );
    await userEvent.click(screen.getByRole("combobox"));
    expect(
      screen.getByRole("option", { name: /Valparaíso/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Santiago/ })
    ).not.toBeInTheDocument();
  });
});
