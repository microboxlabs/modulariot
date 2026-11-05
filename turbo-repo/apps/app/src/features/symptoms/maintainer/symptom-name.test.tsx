import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  render(
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
    show();
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
  });

  it("saves on blur", async () => {
    show();
    const input = edit();
    fireEvent.change(input, { target: { value: "Velocidad alta" } });
    fireEvent.blur(input);
    await waitFor(() => expect(mocks.updateIdentity).toHaveBeenCalledTimes(1));
  });

  it("cancels on Escape", () => {
    show();
    const input = edit();
    fireEvent.change(input, { target: { value: "Otro" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Exceso de velocidad")).toBeInTheDocument();
    expect(mocks.updateIdentity).not.toHaveBeenCalled();
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
  });
});
