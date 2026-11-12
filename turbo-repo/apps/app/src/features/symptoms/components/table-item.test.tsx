import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Table, TableBody } from "flowbite-react";
import TableItem from "./table-item";
import type { TableItemType } from "./table-item.type";
import dict from "@/lang/es.json";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock("./condition-icon", () => ({ default: () => null }));
vi.mock("@/features/common/components/formatted-date", () => ({
  FormattedDate: ({ date }: Readonly<{ date: string }>) => <time>{date}</time>,
}));

const tripId = "00000000-0000-4000-8000-000000000001";
const row: TableItemType = {
  id: "-1",
  condition: "critical condition",
  icu_code: "3",
  licensePlate: "vehicle-demo",
  time: "1 min",
  trip: tripId,
  driver: "Demo driver",
  date: "2026-01-01T00:00:00Z",
  service: "vehicle-demo",
  alertType: "Demo symptom",
  status: "",
  last_assigned_to: null,
  sla_minutes: null,
  recurrence_events: null,
};

function renderRow(data: TableItemType, compact = false) {
  return render(
    <Table>
      <TableBody>
        <TableItem data={data} dict={dict} compact={compact} />
      </TableBody>
    </Table>
  );
}

describe("symptoms trip column", () => {
  it("displays the service code and links with the UUID", () => {
    renderRow({ ...row, tripCode: "SERVICE-001" });

    expect(screen.getByText("SERVICE-001")).toBeInTheDocument();
    expect(screen.queryByText(tripId)).not.toBeInTheDocument();
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute(
        "href",
        `/symptoms/map-view/-1?tripId=${tripId}&assetId=vehicle-demo`
      );
    }
  });

  it.each([null, undefined, "", "   "])(
    "falls back to the UUID for code %s",
    (tripCode) => {
      renderRow({ ...row, tripCode });
      expect(screen.getByText(tripId)).toBeInTheDocument();
    }
  );

  it("keeps the legacy numeric trip id", () => {
    renderRow({ ...row, id: "1", trip: "12345" });
    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "vehicle-demo" }).getAttribute("href")
    ).toContain("tripId=12345");
  });
});

describe("symptoms truck change", () => {
  it.each([false, true])(
    "shows the current trip plate and keeps links on the case truck (compact=%s)",
    (compact) => {
      renderRow({ ...row, tripPlateNow: "TRUCK2" }, compact);

      expect(screen.getByText("Viaje ahora en TRUCK2")).toBeInTheDocument();
      for (const link of screen.getAllByRole("link")) {
        expect(link).toHaveAttribute(
          "href",
          `/symptoms/map-view/-1?tripId=${tripId}&assetId=vehicle-demo`
        );
      }
    }
  );

  it("omits the truck change message without a current trip plate", () => {
    renderRow(row);
    expect(screen.queryByText(/Viaje ahora en/)).not.toBeInTheDocument();
  });
});

