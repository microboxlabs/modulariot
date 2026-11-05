import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table, TableBody } from "flowbite-react";
import TableItem from "./table-item";
import type { TableItemType } from "./table-item.type";
import dict from "@/lang/es.json";

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
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/symptoms/map-view/-1?tripId=${tripId}&assetId=vehicle-demo`
    );
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
    expect(screen.getByRole("link").getAttribute("href")).toContain(
      "tripId=12345"
    );
  });
});
