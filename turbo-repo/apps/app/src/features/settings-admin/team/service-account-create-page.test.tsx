import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./module-access", async (original) => ({
  ...(await original<typeof import("./module-access")>()),
  DetailShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./team-api", () => ({
  useAccessCatalog: () => ({
    data: { baseRoles: [], permissions: [], roles: [] },
  }),
  useTeamAccess: () => ({
    access: { baseRole: null, permissions: [] },
    can: () => false,
  }),
  createServiceAccount: vi.fn(),
}));

import ServiceAccountCreatePage from "./service-account-create-page";

describe("root service-account affordance", () => {
  it("hides the form when the caller cannot manage root API keys", () => {
    render(
      <ServiceAccountCreatePage
        dict={en.pages.userSettings as unknown as I18nRecord}
        lang="en"
      />
    );
    expect(
      screen.getByText(en.pages.userSettings.team.noAccess)
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
