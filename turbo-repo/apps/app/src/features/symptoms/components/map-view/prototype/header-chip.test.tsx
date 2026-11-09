import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { chipText, plateChip } from "./header-chip";
import es from "@/lang/es.json";

describe("chipText", () => {
  it("shows a placeholder while the header loads", () => {
    const { container } = render(<>{chipText(true, null, "Ruta")}</>);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("shows a dash once loaded without a value", () => {
    expect(chipText(false, null, "Ruta")).toBe("Ruta: —");
    expect(chipText(false, undefined)).toBe("—");
    expect(chipText(false, "")).toBe("—");
  });

  it("shows the value with its label", () => {
    expect(chipText(false, "DEMO008", "Patente")).toBe("Patente: DEMO008");
    expect(chipText(false, "A driver")).toBe("A driver");
  });
});

describe("plateChip", () => {
  it("adds the trip's current plate after a truck change", () => {
    const { container } = render(
      <>{plateChip("Patente: KTKJ69", "KGXR80", es)}</>
    );
    expect(container.textContent).toBe(
      "Patente: KTKJ69· Viaje ahora en KGXR80"
    );
  });

  it("keeps the plate alone without a change", () => {
    expect(plateChip("Patente: KGXR80", null, es)).toBe("Patente: KGXR80");
  });
});
