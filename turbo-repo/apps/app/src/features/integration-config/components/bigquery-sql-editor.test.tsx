import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import { BigQueryQueriesModal } from "./bigquery-queries-modal";
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const dict = en.pages.integrationConnections;
afterEach(() => vi.unstubAllGlobals());
describe("BigQuery modal with the real SQL editor", () => {
  it("makes CodeMirror read-only for the complete pending save", async () => {
    let resolve!: (value: Response) => void;
    const pending = new Promise<Response>((done) => {
      resolve = done;
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (_input, init) =>
        init?.method === "POST" ? pending : Response.json([])
      );
    vi.stubGlobal("fetch", fetcher);
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <BigQueryQueriesModal
          orgSlug="demo"
          connection={{
            id: "demo-source",
            name: "Demo",
            providerType: "CUSTOM_HTTP",
            baseUrl: "https://bigquery.googleapis.com",
            credentialProfileId: "demo-google",
            status: "ACTIVE",
            lastTestedAt: null,
            lastTestResult: null,
            templateId: null,
            metadata: {},
          }}
          defaultProjectId="demo-project"
          onClose={vi.fn()}
          dict={dict}
        />
      </SWRConfig>
    );
    fireEvent.click(
      await screen.findByRole("button", { name: dict.bigquery.add })
    );
    fireEvent.change(screen.getByLabelText(dict.bigquery.name), {
      target: { value: "Demo query" },
    });
    const content = document.querySelector(".cm-content") as HTMLElement;
    const view = EditorView.findFromDOM(content)!;
    act(() => view.dispatch({ changes: { from: 0, insert: "SELECT 1" } }));
    fireEvent.click(screen.getByRole("button", { name: dict.bigquery.save }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([, init]) => init?.method === "POST")
      ).toBe(true)
    );
    expect(content).toHaveAttribute("contenteditable", "false");
    expect(view.state.facet(EditorState.readOnly)).toBe(true);
    await act(async () =>
      resolve(Response.json({ id: "demo-plan" }, { status: 201 }))
    );
    expect(
      await screen.findByRole("button", { name: dict.bigquery.add })
    ).toBeEnabled();
  });
});
