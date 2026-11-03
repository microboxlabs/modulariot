import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import en from "@/lang/en.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { OfflineBadge, offlineText } from "./fleet-ui";

// the header pulls in the dashboard packages; the badge does not need it
vi.mock("@/features/layout/components/section-header/section-header", () => ({
  SectionHeader: () => null,
}));

const esFleet = (es as unknown as { pages: { fleet: I18nRecord } }).pages.fleet;
const enFleet = (en as unknown as { pages: { fleet: I18nRecord } }).pages.fleet;
const NOW = Date.parse("2026-11-03T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("offlineText", () => {
  it("tells minutes up to 90, then hours, in both languages", () => {
    const at = (m: number) => ({
      state: "offline" as const,
      offline_since: ago(m),
    });
    expect(offlineText(at(45), esFleet, NOW)).toBe("Sin señal · hace 45 min");
    expect(offlineText(at(45), enFleet, NOW)).toBe("No signal · 45 min ago");
    expect(offlineText(at(200), esFleet, NOW)).toBe("Sin señal · hace 3 h");
  });

  it("is nothing while online or unknown", () => {
    expect(offlineText({ state: "online" }, esFleet, NOW)).toBeNull();
    expect(offlineText({ state: "unknown" }, esFleet, NOW)).toBeNull();
    expect(offlineText(undefined, esFleet, NOW)).toBeNull();
  });
});

describe("OfflineBadge", () => {
  it("does not use a stale detector profile to mark a newer fleet position offline", () => {
    const frame = ago(5);
    const signal = {
      state: "offline" as const,
      offline_since: frame,
      last_frame_at: frame,
    };
    const { rerender } = render(
      <OfflineBadge signal={signal} lastSignalAt={ago(1)} d={esFleet} />
    );
    expect(document.querySelector("[data-signal-offline]")).toBeNull();
    rerender(<OfflineBadge signal={signal} lastSignalAt={frame} d={esFleet} />);
    expect(document.querySelector("[data-signal-offline]")).not.toBeNull();
  });
  it("shows a badge only for an offline vehicle", () => {
    const { rerender } = render(
      <OfflineBadge
        signal={{ state: "offline", offline_since: ago(5) }}
        d={esFleet}
      />
    );
    expect(document.querySelector("[data-signal-offline]")).toHaveTextContent(
      "Sin señal · hace 5 min"
    );
    rerender(<OfflineBadge signal={{ state: "online" }} d={esFleet} />);
    expect(document.querySelector("[data-signal-offline]")).toBeNull();
  });
});
