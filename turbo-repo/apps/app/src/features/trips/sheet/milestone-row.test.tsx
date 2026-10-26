import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TripMilestone } from "../milestones/milestones-api";
import { MilestoneRow } from "./milestone-row";

const confirm = vi.fn();
const reject = vi.fn();

vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
  trDynamic: (key: string) => key,
}));
vi.mock("../monitors/monitors-api", () => ({ tripsRequest: vi.fn() }));
vi.mock("./sheet-api", () => ({
  confirm: (...args: unknown[]) => confirm(...args),
  reject: (...args: unknown[]) => reject(...args),
}));

function milestone(patch: Partial<TripMilestone> = {}): TripMilestone {
  return {
    tripId: "11111111-1111-1111-1111-111111111111",
    milestone: "departure",
    status: "pending",
    source: "gps",
    proposedAt: "2026-10-25T08:32:00Z",
    evidence: {},
    confirmedAt: null,
    confirmedBy: null,
    channel: null,
    ...patch,
  };
}

function row(m: TripMilestone, canConfirm = true) {
  return render(
    <MilestoneRow
      m={m}
      planned={null}
      canConfirm={canConfirm}
      d={{}}
      lang="en"
    />
  );
}

describe("a trip milestone", () => {
  beforeEach(() => {
    confirm.mockReset().mockResolvedValue(undefined);
    reject.mockReset().mockResolvedValue(undefined);
  });

  it("confirms or rejects a pending detection", async () => {
    const m = milestone();
    row(m);
    fireEvent.click(screen.getByText("sheet.confirm"));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(m, null));
    fireEvent.click(screen.getByText("sheet.reject"));
    await waitFor(() => expect(reject).toHaveBeenCalledWith(m, null));
  });

  it("records an open milestone at the time given", async () => {
    const m = milestone({ status: "open", source: null, proposedAt: null });
    row(m);
    expect(screen.queryByText("sheet.confirm")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("sheet.recordAt"), {
      target: { value: "2026-10-25T10:15" },
    });
    fireEvent.click(screen.getByText("sheet.record"));
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(
        m,
        new Date("2026-10-25T10:15").toISOString()
      )
    );
  });

  it("shows no actions without the permission or once confirmed", () => {
    const { unmount } = row(milestone(), false);
    expect(screen.queryByText("sheet.confirm")).not.toBeInTheDocument();
    unmount();
    row(
      milestone({
        status: "confirmed",
        confirmedAt: "2026-10-25T09:00:00Z",
        channel: "feed",
      })
    );
    expect(screen.queryByText("sheet.record")).not.toBeInTheDocument();
    expect(screen.getByText("milestoneStatus.confirmed")).toBeInTheDocument();
  });

  it("shows the API's refusal", async () => {
    confirm.mockRejectedValueOnce(new Error("departure is not confirmed"));
    row(milestone({ milestone: "arrival", status: "open" }));
    fireEvent.click(screen.getByText("sheet.record"));
    expect(
      await screen.findByText("departure is not confirmed")
    ).toBeInTheDocument();
  });
});
