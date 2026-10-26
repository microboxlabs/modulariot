import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TableItemType } from "@/features/symptoms/components/table-item.type";
import type { BoardCard } from "../board/board-api";
import { orderSymptoms, symptomRange, TripSymptoms } from "./trip-symptoms";

const table = vi.fn();
vi.mock("@/features/common/providers/client-api.provider", () => ({
  useSymptomsTable: (args: unknown) => table(args),
}));
vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
  trDynamic: (key: string) => key,
}));
vi.mock("@/features/symptoms/components/condition-icon", () => ({
  default: ({ condition }: { condition: string }) => <span>{condition}</span>,
}));

const TRIP = "5c1f0a52-3a8e-4bb1-9c55-0d7d1e0e6a01";

function card(over: Partial<BoardCard> = {}): BoardCard {
  return {
    tripId: TRIP,
    plannedStart: "2026-10-26T07:00:00Z",
    departedAt: null,
    actualEnd: null,
    ...over,
  } as BoardCard;
}

function row(id: string, date: string, endDate?: string): TableItemType {
  return {
    id,
    condition: "code black",
    icu_code: "4",
    licensePlate: "TEST-1",
    time: "2 h",
    trip: TRIP,
    driver: "",
    date,
    endDate,
    service: "TEST-1",
    alertType: "Botón de pánico",
    status: "",
    last_assigned_to: null,
    sla_minutes: null,
    recurrence_events: null,
  };
}

describe("trip symptoms", () => {
  beforeEach(() => table.mockReset());

  it("reads from the trip's start until it ends, or without an upper cutoff while it runs", () => {
    expect(symptomRange(card())).toEqual({
      from: "2026-10-26T07:00:00Z",
      to: undefined,
    });
    expect(
      symptomRange(
        card({
          departedAt: "2026-10-26T08:00:00Z",
          actualEnd: "2026-10-26T11:00:00Z",
        })
      )
    ).toEqual({ from: "2026-10-26T08:00:00Z", to: "2026-10-26T11:00:00Z" });
    expect(symptomRange(card({ plannedStart: null }))).toBeUndefined();
  });

  it("puts the open symptoms first, then the latest", () => {
    const ordered = orderSymptoms([
      row("-1", "2026-10-26T08:00:00Z", "2026-10-26T08:30:00Z"),
      row("-2", "2026-10-26T09:00:00Z"),
      row("-3", "2026-10-26T10:00:00Z", "2026-10-26T10:05:00Z"),
      row("-4", "2026-10-26T07:30:00Z"),
    ]);
    expect(ordered.map((r) => r.id)).toEqual(["-2", "-4", "-3", "-1"]);
  });

  it("asks the symptom list for the trip and links each symptom to its treatment", () => {
    table.mockReturnValue({
      tableData: {
        data: [row("-7", "2026-10-26T09:00:00Z")],
        pagination: {},
        symptoms_list: [],
      },
      loading: false,
      error: undefined,
    });
    render(<TripSymptoms card={card()} d={{}} general={{}} lang="en" />);

    expect(table).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: TRIP })
    );
    expect(screen.getByText("Botón de pánico")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/symptoms/map-view/-7?tripId=${TRIP}&assetId=TEST-1`
    );
  });

  it("says so when the trip has no symptoms or they cannot be read", () => {
    table.mockReturnValue({ tableData: { data: [] }, loading: false });
    const { rerender } = render(
      <TripSymptoms card={card()} d={{}} general={{}} lang="en" />
    );
    expect(screen.getByText("sheet.noSymptoms")).toBeInTheDocument();

    table.mockReturnValue({ tableData: undefined, error: new Error("x") });
    rerender(<TripSymptoms card={card()} d={{}} general={{}} lang="en" />);
    expect(screen.getByText("sheet.symptomsError")).toBeInTheDocument();
  });
});
