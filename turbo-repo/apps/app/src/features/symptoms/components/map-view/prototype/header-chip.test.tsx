import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { chipText } from "./header-chip";

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
