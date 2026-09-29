import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import en from "@/lang/en.json";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import SelectablesPageContent from "./selectables-page-content";

const role = vi.hoisted(() => ({ current: "MEMBER" }));

vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({ useOrgScopes: () => ({ activeOrg: { role: role.current } }) })
);
vi.mock("../selectables/store", () => ({
  useSelectables: () => ({
    selectables: [
      {
        key: "delay_reason",
        name: { en: "Delay reason" },
        description: {},
        mode: "SINGLE",
        settings: {},
        groups: [],
        source: { kind: "STATIC" },
        options: [],
      },
    ],
    hydrated: true,
    save: vi.fn(),
    remove: vi.fn(),
    resetToDefaults: vi.fn(),
  }),
}));
vi.mock("../selectables/selectables-api", () => ({
  useSelectableSources: () => ({ data: [] }),
}));
vi.mock("../selectables/editor/selectable-editor-modal", () => ({
  default: () => null,
}));

const dict = en.pages.userSettings as unknown as I18nRecord;
const actions = [
  /Restore defaults/,
  /New selectable/,
  /Edit/,
  /Duplicate/,
  /Delete/,
];

describe("SelectablesPageContent", () => {
  it("shows a member the lists without the actions only an owner can take", () => {
    role.current = "MEMBER";
    render(<SelectablesPageContent dict={dict} lang="en" />);

    expect(screen.getByText("Delay reason")).toBeInTheDocument();
    for (const name of actions) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("gives an owner every action", () => {
    role.current = "OWNER";
    render(<SelectablesPageContent dict={dict} lang="en" />);

    for (const name of actions) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });
});
