import { describe, expect, it } from "vitest";
import type { Selectable } from "../types";
import {
  addGroup,
  draftFrom,
  draftProblem,
  duplicateDraft,
  emptyDraft,
  removeGroup,
  setDependsOn,
  setKey,
  setName,
  toSelectable,
  updateGroup,
  updateOption,
} from "./editor-draft";

const stored: Selectable = {
  key: "delay_reason",
  name: { es: "Motivo", en: "Reason" },
  description: {},
  mode: "MULTIPLE",
  settings: {
    searchable: true,
    creatable: false,
    dependsOn: null,
    maxSelections: 3,
    placeholder: {},
  },
  groups: [{ key: "route", label: { es: "En ruta" } }],
  source: { kind: "STATIC", ref: null, config: {} },
  options: [{ value: "traffic", label: { es: "Tráfico" }, group: "route" }],
};

describe("editor draft", () => {
  it("makes the key from the name until the key is typed", () => {
    let draft = setName(emptyDraft(), { es: "Región de Envío" });
    expect(draft.key).toBe("region_de_envio");

    draft = setKey(draft, "region");
    draft = setName(draft, { es: "Otra cosa" });
    expect(draft.key).toBe("region");
  });

  it("keeps a stored list's key when the name changes", () => {
    expect(setName(draftFrom(stored), { es: "Nuevo nombre" }).key).toBe(
      "delay_reason"
    );
  });

  it("lets a new option's value follow its label, unique in the list, until typed", () => {
    let draft = emptyDraft();
    const row = draft.options[0]!.rowId;
    draft = updateOption(draft, row, { label: { es: "Camión 3/4" } });
    expect(draft.options[0]!.value).toBe("camion_3_4");

    draft = updateOption(draft, row, { value: "T34" });
    draft = updateOption(draft, row, { label: { es: "Otro" } });
    expect(draft.options[0]!.value).toBe("T34");
  });

  it("never renames a stored option's value", () => {
    let draft = draftFrom(stored);
    draft = updateOption(draft, draft.options[0]!.rowId, {
      label: { es: "Tránsito" },
    });
    expect(draft.options[0]!.value).toBe("traffic");
  });

  it("carries options along when a group's key changes, and ungroups them when it goes", () => {
    let draft = draftFrom(stored);
    const group = draft.groups[0]!.rowId;
    draft = updateGroup(draft, group, { key: "road" });
    expect(draft.options[0]!.group).toBe("road");

    draft = removeGroup(draft, group);
    expect(draft.options[0]!.group).toBeNull();
    expect(addGroup(draft).groups).toHaveLength(1);
  });

  it("copies under a free key with the name marked as a copy", () => {
    const copy = duplicateDraft(stored, ["delay_reason", "delay_reason_copy"]);
    expect(copy.key).toBe("delay_reason_copy_2");
    expect(copy.name).toEqual({ es: "Motivo (copia)", en: "Reason (copy)" });
    expect(copy.isNew).toBe(true);
  });

  it("sends only API fields, and drops the cap from a single-choice list", () => {
    const out = toSelectable({ ...draftFrom(stored), mode: "SINGLE" });
    expect(out.settings.maxSelections).toBeNull();
    expect(out.options[0]).not.toHaveProperty("rowId");
    expect(out.options[0]).not.toHaveProperty("valueFixed");
    expect(out.groups[0]).toEqual({ key: "route", label: { es: "En ruta" } });
  });

  it("names what stops a save", () => {
    expect(draftProblem(emptyDraft())).toBe("nameRequired");
    expect(
      draftProblem(setKey(setName(emptyDraft(), { es: "X" }), "9bad"))
    ).toBe("keyInvalid");
    const dynamic = {
      ...setName(emptyDraft(), { es: "Zonas" }),
      source: { kind: "SYSTEM" as const, ref: null },
    };
    expect(draftProblem(dynamic)).toBe("sourceRequired");
    let twins = setName(emptyDraft(), { es: "Lista" });
    twins = updateOption(twins, twins.options[0]!.rowId, {
      label: { es: "A" },
      value: "a",
    });
    twins = {
      ...twins,
      options: [...twins.options, { ...twins.options[0]!, rowId: "other" }],
    };
    expect(draftProblem(twins)).toBe("duplicateValues");
    expect(draftProblem(draftFrom(stored))).toBeNull();
  });

  it("refuses a new list under a key that already exists, since saving would replace it", () => {
    const clash = setName(emptyDraft(), { es: "Delay reason" });
    expect(draftProblem(clash, ["delay_reason"])).toBe("keyTaken");
    expect(draftProblem(draftFrom(stored), ["delay_reason"])).toBeNull();
  });

  it("clears the options' parents when the list stops depending on another, or changes which", () => {
    let draft = setDependsOn(draftFrom(stored), "region");
    draft = updateOption(draft, draft.options[0]!.rowId, { parent: "CL-RM" });

    expect(setDependsOn(draft, "region").options[0]!.parent).toBe("CL-RM");
    expect(setDependsOn(draft, null).options[0]!.parent).toBeNull();
    expect(setDependsOn(draft, "zone").options[0]!.parent).toBeNull();
  });
});
