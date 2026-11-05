import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SymptomDefinition } from "./maintainer-api";

vi.mock("../components/symtom-icon", () => ({ default: () => <span /> }));
vi.mock("./symptom-name", () => ({
  default: ({ name, canRename }: { name: string; canRename: boolean }) => (
    <h1 data-can-rename={String(canRename)}>{name}</h1>
  ),
}));

import SheetHeader from "./sheet-header";

const d = {
  versionsHistory: "Historial",
  duplicateAsNew: "Duplicar como síntoma nuevo",
  saveAsTemplate: "Guardar como plantilla",
};

const def = {
  id: "s1",
  key: "k",
  name: "Exceso de velocidad",
  family: null,
  icon: null,
  templateKey: null,
  forkedFromVersionId: null,
  engineRuleId: null,
  state: "ACTIVE",
  currentVersion: "1.0.0",
} as unknown as SymptomDefinition;

function header(props: {
  stateless?: boolean;
  canWrite?: boolean;
  onSaveAsTemplate?: () => void;
}) {
  render(
    <SheetHeader
      def={def}
      spec={null}
      canWrite
      families={[]}
      familiesMissing={false}
      templates={[]}
      forkedFrom={null}
      backHref="/es/users/settings/symptoms"
      lang="es"
      d={d}
      rootDict={{}}
      onChange={vi.fn()}
      onHistory={vi.fn()}
      onDuplicate={vi.fn()}
      {...props}
    />
  );
}

describe("SheetHeader", () => {
  it("offers Guardar como plantilla next to Duplicar when given the action", () => {
    const onSaveAsTemplate = vi.fn();
    header({ onSaveAsTemplate });
    fireEvent.click(screen.getByRole("button", { name: /v1\.0\.0/ }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Guardar como plantilla/ })
    );
    expect(onSaveAsTemplate).toHaveBeenCalled();
  });

  it("leaves it out for everyone else", () => {
    header({});
    fireEvent.click(screen.getByRole("button", { name: /v1\.0\.0/ }));
    expect(
      screen.getByRole("menuitem", { name: /Duplicar/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Guardar como plantilla/ })
    ).toBeNull();
  });

  it("shows no state toggle for a template", () => {
    header({});
    expect(screen.getAllByRole("button")).toHaveLength(4);
    document.body.innerHTML = "";
    header({ stateless: true });
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("lets who can edit the symptom rename it", () => {
    header({});
    expect(screen.getByRole("heading")).toHaveAttribute(
      "data-can-rename",
      "true"
    );
    document.body.innerHTML = "";
    header({ canWrite: false });
    expect(screen.getByRole("heading")).toHaveAttribute(
      "data-can-rename",
      "false"
    );
  });
});
