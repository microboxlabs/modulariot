import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import dict from "@/lang/es.json";
import SymptomsCard from "./symptoms-card";

vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const task = { mintral_serviceCode: "SVC-100" } as unknown as TaskResponse;

const engineAnswer = {
  trip: "SVC-100",
  symptoms: [
    {
      definition_id: "def-speed",
      symptom_key: "speeding",
      name: "Exceso de velocidad",
      family: "driving_safety",
      icon: "SPEED LIMIT STANDARD",
      cases: 0,
      open_cases: 0,
      max_level: 0,
      max_condition: null,
      trip_id: null,
      first_opened_at: null,
      last_opened_at: null,
    },
    {
      definition_id: "def-signal",
      symptom_key: "signal-loss",
      name: "Pérdida de señal",
      family: "signal_continuity",
      icon: null,
      cases: 3,
      open_cases: 1,
      max_level: 4,
      max_condition: "CODE BLACK",
      trip_id: "trip-1",
      first_opened_at: "2026-01-01T08:00:00Z",
      last_opened_at: "2026-01-01T10:00:00Z",
    },
  ],
};

function respond(body: unknown) {
  const fetchMock = vi.fn(async () => Response.json(body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function row(name: string): HTMLElement {
  return screen.getByText(name, { selector: "span" }).parentElement!;
}

describe("SymptomsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists the engine's symptoms with their cases on the trip", async () => {
    const fetchMock = respond(engineAnswer);
    render(<SymptomsCard task={task} dict={dict as unknown as I18nRecord} />);

    await waitFor(() =>
      expect(within(row("Pérdida de señal")).getByText("03")).toBeVisible()
    );
    expect(fetchMock).toHaveBeenCalledWith("/app/api/symptoms/trip?id=SVC-100");
    expect(within(row("Exceso de velocidad")).getByText("00")).toBeVisible();
    expect(
      within(row("Pérdida de señal")).getByAltText("code black")
    ).toBeVisible();
    expect(
      within(row("Exceso de velocidad")).queryByRole("img", {
        name: /condition|black/,
      })
    ).toBeNull();

    const link = screen.getByTestId("symptom-link-def-signal");
    const url = new URL(link.getAttribute("href")!, "http://x");
    expect(url.pathname).toBe("/es/symptoms");
    expect(url.searchParams.get("trip_id")).toBe("trip-1");
    expect(url.searchParams.get("symptom_name")).toBe("Pérdida de señal");
    expect(screen.queryByTestId("symptom-link-def-speed")).toBeNull();
    expect(screen.getAllByText(/^\d\d$/)).toHaveLength(2);
  });

  it("shows no rows for an answer without symptoms", async () => {
    const fetchMock = respond([{ "Stay Risk": { total_symptoms: 2 } }]);
    render(<SymptomsCard task={task} dict={dict as unknown as I18nRecord} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryAllByText(/^\d\d$/)).toHaveLength(0);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
