/**
 * What the panel shows for a photo that was rejected and then re-sent.
 *
 * The pure split is covered in review-version.test.ts; this is here because the defect the
 * user hit was a wiring one — the panel had the rounds and the revision label in hand and
 * rendered them together anyway, so the reviewer met a superseded rejection presented as the
 * state of content nobody had looked at.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ObservationsSection } from "./observations-section";
import type { StateChangeTimelineEntry, TimelineEntry } from "./observation.types";

// The reason catalog is left unmocked on purpose. Mocking the client-api provider — whole or
// partial — crashes the worker: the module is imported across most of the app, and rebuilding
// its graph under a factory blows the stack. Unmocked, its SWR fetch simply fails in jsdom and
// the picker falls back to OBSERVATION_TYPE_KEYS, which is all these assertions need.

const dictionary = {
  bento: {
    multimedia: {
      sidebar_obs_add: "Nueva observación",
      sidebar_obs_empty: "Sin observaciones aún",
      sidebar_obs_none_in_container: "Sin notas adjuntas",
      sidebar_obs_show_all: "Ver todas las observaciones",
      sidebar_obs_history_title: "Revisiones de versiones anteriores",
      sidebar_obs_history_version: "Versión v{version}",
      sidebar_obs_history_unversioned: "Antes del control de versiones",
      sidebar_obs_state_rejected: "Rechazado",
      sidebar_obs_state_approved: "Aprobado",
      // Wording copied from src/lang/es.json, so these assertions read as what ships.
      sidebar_obs_state_pending: "Devuelto a revisión",
      obs_poor_image_quality: "Calidad de imagen deficiente",
    },
  },
};

const rejectionAt = (version: string | null): StateChangeTimelineEntry => ({
  kind: "state_change",
  id: `round-1-${version}`,
  status: "rejected",
  committedAt: new Date("2026-07-27T19:19:18Z"),
  committedBy: "reviewer",
  version,
  observations: [
    {
      id: "round-1-detail",
      types: ["poor_image_quality"],
      description: "no se percibe la patente",
      createdAt: new Date("2026-07-27T19:19:18Z"),
      source: "round",
    },
  ],
});

function renderPanel(committedTimeline: TimelineEntry[], currentVersion: string | null) {
  return render(
    <ObservationsSection
      dictionary={dictionary}
      draftObservations={[]}
      committedTimeline={committedTimeline}
      isInDraftReview
      onAdd={() => {}}
      onRemoveDraft={() => {}}
      mode="preview"
      currentVersion={currentVersion}
    />
  );
}

describe("ObservationsSection — a rejection the content has outlived", () => {
  it("reads as unreviewed once the photo has been re-sent", () => {
    renderPanel([rejectionAt("1.0")], "1.1");

    expect(screen.getByText("Sin observaciones aún")).toBeDefined();
    expect(screen.queryByText("no se percibe la patente")).toBeNull();
  });

  it("keeps the earlier rejection reachable, one click away", async () => {
    const { container } = renderPanel([rejectionAt("1.0")], "1.1");

    const disclosure = screen.getByRole("button", { name: /Revisiones de versiones anteriores/ });
    expect(disclosure.textContent).toContain("(1)");
    // Closed to begin with: the reviewer's job is the revision in front of them.
    expect(screen.queryByText("no se percibe la patente")).toBeNull();

    disclosure.click();
    await vi.waitFor(() => {
      expect(screen.getByText("no se percibe la patente")).toBeDefined();
    });
    expect(screen.getByText("Versión v1.0")).toBeDefined();
    // The reason reads as prose on the rail, not as a chip in a card.
    expect(screen.getByText("Calidad de imagen deficiente")).toBeDefined();
    // A round is the decision as stored, so history offers nothing that edits it.
    expect(container.querySelectorAll("button[aria-label], button[title]")).toHaveLength(0);
  });

  it("renders a decision nobody wrote on as its line alone", async () => {
    // "Devuelto a revisión" carries no reasons and no comment by construction. In a card it
    // filled a bordered box with "Sin notas adjuntas"; four of those was most of the panel.
    const returned: StateChangeTimelineEntry = {
      ...rejectionAt("1.0"),
      id: "round-2",
      status: "pending",
      observations: [],
    };
    renderPanel([returned], "1.1");

    screen.getByRole("button", { name: /Revisiones de versiones anteriores/ }).click();
    await vi.waitFor(() => {
      expect(screen.getByText("Devuelto a revisión")).toBeDefined();
    });
    expect(screen.queryByText("Sin notas adjuntas")).toBeNull();
  });

  it("centres every marker on the rail, not beside it", async () => {
    // jsdom does no layout, so this asserts the rule that does the centering rather than the
    // resulting pixels. `-left-5` alone only lands a marker's left edge on the line — which is
    // what left the dots hanging off its right side — so the translate has to be on all of them.
    const { container } = renderPanel([rejectionAt("1.0")], "1.1");
    screen.getByRole("button", { name: /Revisiones de versiones anteriores/ }).click();
    await vi.waitFor(() => {
      expect(container.querySelector("ol")).not.toBeNull();
    });

    const markers = [...container.querySelectorAll("ol > li > span:first-child")];
    expect(markers).toHaveLength(2); // the revision marker and its one decision
    for (const marker of markers) {
      expect(marker.className).toContain("-left-5");
      expect(marker.className).toContain("-translate-x-1/2");
    }
  });

  it("runs every revision down one rail, newest decision first", async () => {
    const older: StateChangeTimelineEntry = { ...rejectionAt("1.0"), id: "round-1" };
    const newer: StateChangeTimelineEntry = {
      ...rejectionAt("1.1"),
      id: "round-2",
      committedAt: new Date("2026-07-27T20:32:56Z"),
    };
    const { container } = renderPanel([older, newer], "1.2");

    screen.getByRole("button", { name: /Revisiones de versiones anteriores/ }).click();
    await vi.waitFor(() => {
      expect(screen.getByText("Versión v1.1")).toBeDefined();
    });

    // One list, so the line is continuous across revisions rather than restarting per group.
    expect(container.querySelectorAll("ol")).toHaveLength(1);
    const markers = [...container.querySelectorAll("ol > li")].map((li) =>
      li.textContent?.startsWith("Versión") ? "version" : "decision"
    );
    expect(markers).toEqual(["version", "decision", "version", "decision"]);
    // Newest revision reached first.
    expect(container.querySelector("ol > li")?.textContent).toContain("v1.1");
  });

  it("shows the rejection as the live state while it still describes the photo on screen", () => {
    renderPanel([rejectionAt("1.1")], "1.1");

    expect(screen.getByText("no se percibe la patente")).toBeDefined();
    expect(screen.queryByText("Sin observaciones aún")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Revisiones de versiones anteriores/ })
    ).toBeNull();
  });

  it("leaves a forum-era timeline alone, since it names no revision to compare", () => {
    const forumEra: StateChangeTimelineEntry = { ...rejectionAt("1.0"), version: undefined };
    renderPanel([forumEra], "1.1");

    expect(screen.getByText("no se percibe la patente")).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /Revisiones de versiones anteriores/ })
    ).toBeNull();
  });
});
