import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumb } from "./Breadcrumb";

const dict = { dashboardServer: "Dashboards" };

describe("Breadcrumb", () => {
  it("leaves the first crumb as text by default", () => {
    render(
      <Breadcrumb
        path={["dashboardServer", "Fleet"]}
        dict={dict}
        disableLinks
      />
    );
    expect(screen.getByText("Dashboards").closest("a")).toBeNull();
  });

  it("links the first crumb back when given where, even with links off", () => {
    render(
      <Breadcrumb
        path={["dashboardServer", "Fleet"]}
        dict={dict}
        disableLinks
        rootHref="/es/dashboards"
      />
    );
    expect(screen.getByRole("link", { name: "Dashboards" })).toHaveAttribute(
      "href",
      "/es/dashboards"
    );
    expect(screen.getByText("Fleet").closest("a")).toBeNull();
  });

  it("links the crumbs in between, but never the last one", () => {
    render(
      <Breadcrumb
        path={["dashboardServer", "Ops", "Fleet"]}
        dict={dict}
        disableLinks
        crumbHrefs={[undefined, "/es/dashboards?folder=ops", "/nope"]}
      />
    );
    expect(screen.getByRole("link", { name: "Ops" })).toHaveAttribute(
      "href",
      "/es/dashboards?folder=ops"
    );
    expect(screen.getByText("Fleet").closest("a")).toBeNull();
  });
});
