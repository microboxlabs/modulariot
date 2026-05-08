// Dashboard.jsx — MIOT dashboards page with ECharts widgets
const { useEffect: useDE, useRef: useDR, useState: useDS } = React;

function EChart({ option, height = 220, onReady }) {
  const ref = useDR(null);
  const inst = useDR(null);
  useDE(() => {
    if (!ref.current || !window.echarts) return;
    inst.current = window.echarts.init(ref.current);
    inst.current.setOption(option);
    onReady?.(inst.current);
    const ro = new ResizeObserver(() => inst.current?.resize());
    ro.observe(ref.current);
    return () => { ro.disconnect(); inst.current?.dispose(); };
  }, []);
  useDE(() => { inst.current?.setOption(option, true); }, [JSON.stringify(option)]);
  return <div ref={ref} style={{ width: "100%", height }}/>;
}

function Widget({ title, meta, actions, children, highlight, style = {} }) {
  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${highlight ? "#D18900" : "#E5E7EB"}`,
      borderRadius: 10, padding: 16,
      boxShadow: highlight ? "0 0 0 3px rgba(241, 179, 0, 0.15)" : "none",
      transition: "box-shadow 200ms, border-color 200ms",
      display: "flex", flexDirection: "column", minWidth: 0, ...style,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111928", letterSpacing: "-0.005em" }}>{title}</div>
          {meta && <div style={{ fontSize: 11.5, color: "#6B7280", marginTop: 2 }}>{meta}</div>}
        </div>
        {actions}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

function StatCard({ label, value, delta, deltaTone = "positive", sub }) {
  const tone = {
    positive: { bg: "#DEF7EC", fg: "#046C4E" },
    negative: { bg: "#FEE2E2", fg: "#991B1B" },
    neutral:  { bg: "#F3F4F6", fg: "#374151" },
  }[deltaTone];
  return (
    <div style={{
      background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10,
      padding: 16, display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: "#111928", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {delta && (
          <span style={{ background: tone.bg, color: tone.fg, padding: "2px 7px", borderRadius: 999, fontSize: 11, fontWeight: 500 }}>{delta}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>{sub}</div>}
    </div>
  );
}

function Dashboard({ chatBuiltWidget }) {
  // Options for the 4 base widgets
  const tripsOpt = {
    grid: { left: 40, right: 12, top: 20, bottom: 22 },
    xAxis: { type: "category", data: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
      axisLine: { lineStyle: { color: "#E5E7EB" } }, axisLabel: { color: "#6B7280", fontSize: 11 } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#F3F4F6" } }, axisLabel: { color: "#9CA3AF", fontSize: 11 } },
    tooltip: { trigger: "axis" },
    series: [
      { name: "On time",  type: "bar", stack: "x", data: [142,156,148,162,171,88,64], itemStyle: { color: "#1C64F2" }, barWidth: 16 },
      { name: "Delayed",  type: "bar", stack: "x", data: [18,22,16,24,30,12,8],        itemStyle: { color: "#F1B300" } },
      { name: "Failed",   type: "bar", stack: "x", data: [4,6,3,5,7,1,2],              itemStyle: { color: "#E11D48" } },
    ],
    legend: { show: false },
  };
  const fuelOpt = {
    grid: { left: 38, right: 12, top: 20, bottom: 22 },
    xAxis: { type: "category", boundaryGap: false, data: Array.from({length: 14}, (_,i)=>`d${i+1}`),
      axisLine: { lineStyle: { color: "#E5E7EB" } }, axisLabel: { color: "#9CA3AF", fontSize: 10 } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: "#F3F4F6" } }, axisLabel: { color: "#9CA3AF", fontSize: 11 } },
    tooltip: { trigger: "axis" },
    series: [{
      type: "line", smooth: true,
      data: [42,45,44,48,52,50,47,49,53,58,55,52,49,51],
      symbol: "none", lineStyle: { color: "#0E9F6E", width: 2 },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: "rgba(14,159,110,0.25)" }, { offset: 1, color: "rgba(14,159,110,0)" }] } },
    }],
  };
  const exposureOpt = {
    tooltip: { trigger: "item" },
    legend: { bottom: 0, left: "center", textStyle: { fontSize: 11, color: "#6B7280" }, itemWidth: 8, itemHeight: 8 },
    series: [{
      type: "pie", radius: ["54%","78%"], center: ["50%","44%"],
      avoidLabelOverlap: false, label: { show: false },
      data: [
        { value: 41, name: "Low",      itemStyle: { color: "#0E9F6E" } },
        { value: 28, name: "Medium",   itemStyle: { color: "#F1B300" } },
        { value: 14, name: "Critical", itemStyle: { color: "#E11D48" } },
        { value: 7,  name: "Unknown",  itemStyle: { color: "#9CA3AF" } },
      ],
    }],
  };
  const utilOpt = {
    grid: { left: 38, right: 12, top: 20, bottom: 22 },
    xAxis: { type: "category", data: ["SCL","Andina","Teniente","Bronces","Escondida","Collahuasi"],
      axisLine: { lineStyle: { color: "#E5E7EB" } }, axisLabel: { color: "#6B7280", fontSize: 10.5, interval: 0 } },
    yAxis: { type: "value", max: 100, splitLine: { lineStyle: { color: "#F3F4F6" } }, axisLabel: { color: "#9CA3AF", fontSize: 11, formatter: "{value}%" } },
    tooltip: { trigger: "axis", formatter: "{b}: {c}%" },
    series: [{ type: "bar", data: [84,71,92,68,79,88], barWidth: 22,
      itemStyle: { color: (p) => p.value > 85 ? "#0E9F6E" : p.value > 70 ? "#F1B300" : "#E11D48", borderRadius: [4,4,0,0] } }],
  };

  return (
    <div style={{ padding: 22, overflow: "auto", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Operations overview</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111928", letterSpacing: "-0.02em" }}>Fleet performance · This week</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F3F4F6", borderRadius: 7, padding: "5px 10px", fontSize: 12, color: "#374151", fontWeight: 500 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0E9F6E" }}/>
            Live · Updated 12s ago
          </div>
          <MButton variant="secondary" size="sm" icon={MIco.share}>Share</MButton>
          <MButton variant="primary" size="sm" icon={MIco.plus}>New dashboard</MButton>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Trips completed"    value="1,284" delta="+12.4%" deltaTone="positive" sub="vs. last week"/>
        <StatCard label="Avg. delay (min)"   value="14.2"  delta="−3.1"   deltaTone="positive" sub="below target 18m"/>
        <StatCard label="Fuel consumption"   value="48.7L" delta="+2.3%"  deltaTone="negative" sub="per 100 km"/>
        <StatCard label="Active exceptions"  value="7"     delta="2 new"  deltaTone="negative" sub="last 15 min"/>
      </div>

      {/* Charts grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
        <Widget title="Trips by day" meta="On-time vs. delayed vs. failed" actions={<MIcoDots/>}>
          <EChart option={tripsOpt} height={220}/>
        </Widget>
        <Widget title="Exposure distribution" meta="Across 1,284 trips" actions={<MIcoDots/>}>
          <EChart option={exposureOpt} height={220}/>
        </Widget>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: chatBuiltWidget ? "1fr 1fr 1fr" : "1fr 1fr", gap: 12 }}>
        <Widget title="Fuel consumption trend" meta="L/100km · rolling 14-day" actions={<MIcoDots/>}>
          <EChart option={fuelOpt} height={180}/>
        </Widget>
        <Widget title="Fleet utilization by faena" meta="% capacity in use" actions={<MIcoDots/>}>
          <EChart option={utilOpt} height={180}/>
        </Widget>
        {chatBuiltWidget && (
          <Widget title={chatBuiltWidget.title} meta={chatBuiltWidget.meta} highlight
            actions={<span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "#D18900", fontWeight: 600 }}>
              <span>{MIco.sparkle}</span>Built by agent
            </span>}>
            <EChart option={chatBuiltWidget.option} height={180}/>
          </Widget>
        )}
      </div>
    </div>
  );
}

function MIcoDots() {
  return <button style={{ background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer", padding: 4 }}>{MIco.dots}</button>;
}

Object.assign(window, { Dashboard });
