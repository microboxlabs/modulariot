import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CampoCategorias, { AJUSTES_PARA_TODOS } from "./place-categories-field";

const estado = vi.hoisted(() => ({
  role: "MEMBER",
  modo: "SINGLE" as "SINGLE" | "MULTIPLE",
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));
vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({ useOrgScopes: () => ({ activeOrg: { role: estado.role } }) })
);
vi.mock("@/features/settings-admin/selectables/store", () => ({
  useSelectables: () => ({
    selectables: [
      {
        key: "place_categories",
        mode: estado.modo,
        source: { kind: "STATIC" },
        options: [
          { value: "bodega", label: { es: "Bodega" }, color: "blue" },
          { value: "cliente", label: { es: "Cliente" }, color: "green" },
        ],
      },
    ],
    hydrated: true,
  }),
}));
vi.mock("@/features/settings-admin/selectables/field-bindings", () => ({
  useFieldSelectableBinding: (k: string) => [k, vi.fn()],
}));
vi.mock("@/features/settings-admin/selectables/selectables-api", () => ({
  useSelectableOptions: () => ({ data: undefined }),
}));
// the treatment view's selector: only what it gets and what it sends back
vi.mock(
  "@/features/symptoms/components/map-view/prototype/prototype-form-kit",
  () => ({
    SelectableDropdown: ({
      fieldKey,
      value,
      onSelect,
      clearLabel,
      onClear,
    }: {
      fieldKey: string;
      value: string;
      onSelect: (o: { id: string; name: string; description: string }) => void;
      clearLabel?: string;
      onClear?: () => void;
    }) => (
      <div data-testid="dropdown" data-field={fieldKey} data-value={value}>
        {clearLabel && (
          <button type="button" onClick={onClear}>
            {clearLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            onSelect({ id: "bodega,cliente", name: "Bodega", description: "" })
          }
        >
          elegir varias
        </button>
      </div>
    ),
    SelectableBindingControl: ({ fieldKey }: { fieldKey: string }) => (
      <span data-testid="control">{fieldKey}</span>
    ),
  })
);

describe("CampoCategorias", () => {
  beforeEach(() => {
    estado.role = "MEMBER";
    estado.modo = "SINGLE";
  });

  it("shows the picks of a multiple-choice list as removable badges", () => {
    estado.modo = "MULTIPLE";
    const onChange = vi.fn();
    render(
      <CampoCategorias
        fieldKey="place_categories"
        label="Categorías"
        value={["bodega", "cliente"]}
        onChange={onChange}
        dict={{}}
      />
    );
    const elegidas = screen.getByRole("list", { name: "Categorías elegidas" });
    expect(elegidas).toHaveTextContent("Bodega");
    expect(elegidas).toHaveTextContent("Cliente");
    fireEvent.click(screen.getByLabelText("Quitar Bodega"));
    expect(onChange).toHaveBeenCalledWith(["cliente"]);
  });

  it("does not repeat a single pick under the dropdown", () => {
    render(
      <CampoCategorias
        fieldKey="place_categories"
        label="Categorías"
        value={["bodega"]}
        onChange={vi.fn()}
        dict={{}}
      />
    );
    expect(
      screen.queryByRole("list", { name: "Categorías elegidas" })
    ).toBeNull();
  });

  it("uses the treatment view's selector for the field's list", () => {
    const onChange = vi.fn();
    render(
      <CampoCategorias
        fieldKey="place_categories"
        label="Categorías"
        value={["bodega"]}
        onChange={onChange}
        dict={{}}
      />
    );
    const dropdown = screen.getByTestId("dropdown");
    expect(dropdown).toHaveAttribute("data-field", "place_categories");
    expect(dropdown).toHaveAttribute("data-value", "bodega");
    // a multiple-choice list sends several codes joined by comma
    fireEvent.click(screen.getByText("elegir varias"));
    expect(onChange).toHaveBeenCalledWith(["bodega", "cliente"]);
  });

  it("clears from inside the dropdown, with no × beside it", () => {
    const onChange = vi.fn();
    render(
      <CampoCategorias
        fieldKey="place_categories"
        label="Categorías"
        value={["bodega"]}
        onChange={onChange}
        dict={{}}
      />
    );
    expect(screen.queryByLabelText("Quitar categorías")).toBeNull();
    // single-choice list: "Sin categoría"
    fireEvent.click(screen.getByRole("button", { name: "Sin categoría" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("names the clear option for a multiple-choice list", () => {
    estado.modo = "MULTIPLE";
    render(
      <CampoCategorias
        fieldKey="place_categories"
        label="Categorías"
        value={["bodega", "cliente"]}
        onChange={vi.fn()}
        dict={{}}
      />
    );
    expect(
      screen.getByRole("button", { name: "Limpiar selección" })
    ).toBeInTheDocument();
  });

  it("shows the list control while open to everyone, else to the owner", () => {
    render(
      <CampoCategorias
        fieldKey="trayecto_categories"
        label="Categorías"
        value={[]}
        onChange={vi.fn()}
        dict={{}}
      />
    );
    const control = screen.queryByTestId("control");
    if (AJUSTES_PARA_TODOS) {
      expect(control).toHaveTextContent("trayecto_categories");
    } else {
      expect(control).toBeNull();
    }
  });
});
