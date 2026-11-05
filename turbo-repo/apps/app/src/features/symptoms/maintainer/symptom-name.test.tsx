import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateIdentity: vi.fn(),
  refreshSymptoms: vi.fn(),
  toastError: vi.fn(),
  scope: { kind: "org", defs: "/defs" },
}));

vi.mock("./maintainer-api", () => ({
  updateIdentity: mocks.updateIdentity,
  refreshSymptoms: mocks.refreshSymptoms,
}));
vi.mock("./symptom-scope", () => ({ useSymptomScope: () => mocks.scope }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import SymptomName from "./symptom-name";

const d = {
  renameSymptom: "Renombrar síntoma",
  clickToRename: "Clic para renombrar",
  renamingSymptom: "Renombrando…",
  renameSymptomFailed: "No se pudo renombrar el síntoma.",
};

function show(canRename = true) {
  return render(
    <SymptomName
      id="s1"
      name="Exceso de velocidad"
      canRename={canRename}
      d={d}
    />
  );
}

function edit() {
  fireEvent.click(screen.getByRole("button", { name: /Renombrar síntoma/ }));
  return screen.getByRole("textbox", { name: "Renombrar síntoma" });
}

describe("SymptomName", () => {
  beforeEach(() => {
    mocks.updateIdentity.mockReset().mockResolvedValue({});
    mocks.refreshSymptoms.mockReset().mockResolvedValue(undefined);
    mocks.toastError.mockReset();
  });

  it("shows the name only, without the pencil, to who cannot edit", () => {
    show(false);
    expect(
      screen.getByRole("heading", { name: "Exceso de velocidad" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("saves the trimmed name on Enter and refreshes the symptom and the list", async () => {
    const { rerender } = show();
    const input = edit();
    fireEvent.change(input, { target: { value: "  Velocidad alta  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Renombrando…")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.refreshSymptoms).toHaveBeenCalledWith("s1", mocks.scope)
    );
    expect(mocks.updateIdentity).toHaveBeenCalledTimes(1);
    expect(mocks.updateIdentity).toHaveBeenCalledWith(
      "s1",
      { name: "Velocidad alta" },
      mocks.scope
    );
    rerender(
      <SymptomName id="s1" name="Velocidad alta" canRename={true} d={d} />
    );
    expect(screen.getByRole("heading")).toHaveTextContent("Velocidad alta");
  });

  it("saves on blur", async () => {
    show();
    const input = edit();
    fireEvent.change(input, { target: { value: "Velocidad alta" } });
    fireEvent.blur(input);
    await waitFor(() => expect(mocks.updateIdentity).toHaveBeenCalledTimes(1));
  });

  it("returns focus after a keyboard save finishes", async () => {
    let finishSave: () => void = () => {};
    mocks.updateIdentity.mockImplementation(
      () => new Promise<void>((resolve) => (finishSave = resolve))
    );
    show();
    const input = edit();
    fireEvent.change(input, { target: { value: "Velocidad alta" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).not.toHaveFocus();
    await act(async () => finishSave());
    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("keeps focus on the next control when saving on blur", async () => {
    show();
    render(<button type="button">Next</button>);
    const input = edit();
    fireEvent.change(input, { target: { value: "Velocidad alta" } });
    const next = screen.getByRole("button", { name: "Next" });
    act(() => next.focus());
    await waitFor(() => expect(mocks.refreshSymptoms).toHaveBeenCalledTimes(1));
    expect(next).toHaveFocus();
  });

  it.each(["Enter", "Escape"])(
    "ignores %s while composing with an IME",
    (key) => {
      show();
      const input = edit();
      fireEvent.change(input, { target: { value: "速度" } });
      fireEvent.keyDown(input, { key, isComposing: true });
      expect(input).toHaveFocus();
      expect(mocks.updateIdentity).not.toHaveBeenCalled();
      fireEvent.keyDown(input, { key: "Escape" });
      expect(screen.queryByRole("textbox")).toBeNull();
    }
  );

  it.each([995, 1005])(
    "ignores an IME confirmation delivered after compositionend at %i ms",
    async (timeStamp) => {
      show();
      const input = edit();
      fireEvent.change(input, { target: { value: "速度" } });
      const end = createEvent.compositionEnd(input);
      Object.defineProperty(end, "timeStamp", { value: 1000 });
      fireEvent(input, end);
      const confirm = createEvent.keyDown(input, { key: "Enter" });
      Object.defineProperty(confirm, "timeStamp", { value: timeStamp });
      fireEvent(input, confirm);
      expect(confirm.defaultPrevented).toBe(true);
      expect(input).toHaveFocus();
      expect(mocks.updateIdentity).not.toHaveBeenCalled();

      const save = createEvent.keyDown(input, { key: "Enter" });
      Object.defineProperty(save, "timeStamp", { value: 1100 });
      fireEvent(input, save);
      await waitFor(() =>
        expect(mocks.updateIdentity).toHaveBeenCalledTimes(1)
      );
    }
  );

  it("cancels on Escape", () => {
    show();
    const input = edit();
    fireEvent.change(input, { target: { value: "Otro" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Exceso de velocidad")).toBeInTheDocument();
    expect(mocks.updateIdentity).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("refuses an empty or unchanged name", () => {
    show();
    let input = edit();
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    input = edit();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.updateIdentity).not.toHaveBeenCalled();
    expect(screen.getByText("Exceso de velocidad")).toBeInTheDocument();
  });

  it("puts the name back and shows a toast when saving fails", async () => {
    mocks.updateIdentity.mockRejectedValue(new Error("409"));
    show();
    const input = edit();
    fireEvent.change(input, { target: { value: "Velocidad alta" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "No se pudo renombrar el síntoma."
      )
    );
    expect(screen.getByText("Exceso de velocidad")).toBeInTheDocument();
    expect(mocks.refreshSymptoms).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("keeps a confirmed name when refreshing fails", async () => {
    const { rerender } = show();
    mocks.updateIdentity.mockImplementation(async () => {
      rerender(
        <SymptomName id="s1" name="Velocidad alta" canRename={true} d={d} />
      );
      return { name: "Velocidad alta" };
    });
    mocks.refreshSymptoms.mockRejectedValue(new Error("503"));
    const input = edit();
    fireEvent.change(input, { target: { value: "Velocidad alta" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
    expect(screen.getByRole("heading")).toHaveTextContent("Velocidad alta");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
