// Storytelling.jsx — Live-data narrative canvas
const { useState: useSt, useRef: useStR, useEffect: useStE } = React;

// ── Section renderers ────────────────────────────────────────────────────
function StHeading({ section, onEdit }) {
  return (
    <div style={{ padding: "24px 32px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
        {section.eyebrow}
      </div>
      <h1 style={{ margin: 0, fontFamily: "Inter", fontSize: 38, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
        {section.title}
      </h1>
      {section.subtitle && (
        <p style={{ margin: "12px auto 0", maxWidth: 620, fontSize: 14.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
          {section.subtitle}
        </p>
      )}
    </div>
  );
}

function StMetrics({ section }) {
  return (
    <div style={{ padding: "0 32px", display: "grid", gridTemplateColumns: `repeat(${section.items.length}, 1fr)`, gap: 12 }}>
      {section.items.map((m, i) => (
        <div key={i} style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: "18px 16px",
        }}>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{m.label}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{m.value}</span>
            {m.delta && <span style={{ fontSize: 12, color: m.tone === "pos" ? "#86EFAC" : m.tone === "neg" ? "#FCA5A5" : "#D1D5DB", fontWeight: 500 }}>{m.delta}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>{m.sub}</div>
        </div>
      ))}
    </div>
  );
}

function StText({ section }) {
  return (
    <div style={{ padding: "0 32px" }}>
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: "20px 24px",
      }}>
        {section.eyebrow && (
          <div style={{ fontSize: 10.5, color: "#FDE68A", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(253,230,138,0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>{section.num}</span>
            <span>{section.eyebrow}</span>
          </div>
        )}
        <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>
          {section.title}
        </h3>
        <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {section.body}
        </div>
      </div>
    </div>
  );
}

function StChart({ section }) {
  const chartRef = useStR(null);
  useStE(() => {
    if (!chartRef.current || !window.echarts) return;
    const inst = window.echarts.init(chartRef.current);
    inst.setOption(section.option);
    const ro = new ResizeObserver(() => inst.resize());
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); inst.dispose(); };
  }, []);
  return (
    <div style={{ padding: "0 32px" }}>
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: "20px 24px",
      }}>
        <div style={{ fontSize: 10.5, color: "#86EFAC", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }}/>
          <span>Live data · {section.source}</span>
        </div>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 600, color: "#fff" }}>{section.title}</h3>
        {section.caption && <p style={{ margin: "0 0 14px", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{section.caption}</p>}
        <div ref={chartRef} style={{ width: "100%", height: 240 }}/>
      </div>
    </div>
  );
}

function StQuote({ section }) {
  return (
    <div style={{ padding: "0 32px" }}>
      <div style={{ padding: "24px 24px 24px 40px", borderLeft: "3px solid #FDE68A", position: "relative" }}>
        <span style={{ position: "absolute", left: 8, top: 18, color: "#FDE68A", fontSize: 28, fontFamily: "Georgia", lineHeight: 1 }}>“</span>
        <p style={{ margin: 0, fontSize: 17, color: "rgba(255,255,255,0.9)", lineHeight: 1.55, fontStyle: "italic", fontWeight: 400, letterSpacing: "-0.005em" }}>
          {section.quote}
        </p>
        <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>— {section.attribution}</div>
      </div>
    </div>
  );
}

// ── Section types catalog ────────────────────────────────────────────────
const ST_SECTION_TYPES = [
  { id: "text",   label: "Context",   icon: MIco.text, tone: "#60A5FA" },
  { id: "chart",  label: "Live chart", icon: MIco.bars, tone: "#86EFAC" },
  { id: "metric", label: "Metrics",   icon: MIco.pie,  tone: "#F1B300" },
  { id: "quote",  label: "Quote",     icon: MIco.quote, tone: "#FDE68A" },
  { id: "flow",   label: "Workflow",  icon: MIco.workflow, tone: "#C4B5FD" },
];

// ── Default story content ────────────────────────────────────────────────
const DEFAULT_STORY = [
  { type: "heading", eyebrow: "Compliance · Q1 2026", title: "Q1 compliance in one page",
    subtitle: "What happened across 4,218 trips, 312 drivers, and 7 faenas this quarter — with live bindings so every figure updates on refresh." },
  { type: "metric", items: [
    { label: "On-time rate",     value: "92.4%", delta: "+3.1 pp", tone: "pos", sub: "vs. Q4 2025" },
    { label: "Medical renewals", value: "287",   delta: "on time",  tone: "pos", sub: "out of 293 due" },
    { label: "Incidents",        value: "4",     delta: "−2",       tone: "pos", sub: "all resolved" },
    { label: "Avg. audit score", value: "8.6",   delta: "+0.4",     tone: "pos", sub: "out of 10" },
  ] },
  { type: "text", num: "01", eyebrow: "Context", title: "Why this quarter mattered",
    body: "Q1 was the first full quarter running on the consolidated MIOT plane. Fleet, HR, and compliance signals now feed a single audit trail — meaning every POD, every medical renewal, every incident is traceable to the operator who confirmed it, the sensor that flagged it, and the workflow that moved it forward.\n\nThe numbers below are not end-of-quarter snapshots. They refresh from the source systems every time this page is opened." },
  { type: "chart",
    title: "On-time rate by week",
    caption: "Bars show percentage; overlay tracks incident count.",
    source: "Fleet API · Compliance DB",
    option: {
      grid: { left: 42, right: 42, top: 16, bottom: 26 },
      xAxis: { type: "category", data: Array.from({length: 13}, (_,i)=>`W${i+1}`),
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } }, axisLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10.5 } },
      yAxis: [
        { type: "value", max: 100, splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } }, axisLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10.5, formatter: "{value}%" } },
        { type: "value", splitLine: { show: false }, axisLabel: { color: "rgba(255,255,255,0.35)", fontSize: 10, formatter: "{value} inc" } },
      ],
      tooltip: { trigger: "axis" },
      series: [
        { name: "On-time", type: "bar", data: [88,89,91,90,93,94,92,91,93,94,92,95,93], barWidth: 14,
          itemStyle: { color: "#10B981", borderRadius: [3,3,0,0] } },
        { name: "Incidents", type: "line", yAxisIndex: 1, data: [2,1,0,1,0,0,1,0,0,0,0,0,0], smooth: true,
          symbol: "circle", symbolSize: 5, lineStyle: { color: "#FDE68A", width: 1.5 }, itemStyle: { color: "#FDE68A" } },
      ],
    },
  },
  { type: "text", num: "02", eyebrow: "What drove it", title: "Medical renewals caught up",
    body: "The medical-renewal backlog from Q4 cleared in the first six weeks. HR switched to the assistant-driven auto-schedule flow in week 3, which eliminated the last pockets of manual follow-up and pushed the renewal lead time from 4.2 days to under 24 hours." },
  { type: "quote", quote: "We stopped chasing drivers about paperwork. The system tells them, schedules the exam, and blocks assignments until they close the loop.",
    attribution: "Claudia Torres, HR Operations" },
];

