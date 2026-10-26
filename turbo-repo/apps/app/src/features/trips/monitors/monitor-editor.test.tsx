import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MonitorBody } from "./monitors-api";
import MonitorEditor from "./monitor-editor";

const api = vi.hoisted(() => ({
  save: vi.fn(),
  discard: vi.fn(),
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock("@/features/i18n/tr.service", () => ({ tr: (key: string) => key }));
vi.mock("@/features/common/components/Breadcrumb/Breadcrumb", () => ({
  Breadcrumb: () => null,
}));
vi.mock(
  "@/features/common/components/confirmation-modal/confirmation-modal",
  () => ({
    default: ({
      isOpen,
      onConfirm,
    }: {
      isOpen: boolean;
      onConfirm: () => void;
    }) => (isOpen ? <button onClick={onConfirm}>confirm</button> : null),
  })
);
vi.mock("./plan-params", () => ({
  PlanEditor: () => null,
  ParamsEditor: () => null,
}));
vi.mock("./rule-card", () => ({ default: () => null }));
vi.mock("./confirmers-panel", () => ({ ConfirmersPanel: () => null }));
vi.mock("./monitors-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./monitors-api")>()),
  useCanEditMonitors: () => true,
  useMonitor: () => ({ data: detail, isLoading: false }),
  saveDraft: (key: string, body: MonitorBody) => api.save(key, body),
  discardDraft: (...args: string[]) => api.discard(...args),
}));
const draft = {
  key: "test",
  version: 1,
  status: "draft",
  name: "Test monitor",
  description: null,
  plan: [],
  params: {},
  rules: [],
  findings: [],
  updatedAt: null,
  updatedBy: null,
  publishedAt: null,
  publishedBy: null,
};
const detail = { draft, published: null, versions: [] };

describe("monitor editor mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("locks editing while a save is pending", async () => {
    let finish: () => void = () => {};
    api.save.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    render(<MonitorEditor monitorKey="test" dict={{}} lang="en" />);
    const name = await screen.findByRole("textbox", { name: "name" });
    fireEvent.change(name, { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "saveDraft" }));
    expect(name).toBeDisabled();
    expect(screen.getByRole("button", { name: "addRule" })).toBeDisabled();
    await act(async () => finish());
    await waitFor(() => expect(name).toBeEnabled());
  });

  it("stays in the editor when discarding fails", async () => {
    api.discard.mockRejectedValue(new Error("Discard failed"));
    render(<MonitorEditor monitorKey="test" dict={{}} lang="en" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "discardDraft" })
    );
    fireEvent.click(screen.getByRole("button", { name: "confirm" }));
    expect(await screen.findByText("Discard failed")).toBeInTheDocument();
    expect(api.push).not.toHaveBeenCalled();
  });
});
