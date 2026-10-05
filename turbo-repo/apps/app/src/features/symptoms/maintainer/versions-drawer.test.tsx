import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SymptomVersion } from "./maintainer-api";
import VersionsDrawer from "./versions-drawer";

const d = {
  sectionVersions: "Versiones",
  close: "Cerrar",
  inForce: "vigente",
  openAndCompare: "Abrir y comparar",
  revertToThis: "Revertir a esta",
  duplicate: "Duplicar",
  versionsHelp: "ayuda",
  bumpMinor: "MENOR",
  bumpMajor: "MAYOR",
};

const version = (v: string, bump: "MAJOR" | "MINOR"): SymptomVersion =>
  ({
    id: `id-${v}`,
    definitionId: "s1",
    version: v,
    status: "PUBLISHED",
    spec: {},
    bump,
    reason: `motivo ${v}`,
    rolledBackFrom: null,
    createdBy: "a",
    createdAt: "2026-10-03T10:00:00Z",
    publishedBy: "ana@example.com",
    publishedAt: "2026-10-03T10:00:00Z",
  }) as unknown as SymptomVersion;

function show(canWrite: boolean) {
  const handlers = {
    onView: vi.fn(),
    onRollback: vi.fn(),
    onFork: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <VersionsDrawer
      show
      versions={[version("2.0.0", "MAJOR"), version("1.1.0", "MINOR")]}
      changes={{
        "2.0.0": [
          {
            section: "activation",
            bump: "MAJOR",
            text: "Cambió cuándo se activa",
          },
        ],
        "1.1.0": [],
      }}
      current="2.0.0"
      canWrite={canWrite}
      d={d}
      {...handlers}
    />
  );
  const item = (v: string) => screen.getByText(v).closest("li") as HTMLElement;
  return { handlers, item };
}

describe("VersionsDrawer", () => {
  it("marks the version in force and lists each version's changes", () => {
    const { item } = show(true);
    expect(within(item("2.0.0")).getByText("vigente")).toBeTruthy();
    expect(
      within(item("2.0.0")).getByText("Cambió cuándo se activa")
    ).toBeTruthy();
    expect(within(item("1.1.0")).queryByText("vigente")).toBeNull();
    expect(within(item("1.1.0")).queryByRole("listitem")).toBeNull();
  });

  it("offers compare and revert only on older versions, and passes the version on", () => {
    const { item, handlers } = show(true);
    expect(within(item("2.0.0")).queryByText("Abrir y comparar")).toBeNull();
    expect(within(item("2.0.0")).queryByText("Revertir a esta")).toBeNull();
    fireEvent.click(within(item("1.1.0")).getByText("Abrir y comparar"));
    fireEvent.click(within(item("1.1.0")).getByText("Revertir a esta"));
    fireEvent.click(within(item("2.0.0")).getByText("Duplicar"));
    expect(handlers.onView).toHaveBeenCalledWith("1.1.0");
    expect(handlers.onRollback).toHaveBeenCalledWith("1.1.0");
    expect(handlers.onFork).toHaveBeenCalledWith("2.0.0");
  });

  it("lets a reader compare but not revert or copy", () => {
    const { item } = show(false);
    expect(within(item("1.1.0")).getByText("Abrir y comparar")).toBeTruthy();
    expect(screen.queryByText("Revertir a esta")).toBeNull();
    expect(screen.queryByText("Duplicar")).toBeNull();
  });
});
