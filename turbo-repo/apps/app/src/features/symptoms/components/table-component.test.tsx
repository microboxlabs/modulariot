import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

let mockSearchParams = new URLSearchParams();
const mockUseSymptomsTable = vi.fn();
const mockUseSymptomCounts = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useSymptomsTable: (...args: unknown[]) => mockUseSymptomsTable(...args),
  useSymptomCounts: (...args: unknown[]) => mockUseSymptomCounts(...args),
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
    constellation_condition_count: "{condition} — casos activos: {count}",
    constellation_on_trip: "Vehículos en viaje: {count}",
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

const COUNTS = {
  conditions: {
    codeBlack: 0,
    critic: 0,
    compromised: 3,
    observation: 0,
    treatment: 0,
    stable: 0,
  },
  vehiclesOnTrip: 4,
  ignored: 0,
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
  mockUseSymptomCounts.mockReset();
  mockUseSymptomsTable.mockReturnValue({
    tableData: EMPTY_PAGE,
    loading: false,
    error: undefined,
  });
  mockUseSymptomCounts.mockReturnValue({ counts: COUNTS });
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
      expect(mockUseSymptomCounts.mock.calls[0][0]).toMatchObject({
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

describe("SymptomsTable constellation", () => {
  it("reads the counts with the page's filters and shows them on an empty page", () => {
    mockSearchParams = new URLSearchParams(
      "asset_id=AB12&symptom_name=Speed&date_from=2026-10-01&date_to=2026-10-02"
    );

    renderTable();

    const [query, enabled] = mockUseSymptomCounts.mock.calls[0];
    expect(enabled).toBe(true);
    expect(query).toMatchObject({
      asset_id: "AB12",
      symptom_name: "Speed",
      date_range: { from: "2026-10-01", to: "2026-10-02" },
    });
    expect(
      screen.getByLabelText("Condición comprometida — casos activos: 3")
        .textContent
    ).toBe("3");
    expect(screen.getByLabelText("Vehículos en viaje: 4").textContent).toBe(
      "4"
    );
    expect(
      screen.getByText("Sin condiciones activas por este momento")
    ).toBeTruthy();
  });

  it("counts every case whatever the operator filter selects", () => {
    renderTable();

    expect(mockUseSymptomsTable.mock.calls[0][0].operator).not.toBe("all");
    expect(mockUseSymptomCounts.mock.calls[0][0].operator).toBe("all");
  });

  it("does not read the counts while the page has rows", () => {
    mockUseSymptomsTable.mockReturnValue({
      tableData: {
        ...EMPTY_PAGE,
        data: [{ id: "1" }],
        pagination: { ...EMPTY_PAGE.pagination, total_rows: 1 },
      },
      loading: false,
      error: undefined,
    });
    mockUseSymptomCounts.mockReturnValue({ counts: undefined });

    renderTable();

    expect(mockUseSymptomCounts.mock.calls[0][1]).toBe(false);
    expect(screen.queryByLabelText("Vehículos en viaje: 4")).toBeNull();
  });
});
