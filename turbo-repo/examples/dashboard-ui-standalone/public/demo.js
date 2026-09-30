import { aggregateServices } from "./billing.js";
import {
  mountDashboard,
  createTextCardRegistry,
  createPercentageValueRegistry,
  createCircularStatRegistry,
} from "./runtime.js";
const $ = (id) => document.getElementById(id);
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const labels = {
  loadingLabel: "Cargando…",
  errorLabel: "No fue posible cargar los datos.",
  unsupportedDataLabel: "Este widget necesita una consulta guardada.",
};
const definitions = [
  ...createTextCardRegistry({
    ...labels,
    defaultText: "Costo del servicio",
  }).all(),
  ...createPercentageValueRegistry({
    ...labels,
    defaultTitle: "Participación",
  }).all(),
  ...createCircularStatRegistry({
    ...labels,
    defaultTitle: "Participación",
    defaultUnit: "USD",
    formatTotal: (max) => "del total " + money.format(Number(max)),
  }).all(),
];
const registry = { get: (id) => definitions.find((d) => d.meta.id === id) };
let rows = [],
  dashboard,
  total = 0,
  selected = "",
  mounted,
  loading = false;
function setNotice(text, error = false) {
  $("notice").textContent = text;
  $("notice").className = error ? "error" : "";
}
function widgets() {
  const stamp = new Date().toISOString();
  return [
    {
      id: "summary",
      componentId: "text_card",
      config: {
        text: "{{service}}\n{{formatted_cost}} USD",
        italic: false,
        align: "left",
      },
      layout: { i: "summary", x: 0, y: 0, w: 16, h: 2 },
    },
    {
      id: "share",
      componentId: "percentage_value",
      config: {
        title: "Participación en el costo total",
        value: "{{share}}",
        max: "100",
        barColor: "92b272",
      },
      layout: { i: "share", x: 0, y: 2, w: 16, h: 2 },
    },
    {
      id: "ring",
      componentId: "stat_circular",
      config: {
        title: "Costo del servicio",
        value: "{{net_cost}}",
        maxValue: "{{total_cost}}",
        unit: "USD",
        ringColor: "92b272",
      },
      layout: { i: "ring", x: 16, y: 0, w: 8, h: 4 },
    },
  ].map((w) => ({
    ...w,
    config: { ...w.config, dataMode: "planner", plannerVariableName: "costs" },
    createdAt: stamp,
    updatedAt: stamp,
  }));
}
function renderDashboard() {
  const current = rows.find((r) => r.service === selected) || rows[0];
  if (!current) return;
  selected = current.service;
  $("service").value = selected;
  $("selection-title").textContent = selected;
  const amount = Number(current.net_cost) || 0;
  const result = {
    ...current,
    total_cost: total,
    share: total > 0 ? Number(((amount / total) * 100).toFixed(2)) : 0,
    formatted_cost: new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount),
  };
  const options = {
    instanceKey: "dox-consumer/streamhub-costs",
    registry,
    unknownWidgetLabel: "Widget no disponible",
    widgets: widgets(),
    savedQueries: {
      client: { key: () => selected, query: () => Promise.resolve([result]) },
      slug: "streamhub-costs",
      queries: dashboard.queries,
      filters: {},
      refreshIntervalMs: 0,
      paused: false,
      errorMessage: labels.errorLabel,
    },
  };
  if (mounted) mounted.update(options);
  else mounted = mountDashboard($("dashboard"), options);
}
function renderTable() {
  const query = $("search").value.toLocaleLowerCase();
  const visible = rows.filter((r) =>
    String(r.service).toLocaleLowerCase().includes(query),
  );
  $("rows").replaceChildren();
  for (const row of visible) {
    const tr = document.createElement("tr");
    const name = document.createElement("td");
    const button = document.createElement("button");
    button.className = "service-button";
    button.textContent = row.service;
    button.onclick = () => {
      selected = row.service;
      renderDashboard();
      $("selection-title").scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    };
    name.append(button);
    const share = document.createElement("td");
    const pct = total > 0 ? (Number(row.net_cost) / total) * 100 : 0;
    const bar = document.createElement("span");
    bar.className = "bar";
    const fill = document.createElement("i");
    fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
    bar.append(fill);
    const label = document.createElement("span");
    label.className = "share";
    label.textContent = pct.toFixed(1) + "%";
    share.append(bar, label);
    const cost = document.createElement("td");
    cost.className = "numeric";
    cost.textContent = money.format(Number(row.net_cost) || 0);
    tr.append(name, share, cost);
    $("rows").append(tr);
  }
  $("empty").hidden = visible.length !== 0;
}
async function refresh() {
  if (loading) return;
  loading = true;
  $("refresh").disabled = true;
  $("service").disabled = true;
  $("search").disabled = true;
  setNotice("Consultando BigQuery…");
  try {
    const responses = await Promise.all([
      fetch("api/dashboard"),
      fetch("api/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    ]);
    if (responses.some((r) => r.status === 401)) {
      location.reload();
      return;
    }
    if (responses.some((r) => !r.ok))
      throw Error("No fue posible actualizar. Puedes volver a intentarlo.");
    const [doc, data] = await Promise.all(responses.map((r) => r.json()));
    dashboard = doc.data;
    rows = aggregateServices(data.data.rows);
    if (!rows.length)
      throw Error("La consulta no devolvió servicios para este período.");
    total = rows.reduce((sum, r) => sum + Number(r.net_cost), 0);
    $("total").textContent = money.format(total);
    $("count").textContent = String(rows.length);
    $("largest").textContent = rows[0].service;
    $("largest-share").textContent =
      (total > 0 ? (Number(rows[0].net_cost) / total) * 100 : 0).toFixed(1) +
      "% del costo total";
    $("service").replaceChildren(
      ...rows.map((r) => {
        const option = document.createElement("option");
        option.value = r.service;
        option.textContent = r.service;
        return option;
      }),
    );
    renderDashboard();
    renderTable();
    $("updated").textContent =
      "Actualizado " +
      new Intl.DateTimeFormat("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date());
    setNotice(
      "Conectado · " +
        rows.length +
        " servicios · Datos obtenidos desde el dashboard server",
    );
  } catch (e) {
    mounted?.destroy();
    mounted = undefined;
    rows = [];
    $("rows").replaceChildren();
    for (const id of ["total", "count", "largest", "largest-share"])
      $(id).textContent = "—";
    setNotice(e.message, true);
  } finally {
    loading = false;
    $("refresh").disabled = false;
    $("service").disabled = !rows.length;
    $("search").disabled = !rows.length;
  }
}
$("refresh").onclick = refresh;
$("service").onchange = () => {
  selected = $("service").value;
  renderDashboard();
};
$("search").oninput = renderTable;
addEventListener("pagehide", () => mounted?.destroy());
refresh();
