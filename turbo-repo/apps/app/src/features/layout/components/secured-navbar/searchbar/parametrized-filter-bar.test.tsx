import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DashboardFilterParam } from "@/features/dashboard/types/dashboard.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

let mockSearchParams = new URLSearchParams();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/es/symptoms",
  useRouter: () => ({ push }),
}));

vi.mock("@/features/dashboard/hooks/use-filter-options", () => ({
  useFilterOptions: (filter: DashboardFilterParam) => ({
    options: filter.options ?? [],
    loading: false,
    error: null,
    dynamic: false,
  }),
}));

const { default: ParametrizedFilterBar } =
  await import("./parametrized-filter-bar");
const { getNavegationParams } = await import("./navegation_params");
const { OPERATOR_FILTER_KEY } =
  await import("@/features/symptoms/model/operator-filter");

const DICT: I18nRecord = {
  searchbar: {
    operator: "Operador",
    operator_required: "Solo para operadores",
    operator_none: "Sin operador",
    treatment: "Tratamiento",
    treatment_untreated: "Sin tratar",
    treatment_in_treatment: "En tratamiento",
    treatment_treated: "Tratado",
    icu_code: "Condición",
    icu_code_4: "Código negro",
    icu_code_3: "Condición crítica",
    icu_code_2: "Condición comprometida",
    icu_code_1: "En observación",
    icu_code_9: "Ignorados",
  },
  dashboard: { settings: { columnFilterAll: "Todos" } },
  storytelling: { kind: {} },
};

function renderBar() {
  const params = getNavegationParams(DICT, 0).symptoms ?? [];
  render(<ParametrizedFilterBar dict={DICT} navegation_params={params} />);
}

/** Opens the operator badge and picks an entry of its panel. */
function pick(label: string) {
  fireEvent.click(screen.getByText(/^Operador:?$/));
  const matches = screen.getAllByText(label);
  fireEvent.mouseDown(matches[matches.length - 1]);
}

beforeEach(() => {
  localStorage.clear();
  mockSearchParams = new URLSearchParams();
  push.mockReset();
});

afterEach(cleanup);

describe("the symptoms condition filter", () => {
  it("shows the condition a card selected in the URL", () => {
    mockSearchParams = new URLSearchParams("icu_code=3&operator=all");
    renderBar();

    expect(screen.getByText(/^Condición:?$/)).toBeTruthy();
    expect(screen.getByText("Condición crítica")).toBeTruthy();
  });

  it("clears the condition while keeping the operator URL override and stored choice", () => {
    localStorage.setItem(OPERATOR_FILTER_KEY, "none");
    mockSearchParams = new URLSearchParams("icu_code=3&operator=all");
    renderBar();

    fireEvent.click(screen.getByText(/^Condición:?$/));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Todos" }));

    expect(push).toHaveBeenCalledWith("/es/symptoms?operator=all");
    expect(localStorage.getItem(OPERATOR_FILTER_KEY)).toBe("none");
  });
});

describe("the symptoms treatment filter", () => {
  function pickTreatment(label: string) {
    fireEvent.click(screen.getByText(/^Tratamiento:?$/));
    const matches = screen.getAllByText(label);
    fireEvent.mouseDown(matches[matches.length - 1]);
  }

  it("offers the three treatment states in the filter menu", () => {
    const param = (getNavegationParams(DICT, 0).symptoms ?? []).find(
      (p) => p.param.key === "treatment"
    );

    expect(param?.param.type).toBe("selector");
    expect(param?.options).toEqual([
      { value: "untreated", label: "Sin tratar" },
      { value: "in_treatment", label: "En tratamiento" },
      { value: "treated", label: "Tratado" },
    ]);
    expect(param?.defaultValue).toBeUndefined();
  });

  it("filters by nothing until a state is picked", () => {
    renderBar();

    expect(screen.queryByText("En tratamiento")).toBeNull();
  });

  it("writes the picked state to the URL, keeping the other filters", () => {
    mockSearchParams = new URLSearchParams("asset_id=DEMO01");
    renderBar();

    pickTreatment("En tratamiento");

    expect(push).toHaveBeenCalledWith(
      "/es/symptoms?asset_id=DEMO01&treatment=in_treatment"
    );
  });

  it("shows the state the URL names", () => {
    mockSearchParams = new URLSearchParams("treatment=treated");
    renderBar();

    expect(screen.getByText("Tratado")).toBeTruthy();
  });
});

describe("the symptoms operator filter", () => {
  it("shows 'Solo para operadores' by default", () => {
    renderBar();

    expect(screen.getByText("Solo para operadores")).toBeTruthy();
  });

  it("shows the stored choice when the URL has none", () => {
    localStorage.setItem(OPERATOR_FILTER_KEY, "none");

    renderBar();

    expect(screen.getByText("Sin operador")).toBeTruthy();
    expect(screen.queryByText("Solo para operadores")).toBeNull();
  });

  it("stores 'Sin operador' and writes it to the URL", () => {
    renderBar();

    pick("Sin operador");

    expect(localStorage.getItem(OPERATOR_FILTER_KEY)).toBe("none");
    expect(push).toHaveBeenCalledWith("/es/symptoms?operator=none");
  });

  it("stores 'Todos' and writes it to the URL, keeping the other filters", () => {
    mockSearchParams = new URLSearchParams("asset_id=DEMO01");
    renderBar();

    pick("Todos");

    expect(localStorage.getItem(OPERATOR_FILTER_KEY)).toBe("all");
    expect(push).toHaveBeenCalledWith(
      "/es/symptoms?asset_id=DEMO01&operator=all"
    );
  });

  it("shows no value picked for 'Todos'", () => {
    localStorage.setItem(OPERATOR_FILTER_KEY, "all");

    renderBar();

    expect(screen.queryByText("Solo para operadores")).toBeNull();
    expect(screen.queryByText("Sin operador")).toBeNull();
  });

  it("goes back to 'Solo para operadores'", () => {
    localStorage.setItem(OPERATOR_FILTER_KEY, "all");
    renderBar();

    pick("Solo para operadores");

    expect(localStorage.getItem(OPERATOR_FILTER_KEY)).toBe("required");
    expect(push).toHaveBeenCalledWith("/es/symptoms?operator=required");
  });
});
