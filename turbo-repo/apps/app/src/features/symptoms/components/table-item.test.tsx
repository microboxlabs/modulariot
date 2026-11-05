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
  FormattedDate: () => null,
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

function renderRow(data: TableItemType) {
  return render(
    <Table>
      <TableBody>
        <TableItem data={data} dict={dict} />
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

describe("symptoms row opens the treatment", () => {
  const href = `/symptoms/map-view/-1?tripId=${tripId}&assetId=vehicle-demo`;

  beforeEach(() => navigate.mockClear());

  it("opens it from the condition and symptom cells, as Tratar does", async () => {
    const user = userEvent.setup();
    renderRow(row);
    const [condition, symptom] = screen.getAllByRole("cell");

    await user.click(within(condition).getByRole("link"));
    await user.click(within(symptom).getByRole("link"));
    await user.click(screen.getByRole("button", { name: "Tratar" }));

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
    expect(screen.getByRole("button", { name: "Tratar" })).toBeInTheDocument();
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
