import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { createWidgetRegistry } from "@microboxlabs/miot-dashboard-ui/core";
import type {
  DashletDefinition,
  DashletComponentProps,
} from "../dashlets/types";
import { makeDashboardStorage, makeWidget } from "../test-fixtures";

vi.mock(
  "@/features/geographic-view/components/layers/pin_layer_clustered",
  () => ({ PinLayer: class PinLayer {} })
);
vi.mock("./planner-context", () => ({
  PlannerProvider: ({ children }: PropsWithChildren) => children,
}));
vi.mock("./dashboard-filters-context", () => ({
  DashboardFiltersProvider: ({ children }: PropsWithChildren) => children,
}));
vi.mock("@/features/layout/hooks/use-kiosk-mode", () => ({
  useKioskMode: () => false,
}));

import { DashboardProvider, useDashboard } from "./dashboard-context";
import { WidgetRenderer } from "../components/widget-renderer/widget-renderer";

const DataProvider = ({ children }: Readonly<PropsWithChildren>) => children;
const Icon = () => null;
function CustomWidget({ widget }: Readonly<DashletComponentProps>) {
  return <output>{String(widget.config.label)}</output>;
}
function catalog(label: string) {
  const definition: DashletDefinition = {
    meta: {
      id: "custom",
      name: label,
      description: label,
      icon: Icon,
      category: "data-display",
      canNestIn: [],
      hasSettings: false,
      hasChildren: false,
    },
    Component: CustomWidget,
    defaultConfig: { label },
    getLayoutDefaults: () => ({ minW: 3, minH: 2 }),
  };
  return createWidgetRegistry([definition]);
}
function Canvas({ label }: Readonly<{ label: string }>) {
  const dashboard = useDashboard();
  return (
    <>
      <button onClick={() => dashboard.createWidget("custom")}>
        Add {label}
      </button>
      {dashboard.widgets.map((widget) => (
        <WidgetRenderer key={widget.id} widget={widget} />
      ))}
    </>
  );
}

describe("dashboard instance registry", () => {
  it("renders and creates the same widget ID with each host's defaults", () => {
    const onA = vi.fn();
    const onB = vi.fn();
    render(
      <>
        <DashboardProvider
          dictionary={{}}
          slug="a"
          registry={catalog("Host A")}
          dataProvider={DataProvider}
          storage={{
            config: makeDashboardStorage({
              widgets: [makeWidget({ id: "a", componentId: "custom" })],
            }),
            isLoaded: true,
            readOnly: false,
            onChange: onA,
          }}
        >
          <Canvas label="A" />
        </DashboardProvider>
        <DashboardProvider
          dictionary={{}}
          slug="b"
          registry={catalog("Host B")}
          dataProvider={DataProvider}
          storage={{
            config: makeDashboardStorage({
              widgets: [makeWidget({ id: "b", componentId: "custom" })],
            }),
            isLoaded: true,
            readOnly: false,
            onChange: onB,
          }}
        >
          <Canvas label="B" />
        </DashboardProvider>
      </>
    );
    expect(screen.getByText("Host A")).toBeInTheDocument();
    expect(screen.getByText("Host B")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add A" }));
    expect(onA.mock.calls[0]?.[0].widgets.at(-1)).toMatchObject({
      componentId: "custom",
      config: { label: "Host A" },
      layout: { minW: 3, minH: 2 },
    });
    expect(onB).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add B" }));
    expect(onB.mock.calls[0]?.[0].widgets.at(-1)?.config).toEqual({
      label: "Host B",
    });
  });
});
