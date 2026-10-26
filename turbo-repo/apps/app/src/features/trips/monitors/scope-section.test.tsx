import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MonitorScope, ScopeOverlap, ScopeValues } from "./monitors-api";
import ScopeEditor, { scopeSummary } from "./scope-section";

const check = vi.hoisted(() => ({ overlaps: [] as ScopeOverlap[] }));
vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string, _d: unknown, vars?: Record<string, string>) =>
    vars ? `${key} ${Object.values(vars).join(" ")}` : key,
}));
vi.mock("./monitors-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./monitors-api")>()),
  useScopeCheck: (_key: string, scope: MonitorScope | null) => ({
    data: scope ? { overlaps: check.overlaps } : undefined,
  }),
}));

const values: ScopeValues = {
  feeds: [{ key: "feed-a", name: "Feed A" }],
  orderTypes: ["direct"],
  locations: [
    { id: "loc-1", name: "Plant", code: "PLT", type: "plant" },
    { id: "loc-2", name: "Port", code: null, type: "port" },
  ],
};
const scope = (patch: Partial<MonitorScope>): MonitorScope => ({
  feeds: [],
  orderTypes: [],
  origins: [],
  destinations: [],
  ...patch,
});

describe("scopeSummary", () => {
  it("names the values of each dimension that is not any", () => {
    expect(scopeSummary(null, values, {})).toBe("scope.none");
    expect(scopeSummary(scope({}), values, {})).toBe("scope.allTrips");
    expect(
      scopeSummary(
        scope({ feeds: ["feed-a"], destinations: ["loc-1", "loc-2"] }),
        values,
        {}
      )
    ).toBe("scope.feeds: Feed A · scope.destinations: Plant (PLT), Port");
  });
});

describe("ScopeEditor", () => {
  it("offers to apply an unset scope to every trip", () => {
    const onChange = vi.fn();
    render(
      <ScopeEditor
        monitorKey="m"
        scope={null}
        values={values}
        readOnly={false}
        onChange={onChange}
        d={{}}
      />
    );
    fireEvent.click(screen.getByText("scope.applyAll"));
    expect(onChange).toHaveBeenCalledWith(scope({}));
  });

  it("adds a picked value and removes it again", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ScopeEditor
        monitorKey="m"
        scope={scope({})}
        values={values}
        readOnly={false}
        onChange={onChange}
        d={{}}
      />
    );
    fireEvent.focus(screen.getByLabelText("scope.destinations"));
    fireEvent.click(screen.getByText("Port"));
    expect(onChange).toHaveBeenLastCalledWith(
      scope({ destinations: ["loc-2"] })
    );

    rerender(
      <ScopeEditor
        monitorKey="m"
        scope={scope({ destinations: ["loc-2"] })}
        values={values}
        readOnly={false}
        onChange={onChange}
        d={{}}
      />
    );
    fireEvent.click(screen.getByLabelText("scope.remove Port"));
    expect(onChange).toHaveBeenLastCalledWith(scope({}));
  });

  it("marks a duplicate and says which monitor is narrower", () => {
    check.overlaps = [
      { key: "a", name: "Monitor A", relation: "DUPLICATE" },
      { key: "b", name: "Monitor B", relation: "NARROWER" },
    ];
    render(
      <ScopeEditor
        monitorKey="m"
        scope={scope({ orderTypes: ["direct"] })}
        values={values}
        readOnly
        onChange={() => undefined}
        d={{}}
      />
    );
    expect(
      screen.getByText("scope.relation.DUPLICATE Monitor A")
    ).toBeInTheDocument();
    expect(
      screen.getByText("scope.relation.NARROWER Monitor B")
    ).toBeInTheDocument();
  });
});
