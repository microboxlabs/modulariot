import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PointCategorySelect, {
  useNombreCategoriaPunto,
} from "./point-category-select";

vi.mock("../ui/place-categories-field", () => ({
  CAMPO_CATEGORIA_PUNTO: "trayecto_point_category",
  useListaCampo: () => ({
    lang: "es",
    puedeConfigurar: true,
    hydrated: true,
    lista: { key: "trayecto_point_category" },
    opciones: [
      { value: "carga", label: { es: "Carga" } },
      { value: "descarga", label: { es: "Descarga" } },
    ],
  }),
  // the shared field: only what it gets and what it sends back
  default: ({
    fieldKey,
    label,
    value,
    onChange,
  }: {
    fieldKey: string;
    label: string;
    value: string[];
    onChange: (next: string[]) => void;
  }) => (
    <div
      data-testid="campo"
      data-field={fieldKey}
      data-label={label}
      data-value={value.join("|")}
    >
      <button type="button" onClick={() => onChange(["carga", "descarga"])}>
        varias
      </button>
      <button type="button" onClick={() => onChange([])}>
        ninguna
      </button>
    </div>
  ),
}));

describe("PointCategorySelect", () => {
  it("uses the shared category field, joined by comma on the point", () => {
    const onChange = vi.fn();
    render(
      <PointCategorySelect
        label="Parada 1"
        value="carga"
        onChange={onChange}
        dict={{}}
      />
    );
    const campo = screen.getByTestId("campo");
    expect(campo).toHaveAttribute("data-field", "trayecto_point_category");
    expect(campo).toHaveAttribute("data-label", "Categoría de Parada 1");
    expect(campo).toHaveAttribute("data-value", "carga");
    fireEvent.click(screen.getByText("varias"));
    expect(onChange).toHaveBeenCalledWith("carga,descarga");
    fireEvent.click(screen.getByText("ninguna"));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("names the pick, or the first plus how many more", () => {
    expect(
      renderHook(() => useNombreCategoriaPunto("carga")).result.current
    ).toBe("Carga");
    expect(
      renderHook(() => useNombreCategoriaPunto("carga,descarga")).result.current
    ).toBe("Carga +1");
    expect(
      renderHook(() => useNombreCategoriaPunto(undefined)).result.current
    ).toBeNull();
  });
});
