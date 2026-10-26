import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  nextStep,
  proofHref,
  type Delivery,
  type TripDeliveries,
} from "./deliveries-api";
import { DeliveriesPanel } from "./deliveries-panel";

vi.mock("@/features/i18n/tr.service", () => ({
  trDynamic: (key: string) => key,
  tr: (key: string, _d: unknown, vars?: Record<string, string>) =>
    vars ? `${key} ${Object.values(vars).join("/")}` : key,
}));
vi.mock("../monitors/monitors-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../monitors/monitors-api")>()),
  useTripsPermission: () => true,
}));

const TRIP = "11111111-1111-1111-1111-111111111111";

function step(name: "delivered" | "settled", status: string) {
  return {
    step: name,
    status,
    source: null,
    proposedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    channel: null,
    note: null,
  } as Delivery["steps"][number];
}

const delivery: Delivery = {
  id: "22222222-2222-2222-2222-222222222222",
  reference: "R-1",
  customer: "Customer A",
  source: "api",
  mandates: [{ id: "m1", code: "SAMPLE-1" }],
  steps: [step("delivered", "pending"), step("settled", "open")],
  proofs: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      kind: "signature",
      contentId: "44444444-4444-4444-4444-444444444444",
      url: null,
      name: "manifest.pdf",
      mimetype: "application/pdf",
      source: "ui",
      receivedAt: "2026-10-26T10:00:00Z",
      receivedBy: "ops@example.com",
    },
  ],
  createdAt: "2026-10-26T09:00:00Z",
};

describe("trip deliveries", () => {
  it("acts on the first step not confirmed, once the one before it is", () => {
    expect(nextStep(delivery)?.step).toBe("delivered");
    expect(
      nextStep({
        ...delivery,
        steps: [step("delivered", "confirmed"), step("settled", "open")],
      })?.step
    ).toBe("settled");
    expect(
      nextStep({
        ...delivery,
        steps: [step("delivered", "confirmed"), step("settled", "confirmed")],
      })
    ).toBeNull();
  });

  it("opens a stored proof through the app and a link as it came", () => {
    expect(proofHref(TRIP, delivery.proofs[0])).toBe(
      `/api/trips/proofs/content?trip=${TRIP}&proof=${delivery.proofs[0].id}`
    );
    expect(
      proofHref(TRIP, {
        ...delivery.proofs[0],
        contentId: null,
        url: "https://example.com/pod.jpg",
      })
    ).toBe("https://example.com/pod.jpg");
  });

  it("shows each delivery's loads, steps and proofs, and the loads left", () => {
    const data: TripDeliveries = {
      cycle: {
        steps: ["delivered", "settled"],
        completesTrip: "settled",
        proofRequired: true,
        confirmOnProof: false,
      },
      deliveries: [delivery],
      uncovered: [{ id: "m2", code: "SAMPLE-2" }],
    };
    render(<DeliveriesPanel tripId={TRIP} data={data} d={{}} lang="en" />);

    expect(screen.getByText("Customer A")).toBeInTheDocument();
    expect(screen.getByText("SAMPLE-1")).toBeInTheDocument();
    expect(screen.getByText("manifest.pdf")).toHaveAttribute(
      "href",
      expect.stringContaining("/api/trips/proofs/content?")
    );
    expect(
      screen.getByText("sheet.deliveries.pendingLoads SAMPLE-2")
    ).toBeInTheDocument();
    expect(
      screen.getByText("sheet.deliveries.completes lanes.settled", {
        exact: false,
      })
    ).toBeInTheDocument();
    expect(screen.getByText("sheet.reject")).toBeInTheDocument();
    expect(screen.getByText("sheet.deliveries.new")).toBeInTheDocument();
  });
});
