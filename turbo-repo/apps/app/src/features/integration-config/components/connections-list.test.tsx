import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/lang/en.json";
import type { IntegrationConnection } from "../integration-config.types";
import { ConnectionsList } from "./connections-list";

const dict = en.pages.integrationConnections;

const geocoding: IntegrationConnection = {
  id: "geo",
  name: "Geocoding · ModularIoT",
  providerType: "GEOCODING",
  baseUrl: "https://api.mapbox.com",
  credentialProfileId: "cred",
  status: "ACTIVE",
  lastTestedAt: null,
  lastTestResult: true,
  templateId: null,
  metadata: {},
};

function renderList(canRemoveManaged: boolean) {
  render(
    <ConnectionsList
      connections={[geocoding]}
      templates={[]}
      credentials={[]}
      onOpen={vi.fn()}
      onTest={vi.fn()}
      onDelete={vi.fn()}
      canRemoveManaged={canRemoveManaged}
      onFunctions={vi.fn()}
      onQueries={vi.fn()}
      testing={null}
      emptyMessage=""
      layout="cards"
      dict={dict}
    />
  );
}

describe("ConnectionsList, a connection the platform manages", () => {
  it("is shown to the organization without anything to open or change", () => {
    renderList(false);

    expect(screen.getByText("Geocoding · ModularIoT")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Geocoding · ModularIoT" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: dict.menu.label })).toBeNull();
  });

  it("has a menu for a platform owner, to remove it", () => {
    renderList(true);

    expect(
      screen.queryByRole("button", { name: "Geocoding · ModularIoT" })
    ).toBeNull();
    expect(screen.getByRole("button", { name: dict.menu.label })).toBeTruthy();
  });
});