// ── Main component ───────────────────────────────────────────────────────
function Storytelling({ seed, onOpenChat }) {
  const [sections, setSections] = useSt(seed || DEFAULT_STORY);
  const [selected, setSelected] = useSt(null);
  const [hover, setHover] = useSt(null);

  function renderSection(s, i) {
    const common = { key: i };
    switch (s.type) {
      case "heading": return <StHeading {...common} section={s}/>;
      case "metric":  return <StMetrics {...common} section={s}/>;
      case "text":    return <StText {...common} section={s}/>;
      case "chart":   return <StChart {...common} section={s}/>;
      case "quote":   return <StQuote {...common} section={s}/>;
      default: return null;
    }
  }

  return (
    <div style={{
      flex: 1, minWidth: 0, overflow: "auto", height: "100%",
      background: "radial-gradient(ellipse at 50% -10%, #1E1B4B 0%, #0B0D14 55%)",
      color: "#fff", position: "relative",
    }}>
      {/* Toolbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 5,
        display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(11,13,20,0.7)", backdropFilter: "blur(10px)",
      }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#FDE68A" }}>{MIco.story}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Q1 compliance in one page</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 999 }}>
            Live · auto-refresh
          </span>
        </div>
        <button onClick={onOpenChat} style={{
          display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(253,230,138,0.12)",
          color: "#FDE68A", border: "1px solid rgba(253,230,138,0.3)", borderRadius: 7,
          padding: "6px 10px", fontSize: 12, fontWeight: 500, fontFamily: "Inter", cursor: "pointer",
        }}>{MIco.sparkle} Ask to regenerate</button>
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,0.06)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 7, padding: "6px 10px", fontSize: 12, fontFamily: "Inter", cursor: "pointer",
        }}>{MIco.share} Share</button>
        <button style={{
          background: "#fff", color: "#111928", border: "none",
          borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 500, fontFamily: "Inter", cursor: "pointer",
        }}>Publish</button>
      </div>

      {/* Canvas */}
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "40px 0 80px", display: "flex", flexDirection: "column", gap: 28 }}>
        {sections.map((s, i) => (
          <div key={i}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onClick={() => setSelected(i)}
            style={{ position: "relative", cursor: "pointer",
              outline: selected === i ? "1px solid rgba(253,230,138,0.4)" : "none",
              outlineOffset: 8, borderRadius: 14,
            }}>
            {renderSection(s, i)}
            {(hover === i || selected === i) && (
              <div style={{
                position: "absolute", right: 24, top: -4, display: "flex", gap: 4,
                background: "#0B0D14", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: 3,
              }}>
                <button style={stPillBtn}>{MIco.edit}</button>
                <button style={stPillBtn}>{MIco.sparkle}</button>
                <button style={stPillBtn}>{MIco.dots}</button>
              </div>
            )}
          </div>
        ))}

        {/* Add section inline */}
        <div style={{ padding: "0 32px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "14px 18px", borderRadius: 12,
            border: "1px dashed rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.02)",
            cursor: "pointer", color: "rgba(255,255,255,0.6)", fontSize: 13,
          }}>
            <span>{MIco.plus}</span>
            <span>Add section · or</span>
            <button onClick={onOpenChat} style={{ background: "transparent", border: "none", color: "#FDE68A", fontSize: 13, cursor: "pointer", padding: 0, fontFamily: "Inter", fontWeight: 500 }}>
              ask the assistant to write one
            </button>
            <span style={{ flex: 1 }}/>
            <div style={{ display: "flex", gap: 6 }}>
              {ST_SECTION_TYPES.map(t => (
                <span key={t.id} title={t.label} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  color: t.tone, padding: "3px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 500,
                }}>{t.icon} {t.label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const stPillBtn = {
  background: "transparent", border: "none", color: "rgba(255,255,255,0.7)",
  padding: 6, borderRadius: 5, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
};

Object.assign(window, { Storytelling });
