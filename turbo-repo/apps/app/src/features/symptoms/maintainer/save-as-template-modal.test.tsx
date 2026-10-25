import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ControlTowerError } from "../control-tower/control-tower-api";
import type { SymptomDefinition, SymptomTemplate } from "./maintainer-api";

const api = vi.hoisted(() => ({
  saveAsTemplate: vi.fn(),
  useSymptomTemplates: vi.fn(),
}));
vi.mock("./maintainer-api", () => api);

import SaveAsTemplateModal, {
  saveAsTemplateError,
} from "./save-as-template-modal";

const d = {
  saveAsTemplate: "Guardar como plantilla",
  templateTarget: "Plantilla",
  templateTargetNew: "Plantilla nueva ({key})",
  name: "Nombre",
  cancel: "Cancelar",
  unpublished: "sin publicar",
  saveAsTemplateNewHint: "nueva desde {version}",
  saveAsTemplateReplaceHint: "reemplaza {name} con {version}",
  saveAsTemplateForbidden: "solo plataforma",
  saveAsTemplateConflict: "clave tomada",
  actionFailed: "falló",
};

const def = {
  id: "s1",
  key: "exceso-velocidad",
  name: "Exceso de velocidad",
  templateKey: null,
} as SymptomDefinition;

const speeding = {
  key: "speeding",
  name: "Exceso de velocidad (plantilla)",
  version: "1.0.0",
} as SymptomTemplate;

function open(symptom: SymptomDefinition) {
  const onSaved = vi.fn();
  render(
    <SaveAsTemplateModal
      open
      def={symptom}
      version="2.1.0"
      d={d}
      onClose={vi.fn()}
      onSaved={onSaved}
    />
  );
  return onSaved;
}

describe("SaveAsTemplateModal", () => {
  beforeEach(() => {
    api.saveAsTemplate.mockReset();
    api.useSymptomTemplates.mockReturnValue({ data: [speeding] });
  });

  it("creates a new template from the version on screen", async () => {
    api.saveAsTemplate.mockResolvedValue({ definition: { id: "t2" } });
    const onSaved = open(def);

    expect(screen.getByText("nueva desde 2.1.0")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar como plantilla" })
    );

    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith({ definition: { id: "t2" } })
    );
    expect(api.saveAsTemplate).toHaveBeenCalledWith("s1", {
      version: "2.1.0",
      templateKey: null,
      name: "Exceso de velocidad",
    });
  });

  it("saves back to the template the symptom came from", async () => {
    api.saveAsTemplate.mockResolvedValue({ definition: { id: "t1" } });
    open({ ...def, templateKey: "speeding" });

    expect(
      screen.getByText("reemplaza Exceso de velocidad (plantilla) con 2.1.0")
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar como plantilla" })
    );

    await waitFor(() =>
      expect(api.saveAsTemplate).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ templateKey: "speeding" })
      )
    );
  });

  it("says why the platform refused", async () => {
    api.saveAsTemplate.mockRejectedValue(new ControlTowerError("no", 403));
    open(def);
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar como plantilla" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "solo plataforma"
    );
  });

  it("maps the other failures", () => {
    expect(saveAsTemplateError(new ControlTowerError("x", 409), d)).toBe(
      "clave tomada"
    );
    expect(saveAsTemplateError(new Error("x"), d)).toBe("falló");
  });
});
