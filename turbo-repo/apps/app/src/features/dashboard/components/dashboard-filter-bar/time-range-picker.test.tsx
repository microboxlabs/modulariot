import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import TimeRangePicker from "./time-range-picker";

// The dictionary is only used for labels; echo the key back so we can target buttons.
vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key.split(".").pop() ?? key,
}));

const DICTIONARY = {};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-26T15:30:00"));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("TimeRangePicker in date mode", () => {
  it("emits full-day bounds for the 'today' quick range", () => {
    const onDateChange = vi.fn();
    render(
      <TimeRangePicker
        dictionary={DICTIONARY}
        mode="date"
        ranges="date"
        onDateChange={onDateChange}
      />
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByText("today"));

    expect(onDateChange).toHaveBeenCalledWith(
      "2026-08-26 00:00:00",
      "2026-08-26 23:59:59"
    );
  });

  it("emits full-day bounds for the 'yesterday' quick range", () => {
    const onDateChange = vi.fn();
    render(
      <TimeRangePicker
        dictionary={DICTIONARY}
        mode="date"
        ranges="date"
        onDateChange={onDateChange}
      />
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByText("yesterday"));

    expect(onDateChange).toHaveBeenCalledWith(
      "2026-08-25 00:00:00",
      "2026-08-25 23:59:59"
    );
  });

  it("expands a hand-picked date range to full-day bounds on apply", () => {
    const onDateChange = vi.fn();
    render(
      <TimeRangePicker
        dictionary={DICTIONARY}
        mode="date"
        ranges="date"
        from="2026-08-01 00:00:00"
        to="2026-08-05 23:59:59"
        onDateChange={onDateChange}
      />
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    const [fromInput, toInput] = screen.getAllByDisplayValue(/2026-08-0/);
    expect((fromInput as HTMLInputElement).value).toBe("2026-08-01");
    expect((toInput as HTMLInputElement).value).toBe("2026-08-05");

    fireEvent.change(toInput, { target: { value: "2026-08-10" } });
    fireEvent.click(screen.getByText("applyRange"));

    expect(onDateChange).toHaveBeenCalledWith(
      "2026-08-01 00:00:00",
      "2026-08-10 23:59:59"
    );
  });

  it("keeps the range valid when only one edge carries a time", () => {
    const onDateChange = vi.fn();
    render(
      <TimeRangePicker
        dictionary={DICTIONARY}
        mode="date"
        ranges="date"
        from="2026-08-26 00:00:00"
        to="2026-08-26 23:59:59"
        onDateChange={onDateChange}
      />
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    const toInput = screen.getAllByDisplayValue("2026-08-26")[1];
    fireEvent.change(toInput, { target: { value: "2026-08-26" } });

    const apply = screen.getByText("applyRange") as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
    fireEvent.click(apply);
    expect(onDateChange).toHaveBeenCalledWith(
      "2026-08-26 00:00:00",
      "2026-08-26 23:59:59"
    );
  });

  it("leaves datetime mode untouched", () => {
    const onDateChange = vi.fn();
    render(
      <TimeRangePicker
        dictionary={DICTIONARY}
        mode="datetime"
        ranges="time"
        onDateChange={onDateChange}
      />
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByText("lastHour"));

    expect(onDateChange).toHaveBeenCalledWith(
      "2026-08-26 14:30",
      "2026-08-26 15:30"
    );
  });
});
