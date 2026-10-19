import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import type { HarnessSkill } from "@/features/harness-chat/harness-chat-types";

const trainerMock = vi.fn();
const closeChatMock = vi.fn();

vi.mock("@/features/knowledge/hooks/use-knowledge-trainer", () => ({
  useKnowledgeTrainer: () => trainerMock(),
}));

vi.mock("@/features/runtime-config/runtime-config-context", () => ({
  useRuntimeConfig: () => null,
}));

vi.mock("@/features/harness-chat/context/harness-chat-context", () => ({
  useHarnessChatContext: () => ({ close: closeChatMock }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The session's chat itself is the harness chat's; here it only has to show
// which session it was given and how.
vi.mock("@/features/harness-chat/components/session-host", () => ({
  SessionHost: (props: {
    sessionId: string;
    active: boolean;
    learning?: boolean;
    skills: HarnessSkill[];
  }) =>
    props.active ? (
      <div data-testid="session">
        {props.sessionId} {props.learning ? "learning" : "chat"}{" "}
        {props.skills.map((s) => s.id).join(",")}
      </div>
    ) : null,
}));

import LearningWorkspace from "./learning-workspace";

const thread = (id: string, title: string | null) => ({
  id,
  title,
  summary: null,
  model: null,
  ownerId: "trainer@example.test",
  owned: true,
  expiresAt: null,
  lastMessageAt: null,
  createdAt: "2026-09-28T10:00:00Z",
  updatedAt: "2026-09-28T10:00:00Z",
  sharedWith: [],
  kind: "learning",
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  trainerMock.mockReturnValue({ isTrainer: true, isLoading: false });
  closeChatMock.mockClear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/harness/threads?kind=learning")
      return json([thread("t-old", "Loaded trips")]);
    if (url === "/api/harness/threads" && init?.method === "POST") {
      return json(thread(JSON.parse(init.body as string).id, null), 201);
    }
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWorkspace() {
  return render(
    <LearningWorkspace dict={es as unknown as I18nDictionary} locale="es" />
  );
}

describe("LearningWorkspace", () => {
  it("lists learning sessions only and closes the side chat panel", async () => {
    renderWorkspace();
    expect(await screen.findAllByText("Loaded trips")).toBeTruthy();
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "/api/harness/threads?kind=learning"
    );
    expect(closeChatMock).toHaveBeenCalled();
  });

  it("starts with the commands and no chat until a session is opened", async () => {
    renderWorkspace();
    expect(
      await screen.findByText("Enseña algo nuevo al asistente")
    ).toBeTruthy();
    expect(screen.getByText("/skill-creator")).toBeTruthy();
    expect(screen.queryByTestId("session")).toBeNull();
  });

  it("creates the learning thread before its chat opens", async () => {
    renderWorkspace();
    await screen.findAllByText("Loaded trips");
    fireEvent.click(screen.getAllByRole("button", { name: /Nueva sesión/ })[0]);

    const session = await screen.findByTestId("session");
    const post = fetchMock.mock.calls.find(
      ([, init]) => init?.method === "POST"
    )!;
    const body = JSON.parse(post[1].body as string);
    expect(body.kind).toBe("learning");
    expect(session.textContent).toContain(body.id);
    expect(session.textContent).toContain("learning");
    expect(session.textContent).toContain("fact,rule,skill");
  });

  it("says so when the session cannot be created", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      init?.method === "POST" ? json({}, 403) : json([])
    );
    const { toast } = await import("sonner");
    renderWorkspace();
    fireEvent.click(
      (await screen.findAllByRole("button", { name: /Nueva sesión/ }))[0]
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "No se pudo crear la sesión. Inténtalo de nuevo."
      )
    );
    expect(screen.queryByTestId("session")).toBeNull();
  });

  it("opens a stored session", async () => {
    renderWorkspace();
    fireEvent.click((await screen.findAllByText("Loaded trips"))[0]);
    expect((await screen.findByTestId("session")).textContent).toContain(
      "t-old"
    );
  });

  it("opens the working area from the header", async () => {
    renderWorkspace();
    fireEvent.click(
      await screen.findByRole("button", { name: "Área de trabajo" })
    );
    expect(
      screen.getByRole("complementary", { name: "Área de trabajo" })
    ).toBeTruthy();
  });

  it("is for trainers only", () => {
    trainerMock.mockReturnValue({ isTrainer: false, isLoading: false });
    renderWorkspace();
    expect(
      screen.getByText(
        "Solo los entrenadores del asistente pueden usar este espacio."
      )
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
