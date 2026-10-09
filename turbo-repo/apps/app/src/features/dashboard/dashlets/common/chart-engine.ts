import { init, type EChartsOption } from "echarts";
import type { ChartEngine } from "@microboxlabs/miot-dashboard-ui/react";

/** The app supplies ECharts; portable UI owns mount/update/resize/dispose timing. */
export function createDashboardChartEngine(element: HTMLDivElement): ChartEngine<EChartsOption> {
  const instance = init(element, undefined, { renderer: "canvas" });
  const hideTooltip = () => {
    instance.dispatchAction({ type: "hideTip" });
    instance.dispatchAction({ type: "downplay" });
  };
  instance.on("globalout", hideTooltip);
  return {
    update: (option) => { instance.setOption(option, { notMerge: true }); },
    resize: () => { instance.resize(); },
    dispose: () => { instance.dispose(); },
    hideTooltip,
  };
}
