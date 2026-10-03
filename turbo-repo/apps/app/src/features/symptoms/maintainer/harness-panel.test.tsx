import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chat = vi.hoisted(() => ({ openWithMessage: vi.fn() }));
vi.mock("@/features/harness-chat/context/harness-chat-context", () => ({
  useHarnessChatContext: () => chat,
}));
const swr = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("swr", () => swr);

import HarnessPanel from "./harness-panel";

const d = {
  harnessPanelTitle: "Harness",
  harnessPanelSub: "Describe el cambio; tú decides.",
  harnessChangePlaceholder: "Ej.",
  harnessPropose: "Proponer cambios",
  harnessExampleActivation: "Ejemplo: activación",
  harnessExampleActivationText: "Solo camiones pesados",
  harnessExampleLevels: "Ejemplo: niveles",
  harnessExampleLevelsText: "Sube Crítica",
  harnessChangePrompt: "En «{name}» ({id}): {text}",
};

describe("HarnessPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    chat.openWithMessage.mockReset();
    swr.mutate.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("sends the request to the chat with the symptom, then looks for the draft for a while", () => {
    render(<HarnessPanel id="s1" name="Exceso" d={d} />);
    const propose = screen.getByText("Proponer cambios") as HTMLButtonElement;
    expect(propose.disabled).toBe(true);

    fireEvent.click(screen.getByText("Ejemplo: niveles"));
    const box = screen.getByLabelText("Harness") as HTMLTextAreaElement;
    expect(box.value).toBe("Sube Crítica");

    fireEvent.click(propose);
    expect(chat.openWithMessage).toHaveBeenCalledWith(
      "En «Exceso» (s1): Sube Crítica"
    );
    expect(box.value).toBe("");

    vi.advanceTimersByTime(5_000);
    expect(swr.mutate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3 * 60_000);
    const calls = swr.mutate.mock.calls.length;
    vi.advanceTimersByTime(60_000);
    expect(swr.mutate.mock.calls.length).toBe(calls);
  });

  it("sends nothing for a blank request", () => {
    render(<HarnessPanel id="s1" name="Exceso" d={d} />);
    fireEvent.change(screen.getByLabelText("Harness"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByText("Proponer cambios"));
    expect(chat.openWithMessage).not.toHaveBeenCalled();
  });
});
