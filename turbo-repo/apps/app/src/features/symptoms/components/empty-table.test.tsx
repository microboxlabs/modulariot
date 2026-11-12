import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import EmptyTable from "./empty-table";

const DICT: I18nRecord = {
  symptoms: {
    no_active_conditions: "Sin condiciones activas por este momento",
    normal_operation: "La flota se encuentra operando con normalidad.",
    check_later: "Vuelve más tarde.",
  },
};

afterEach(cleanup);

describe("EmptyTable", () => {
  it("shows the constellation without counts", () => {
    const { container } = render(<EmptyTable dict={DICT} />);

    expect(container.querySelectorAll("[aria-label]")).toHaveLength(0);
    expect(
      screen.getByText("Sin condiciones activas por este momento")
    ).toBeTruthy();
  });

  it("shows the hint instead of the normal-operation text", () => {
    render(<EmptyTable dict={DICT} hint="Elige un rango de fechas" />);

    expect(screen.getByText("Elige un rango de fechas")).toBeTruthy();
    expect(
      screen.queryByText("Sin condiciones activas por este momento")
    ).toBeNull();
  });
});
