import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishPlan } from "./maintainer-api";

const api = vi.hoisted(() => ({
  publishPlan: vi.fn(),
  publishDraft: vi.fn(),
}));
vi.mock("./maintainer-api", () => api);

import PublishDialog from "./publish-dialog";
import {
  ORG_SYMPTOMS,
  PLATFORM_TEMPLATES,
  SymptomScopeProvider,
} from "./symptom-scope";

const d = {
  publishOf: "Publicar · {name}",
  raiseTo: "Subir a",
  raiseAuto: "automático",
  bumpMajor: "MAYOR",
  bumpMinor: "MENOR",
  bumpPatch: "PARCHE",
  publishVersion: "Publicar {version}",
  reasonForHistory: "Motivo",
  errorsBlockPublish: "{count} error(es) impiden publicar",
  cancel: "Cancelar",
};

function plan(patch: Partial<PublishPlan> = {}): PublishPlan {
  return {
    changes: [
      { section: "levels", bump: "MINOR", text: "Cambió el umbral de Crítica" },
    ],
    bump: "MINOR",
    nextVersion: "0.4.0",
    report: { publishable: true, findings: [] },
    ...patch,
  } as PublishPlan;
}

function open(current: string | null) {
  const onPublished = vi.fn();
  render(
    <PublishDialog
      id="s1"
      name="Exceso de velocidad"
      current={current}
      open
      d={d}
      onClose={vi.fn()}
      onPublished={onPublished}
    />
  );
  return onPublished;
}

describe("PublishDialog", () => {
  beforeEach(() => {
    api.publishPlan.mockReset();
    api.publishDraft.mockReset();
  });

  it("offers only higher bumps and publishes the one chosen", async () => {
    api.publishPlan.mockResolvedValue(plan());
    const version = { version: "1.0.0", status: "PUBLISHED" };
    api.publishDraft.mockResolvedValue(version);
    const onPublished = open("0.3.0");

    const raise = (await screen.findByLabelText(
      "Subir a"
    )) as HTMLSelectElement;
    expect([...raise.options].map((o) => o.textContent)).toEqual([
      "automático",
      "MAYOR",
    ]);
    expect(
      screen.getByRole("button", { name: "Publicar 0.4.0" })
    ).toBeDisabled();

    fireEvent.change(raise, { target: { value: "MAJOR" } });
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "Acuerdo" },
    });
    const publish = screen.getByRole("button", { name: "Publicar 1.0.0" });
    expect(publish).toBeEnabled();
    fireEvent.click(publish);

    await waitFor(() => expect(onPublished).toHaveBeenCalledWith(version));
    expect(api.publishDraft).toHaveBeenCalledWith(
      "s1",
      { reason: "Acuerdo", bump: "MAJOR" },
      ORG_SYMPTOMS
    );
  });

  it("sends the plan's bump when nothing is raised", async () => {
    api.publishPlan.mockResolvedValue(plan());
    api.publishDraft.mockResolvedValue({});
    open("0.3.0");
    fireEvent.change(await screen.findByLabelText("Motivo"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar 0.4.0" }));
    await waitFor(() =>
      expect(api.publishDraft).toHaveBeenCalledWith(
        "s1",
        { reason: "x", bump: "MINOR" },
        ORG_SYMPTOMS
      )
    );
  });

  it("plans and publishes a template under the platform scope", async () => {
    api.publishPlan.mockResolvedValue(plan());
    api.publishDraft.mockResolvedValue({});
    render(
      <SymptomScopeProvider value={PLATFORM_TEMPLATES}>
        <PublishDialog
          id="t1"
          name="Exceso de velocidad"
          current="0.3.0"
          open
          d={d}
          onClose={vi.fn()}
          onPublished={vi.fn()}
        />
      </SymptomScopeProvider>
    );
    fireEvent.change(await screen.findByLabelText("Motivo"), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar 0.4.0" }));
    await waitFor(() =>
      expect(api.publishDraft).toHaveBeenCalledWith(
        "t1",
        { reason: "x", bump: "MINOR" },
        PLATFORM_TEMPLATES
      )
    );
    expect(api.publishPlan).toHaveBeenCalledWith("t1", PLATFORM_TEMPLATES);
  });

  it("has nothing to raise before the first version", async () => {
    api.publishPlan.mockResolvedValue(
      plan({ bump: "MAJOR", nextVersion: "1.0.0" })
    );
    open(null);
    await screen.findByRole("button", { name: "Publicar 1.0.0" });
    expect(screen.queryByLabelText("Subir a")).toBeNull();
  });

  it("blocks publishing while the review has errors", async () => {
    api.publishPlan.mockResolvedValue(
      plan({
        report: {
          publishable: false,
          findings: [
            {
              section: "levels",
              severity: "ERROR",
              message: "solapan",
              position: -1,
            },
          ],
        },
      } as Partial<PublishPlan>)
    );
    open("0.3.0");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "1 error(es) impiden publicar"
    );
    fireEvent.change(screen.getByLabelText("Motivo"), {
      target: { value: "x" },
    });
    expect(
      screen.getByRole("button", { name: "Publicar 0.4.0" })
    ).toBeDisabled();
  });
});
