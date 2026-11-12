import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { TreatmentsGeneralResponseItem } from "@/app/api/treatments/general/route.type";
import type { ConditionsAgg } from "@/features/symptoms/types/timeline";
import TimelineComponent from "./timeline";

vi.mock("../symtom-icon", () => ({ default: () => <span /> }));
vi.mock("../condition-icon", () => ({ default: () => <span /> }));
vi.mock("@/features/common/components/formatted-date", () => ({
  FormattedDate: ({ date }: { date?: unknown }) => <span>{String(date)}</span>,
}));
vi.mock("./prototype/prototype-api-guard", () => ({
  isMockDataEnabled: () => false,
}));

const dict = {
  symptoms: {
    timeline_current_case: "Caso actual",
    timeline_case_closed: "Cerrado",
  },
} as unknown as I18nRecord;

function agg(
  symptomId: number,
  type: string,
  start: string,
  end: string,
  level: string,
  message?: string
): ConditionsAgg {
  return {
    assigned_to: "",
    start,
    end,
    icu_code: level,
    is_symptom: 1,
    symptom_id: symptomId,
    icu_condition: `level ${level}`,
    count: 1,
    symptom_description: type,
    type,
    evidences: null,
    treatments: message
      ? [
          {
            treatment_type: "llamar al conductor",
            description: { message, driver_response: "" },
          },
        ]
      : [],
  };
}

function header(): TreatmentsGeneralResponseItem {
  return {
    conditions_agg: [],
    symptom_info: {
      id: -12,
      name: "Conducción continua",
      type: "driving",
      icu_code: 4,
      icu_condition: "level 4",
    },
    trip_info: {
      asset_id: "asset-test",
      carrier: "",
      destination: "",
      driver: "",
      trip_id: "trip-test",
      origin: "",
      type_load: "",
      driver_contact: "",
    },
    timeline: [
      {
        start: "2026-01-01T15:00:00Z",
        end: "2026-01-01T15:30:00Z",
        symptom_id: -12,
        symptom_name: "Conducción continua",
        current: true,
        closed_at: null,
        conditions_agg: [
          agg(
            -12,
            "Conducción continua",
            "2026-01-01T15:00:00Z",
            "2026-01-01T15:30:00Z",
            "4",
            "Llamado actual"
          ),
        ],
      },
      {
        start: "2026-01-01T12:00:00Z",
        end: "2026-01-01T13:00:00Z",
        symptom_id: -10,
        symptom_name: "Conducción continua",
        current: false,
        closed_at: "2026-01-01T13:00:00Z",
        conditions_agg: [
          agg(
            -10,
            "Conducción continua",
            "2026-01-01T12:00:00Z",
            "2026-01-01T12:20:00Z",
            "1"
          ),
          agg(
            -10,
            "Conducción continua",
            "2026-01-01T12:20:00Z",
            "2026-01-01T13:00:00Z",
            "3",
            "Llamado anterior"
          ),
        ],
      },
      {
        start: "2026-01-01T12:30:00Z",
        end: "2026-01-01T12:40:00Z",
        symptom_id: -11,
        symptom_name: "Detención no autorizada",
        current: false,
        closed_at: "2026-01-01T12:40:00Z",
        conditions_agg: [
          agg(
            -11,
            "Detención no autorizada",
            "2026-01-01T12:30:00Z",
            "2026-01-01T12:40:00Z",
            "2"
          ),
        ],
      },
    ],
  };
}

describe("TimelineComponent with the trip's cases", () => {
  it("lists every case oldest first with the current one marked and expanded", () => {
    const data = header();
    const { container } = render(
      <TimelineComponent
        dict={dict}
        treatmentData={data}
        setSelectedTreatment={vi.fn()}
        setSelectedTreatmentIndex={vi.fn()}
        order="asc"
      />
    );

    const entries = Array.from(
      container.querySelectorAll("p.text-sm.font-medium")
    ).map((p) => p.textContent);
    expect(entries).toEqual([
      "Conducción continua",
      "Detención no autorizada",
      "Conducción continua",
    ]);
    expect(container.querySelectorAll("[data-current='true']")).toHaveLength(1);
    expect(screen.getAllByText("Caso actual")).toHaveLength(1);
    expect(screen.getAllByText("Cerrado")).toHaveLength(2);
    expect(screen.getByText("Llamado actual")).toBeInTheDocument();
    expect(screen.queryByText("Llamado anterior")).not.toBeInTheDocument();
    expect(data.timeline?.[0].symptom_id).toBe(-12);
  });

  it("shows another case's own treatments and selects its step", () => {
    const select = vi.fn();
    render(
      <TimelineComponent
        dict={dict}
        treatmentData={header()}
        setSelectedTreatment={vi.fn()}
        setSelectedTreatmentIndex={select}
        order="asc"
      />
    );

    fireEvent.click(screen.getAllByText("Conducción continua")[0]);
    fireEvent.click(screen.getByText("Llamado anterior"));

    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ symptom_id: -10, icu_code: "3" })
    );
  });
});
