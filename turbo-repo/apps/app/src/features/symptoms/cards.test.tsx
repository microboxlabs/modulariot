import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import SymptomsCards from "./cards";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useSymptoms: () => ({
    symptoms: { codeBlack: 0, critic: 1 },
    loading: false,
    error: null,
  }),
}));

const dict = { symptoms: { symptoms: "Síntomas" } } as unknown as I18nRecord;

describe("SymptomsCards", () => {
  it("renders the tray header without the settings cog", () => {
    render(<SymptomsCards showCards dict={dict} />);

    const heading = screen.getByRole("heading", { level: 1, name: "Síntomas" });
    const headerRow = heading.parentElement as HTMLElement;

    expect(within(headerRow).queryByRole("button")).not.toBeInTheDocument();
    expect(headerRow.querySelector("svg")).toBeNull();
  });
});
