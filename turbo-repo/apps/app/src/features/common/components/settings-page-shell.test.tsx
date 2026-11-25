import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HiOutlineFolder } from "react-icons/hi2";
import SettingsPageShell from "./settings-page-shell";

describe("SettingsPageShell", () => {
  it("shows the route's breadcrumb by default", () => {
    render(
      <SettingsPageShell
        breadcrumbDict={{ dashboardServer: "Dashboards" }}
        lang="en"
        path={["dashboardServer"]}
        icon={HiOutlineFolder}
        title="Dashboards"
        description="All of them"
      >
        <p>content</p>
      </SettingsPageShell>
    );
    expect(
      screen.getByRole("navigation", { name: "Breadcrumb" })
    ).toHaveTextContent("Dashboards");
  });

  it("takes a breadcrumb of its own, for a page deeper than its route", () => {
    render(
      <SettingsPageShell
        breadcrumbDict={{}}
        lang="en"
        path={["dashboardServer"]}
        icon={HiOutlineFolder}
        title="Ops"
        description="3 items"
        breadcrumb={<nav aria-label="Folder path">Dashboards › Ops</nav>}
      >
        <p>content</p>
      </SettingsPageShell>
    );
    expect(
      screen.getByRole("navigation", { name: "Folder path" })
    ).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Ops" })).toBeVisible();
  });
});
