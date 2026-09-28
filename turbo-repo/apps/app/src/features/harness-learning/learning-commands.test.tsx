import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import en from "@/lang/en.json";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { tr as translate } from "@/features/i18n/tr.service";
import type { TrFn } from "@/features/harness-chat/context/harness-chat-i18n-context";
import { HarnessChatI18nProvider } from "@/features/harness-chat/context/harness-chat-i18n-context";
import { RunCancelProvider } from "@/features/harness-chat/context/run-cancel-context";
import { Composer } from "@/features/harness-chat/components/composer";
import { LEARNING_COMMAND_IDS, learningCommands } from "./learning-commands";

const trOf =
  (dict: unknown): TrFn =>
  (path, params) =>
    translate(path, dict as I18nDictionary, params);

const adapter: ChatModelAdapter = {
  async run() {
    return { content: [{ type: "text", text: "ok" }] };
  },
};

function Runtime({ children }: { children: ReactNode }) {
  const runtime = useLocalRuntime(adapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}

function renderComposer() {
  const commands = learningCommands(trOf(es));
  return render(
    <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
      <Runtime>
        <RunCancelProvider>
          <Composer skills={commands} />
        </RunCancelProvider>
      </Runtime>
    </HarnessChatI18nProvider>
  );
}

function type(text: string) {
  const input = screen.getByLabelText(
    "Pregúntale al harness…"
  ) as HTMLTextAreaElement;
  fireEvent.change(input, {
    target: { value: text, selectionStart: text.length },
  });
  input.setSelectionRange(text.length, text.length);
  fireEvent.select(input);
  return input;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response(JSON.stringify({ default: null, models: [] }))
    )
  );
});

describe("learningCommands", () => {
  it("offers every learning command, the playbooks included, in both languages", () => {
    for (const dict of [es, en]) {
      const commands = learningCommands(trOf(dict));
      expect(commands.map((c) => c.id)).toEqual([...LEARNING_COMMAND_IDS]);
      expect(commands.map((c) => c.id)).toEqual(
        expect.arrayContaining([
          "skill-creator",
          "skill-doctor",
          "review",
          "eval",
          "layers",
          "diff",
        ])
      );
      for (const command of commands) {
        expect(command.description).not.toMatch(/^harnessChat\./);
      }
    }
  });

  it("gives commands with an argument their usage and leaves it out otherwise", () => {
    const commands = learningCommands(trOf(es));
    expect(commands.find((c) => c.id === "eval")?.usage).toBe(
      "<pregunta> => <respuesta esperada>"
    );
    expect(commands.find((c) => c.id === "layers")?.usage).toBeUndefined();
  });

  it("keeps a skill that does not clash with a command", () => {
    const commands = learningCommands(trOf(en), [
      { id: "review", label: "review", description: "clash" },
      { id: "trips", label: "trips", description: "Trips" },
    ]);
    expect(commands.filter((c) => c.id === "review")).toHaveLength(1);
    expect(commands.at(-1)?.id).toBe("trips");
  });
});

describe("the composer's slash menu in a learning session", () => {
  it("lists the learning commands with their descriptions when / is typed", () => {
    renderComposer();
    type("/");
    expect(screen.getByText("/skill-creator")).toBeTruthy();
    expect(screen.getByText("/skill-doctor")).toBeTruthy();
    expect(
      screen.getByText(
        "Revisa una conversación pasada y propone cambios y casos de evaluación."
      )
    ).toBeTruthy();
    expect(screen.getByText("<enlace o id>")).toBeTruthy();
  });

  it("narrows the list as the command is typed and inserts the pick", async () => {
    renderComposer();
    const input = type("/skill-d");
    expect(screen.queryByText("/fact")).toBeNull();
    fireEvent.click(screen.getByText("/skill-doctor"));
    await waitFor(() => expect(input.value).toBe("/skill-doctor "));
  });

  it("picks the highlighted command with the keyboard", async () => {
    renderComposer();
    const input = type("/ev");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(input.value).toBe("/eval "));
  });
});