describe("symptoms row opens the treatment", () => {
  const href = `/symptoms/map-view/-1?tripId=${tripId}&assetId=vehicle-demo`;

  beforeEach(() => navigate.mockClear());

  it("opens it from the condition and symptom cells, as Tratar does", async () => {
    const user = userEvent.setup();
    renderRow(row);
    const [condition, symptom] = screen.getAllByRole("cell");

    await user.click(within(condition).getByRole("link"));
    await user.click(within(symptom).getByRole("link"));
    await user.click(screen.getByRole("link", { name: "Tratar" }));

    expect(navigate.mock.calls).toEqual([[href], [href], [href]]);
    expect(within(condition).getByRole("link")).toHaveAttribute(
      "title",
      "Abrir el tratamiento de vehicle-demo"
    );
  });

  it("opens it from the keyboard", async () => {
    const user = userEvent.setup();
    renderRow(row);

    await user.tab();
    expect(screen.getByRole("link", { name: "vehicle-demo" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(screen.getByRole("link", { name: "Demo symptom" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(navigate.mock.calls).toEqual([[href], [href]]);
  });

  it("keeps the Tratar button", () => {
    renderRow(row);
    expect(screen.getByRole("link", { name: "Tratar" })).toBeInTheDocument();
  });
});

describe("symptoms treatment column and row action", () => {
  const href = `/symptoms/map-view/-1?tripId=${tripId}&assetId=vehicle-demo`;
  const openTreatment = {
    id: "t-1",
    status: "OPEN" as const,
    opened_by: "operator-a",
    opened_at: "2026-01-01T00:05:00Z",
    mine: false,
    operators: ["operator-a"],
  };

  function actionLink(name: string) {
    return screen.getByRole("link", { name });
  }

  it("shows only Tratar for an open case nobody treats", () => {
    renderRow({ ...row, treatmentState: "untreated", treatment: null });

    expect(screen.queryByTestId("treatment-state")).toBeNull();
    expect(actionLink("Tratar")).toHaveAttribute("href", href);
  });

  it("continues the user's own open treatment with the form open", () => {
    renderRow({
      ...row,
      treatmentState: "in_treatment",
      treatment: { ...openTreatment, mine: true },
    });

    const cell = screen.getByTestId("treatment-state");
    expect(within(cell).getByText("En tratamiento")).toBeInTheDocument();
    expect(within(cell).getByText(/por operator-a/)).toBeInTheDocument();
    expect(actionLink("Continuar")).toHaveAttribute(
      "href",
      `${href}&open=1&menu=call_driver`
    );
    expect(screen.queryByRole("link", { name: "Tratar" })).toBeNull();
  });

  it("does not offer a second treatment while another operator treats the case", () => {
    renderRow({
      ...row,
      treatmentState: "in_treatment",
      treatment: openTreatment,
    });

    expect(screen.queryByRole("link", { name: "Tratar" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Continuar" })).toBeNull();
    const link = actionLink("Ver tratamiento");
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("title", "En tratamiento por operator-a");
  });

  it.each([
    ["call", "Llamada"],
    ["handling", "Gestión registrada"],
    ["ignore", "Ignorado"],
    ["invalidate", "Invalidado"],
  ] as const)(
    "shows a treated case's %s outcome, who closed it, and 'Ver tratamiento'",
    (outcome, label) => {
      renderRow({
        ...row,
        endDate: "2026-01-01T00:10:00Z",
        treatmentState: "treated",
        treatment: {
          id: "t-2",
          status: "CLOSED",
          outcome,
          type: "CALL",
          opened_at: "2026-01-01T00:05:00Z",
          opened_by: "operator-a",
          closed_by: "operator-b",
          closed_at: "2026-01-01T00:09:00Z",
        },
      });

      const cell = screen.getByTestId("treatment-state");
      expect(within(cell).getByText("Tratado")).toBeInTheDocument();
      expect(within(cell).getByText(label)).toBeInTheDocument();
      expect(within(cell).getByText(/por operator-b/)).toBeInTheDocument();
      expect(
        within(cell).getByText("2026-01-01T00:05:00Z")
      ).toBeInTheDocument();
      expect(
        within(cell).getByText("2026-01-01T00:09:00Z")
      ).toBeInTheDocument();
      expect(within(cell).getByText("Llamada")).toBeInTheDocument();
      expect(actionLink("Ver tratamiento")).toHaveAttribute("href", href);
      expect(screen.queryByRole("link", { name: "Tratar" })).toBeNull();
    }
  );

  it("only shows a case that closed without a treatment", () => {
    renderRow({
      ...row,
      endDate: "2026-01-01T00:10:00Z",
      treatmentState: "untreated",
      treatment: null,
    });

    expect(actionLink("Ver caso")).toHaveAttribute("href", href);
    expect(screen.queryByRole("link", { name: "Tratar" })).toBeNull();
  });

  it("shows a held case as ignored by whoever set the hold, without Continuar", () => {
    renderRow({
      ...row,
      treatmentState: "in_treatment",
      treatment: { ...openTreatment, mine: true },
      ignored: {
        treatment_id: "t-1",
        since: "2026-01-01T00:06:00Z",
        until: null,
        until_trip_end: true,
        scope: "CASE",
        by: "operator-c",
      },
    });

    const cell = screen.getByTestId("treatment-state");
    expect(within(cell).getByText("Ignorado")).toBeInTheDocument();
    expect(within(cell).getByText(/por operator-c/)).toBeInTheDocument();
    expect(actionLink("Ver tratamiento")).toHaveAttribute("href", href);
  });

  it("shows only Tratar for a case back from a hold", () => {
    renderRow({
      ...row,
      treatmentState: "untreated",
      treatment: {
        id: "t-3",
        status: "CLOSED",
        outcome: "ignore",
        resolution: "returned_after_ignore",
        closed_by: "system",
        closed_at: "2026-01-01T00:09:00Z",
      },
      returnedAfterIgnoreAt: "2026-01-01T00:09:00Z",
    });

    expect(screen.queryByTestId("treatment-state")).toBeNull();
    expect(screen.queryByText(/por system/)).toBeNull();
    expect(actionLink("Tratar")).toHaveAttribute("href", href);
  });

  it("shows no state for a symptom without one", () => {
    renderRow(row);
    expect(screen.queryByTestId("treatment-state")).toBeNull();
  });
});

describe("symptoms SLA badge", () => {
  it("counts the SLA from the server's start, not from the opening", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T01:00:00Z"));
    try {
      renderRow({
        ...row,
        sla_minutes: 15,
        date: "2026-01-01T00:00:00Z",
        slaSince: "2026-01-01T00:55:00Z",
      });
      expect(screen.getByText(/10 min/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
