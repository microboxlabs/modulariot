import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

let mockSearchParams = new URLSearchParams();
const mockUseSymptomsTable = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useSymptomsTable: (...args: unknown[]) => mockUseSymptomsTable(...args),
}));

vi.mock("./table-item", () => ({ default: () => <tr data-testid="row" /> }));
vi.mock("@/features/common/components/custom-table/custom-table", () => ({
  default: ({ header }: Readonly<{ header: string[] }>) => (
    <ul data-testid="columns">
      {header.map((title, i) => (
        <li key={i}>{title}</li>
      ))}
    </ul>
  ),
}));

const { default: SymptomsTable } = await import("./table-component");

const DICT: I18nRecord = {
  symptoms: {
    no_active_conditions: "Sin condiciones activas por este momento",
    code_black: "Código negro",
    compromised_condition: "Condición comprometida",
    creation_date: "Fecha de creación",
    treatment_column: "Tratamiento",
    treated_needs_dates: "Elige un rango de fechas",
  },
};

const EMPTY_PAGE = {
  data: [],
  pagination: { total_rows: 0, total_pages: 0, currentPage: 1, page_size: 13 },
  symptoms_list: [],
};


function renderTable() {
  return render(
    <SymptomsTable
      dict={DICT}
      pagination={{ currentPage: 1, setCurrentPage: vi.fn() }}
    />
  );
}

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
  mockUseSymptomsTable.mockReset();
  mockUseSymptomsTable.mockReturnValue({
    tableData: EMPTY_PAGE,
    loading: false,
    error: undefined,
  });
});

afterEach(cleanup);

describe("SymptomsTable treatment state", () => {
  const ONE_ROW = {
    ...EMPTY_PAGE,
    data: [{ id: "1" }],
    pagination: { ...EMPTY_PAGE.pagination, total_rows: 1 },
  };

  it("ends with the treatment column, which holds the row action", () => {
    mockUseSymptomsTable.mockReturnValue({
      tableData: ONE_ROW,
      loading: false,
      error: undefined,
    });

    renderTable();

    const titles = within(screen.getByTestId("columns"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(titles.slice(-2)).toEqual(["Fecha de creación", "Tratamiento"]);
  });

  it.each(["untreated", "in_treatment", "treated"])(
    "queries the table and its counts in the %s state",
    (treatment) => {
      mockSearchParams = new URLSearchParams({ treatment });

      renderTable();

      expect(mockUseSymptomsTable.mock.calls[0][0]).toMatchObject({
        treatment,
      });
    }
  );

  it("ignores a treatment state it does not know", () => {
    mockSearchParams = new URLSearchParams({ treatment: "done" });

    renderTable();

    expect(mockUseSymptomsTable.mock.calls[0][0].treatment).toBeUndefined();
  });

  it("says treated cases need dates when the live list has none", () => {
    mockSearchParams = new URLSearchParams({ treatment: "treated" });

    renderTable();

    expect(screen.getByText("Elige un rango de fechas")).toBeTruthy();
  });

  it("does not say so with dates", () => {
    mockSearchParams = new URLSearchParams(
      "treatment=treated&date_from=2026-10-01&date_to=2026-10-02"
    );

    renderTable();

    expect(screen.queryByText("Elige un rango de fechas")).toBeNull();
  });
});

