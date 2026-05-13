// hero-visual.jsx — animated signals→symptoms→action pipeline visual for the hero
const { useState: useHV, useEffect: useHVE, useRef: useHVR } = React;

function HeroVisual({ lang }) {
  const t = useT(lang);
  const [tick, setTick] = useHV(0);
  useHVE(() => {
    const id = setInterval(() => setTick(x => x + 1), 1400);
    return () => clearInterval(id);
  }, []);

  const signals = [
    { k: "gps", label: "gps.lat", v: () => (23.6438 + Math.sin(tick / 5) * 0.0004).toFixed(4) },
    { k: "spd", label: "speed", v: () => `${(82 + (tick % 9)).toFixed(0)} km/h` },
    { k: "rpm", label: "rpm", v: () => `${2800 + ((tick * 17) % 80)}` },
    { k: "tmp", label: "temp.eng", v: () => `${(89 + (tick % 5)).toFixed(0)}°C` },
    { k: "acc", label: "accel", v: () => `${(-0.4 - Math.abs(Math.sin(tick / 3)) * 0.1).toFixed(2)}g` },
  ];
  const behaviors = ["braking.harsh × 3", "speed.over_limit", "lane.deviation"];
  const symptoms = [
    { name: lang === 'es' ? "Fatiga conductor" : "Driver fatigue", sev: 2, color: "#F59E0B" },
    { name: lang === 'es' ? "Salida geocerca" : "Geofence exit", sev: 3, color: "#E11D48" },
  ];
  const actions = [
    { who: "sms → supervisor", at: "14:32:08", ok: true },
    { who: "task → tower", at: "14:32:11", ok: true },
    { who: "trip.hold ack", at: "14:32:14", ok: tick % 3 !== 1 },
  ];

  const flashSignal = tick % signals.length;
  const flashSymptom = (tick / 4 | 0) % symptoms.length;

  return (
    <div className="pipeline-card">
      <div className="pipeline-head">
        <div className="dots"><span className="dot"/><span className="dot"/><span className="dot"/></div>
        <div className="pipeline-title">modulariot · live pipeline</div>
        <div className="pipeline-status">
          <span className="live-dot"/> live
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, padding: 0 }}>
        {/* Signals */}
        <Lane title="signals" tone="#3F83F8">
          {signals.map((s, i) => (
            <Row key={s.k} flash={i === flashSignal} dot="#3F83F8">
              <span style={{ color: "var(--ink-3)" }}>{s.label}</span>
              <span style={{ marginLeft: "auto", color: "var(--ink-1)" }}>{s.v()}</span>
            </Row>
          ))}
        </Lane>
        {/* Behaviors */}
        <Lane title="behaviors" tone="#76A9FA">
          {behaviors.map((b, i) => (
            <Row key={b} flash={i === (tick / 2 | 0) % behaviors.length} dot="#76A9FA">
              <span>{b}</span>
            </Row>
          ))}
          <Row dot="#76A9FA" subtle>
            <span style={{ color: "var(--ink-3)" }}>geofence.near_exit</span>
          </Row>
        </Lane>
        {/* Symptoms */}
        <Lane title="symptoms" tone="#F59E0B">
          {symptoms.map((s, i) => (
            <SymptomRow key={s.name} flash={i === flashSymptom} sym={s} />
          ))}
          <Row dot="#F59E0B" subtle>
            <span style={{ color: "var(--ink-3)" }}>{lang === 'es' ? "Sobrecalent. motor" : "Engine overheat"}</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)" }}>watch</span>
          </Row>
        </Lane>
        {/* Actions */}
        <Lane title="treatments" tone="#0E9F6E" last>
          {actions.map((a, i) => (
            <Row key={a.who} flash={i === (tick / 3 | 0) % actions.length} dot={a.ok ? "#0E9F6E" : "#9CA3AF"}>
              <span>{a.who}</span>
              <span style={{ marginLeft: "auto", color: "var(--ink-3)", fontSize: 10 }}>{a.at}</span>
            </Row>
          ))}
        </Lane>
      </div>

      <div style={{
        borderTop: "1px solid var(--hairline)",
        background: "var(--surface-2)",
        padding: "10px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--ink-3)"
      }}>
        <span>incident #4821 · {lang === 'es' ? "abierto" : "open"} · sev 3</span>
        <span style={{ display: "inline-flex", gap: 12 }}>
          <span>p50 47ms</span>
          <span>p99 112ms</span>
        </span>
      </div>
    </div>
  );
}

function Lane({ title, tone, children, last }) {
  return (
    <div style={{
      borderRight: last ? "none" : "1px solid var(--hairline)",
      padding: "14px 12px",
      display: "flex", flexDirection: "column", gap: 5,
      minHeight: 230,
    }}>
      <div style={{
        fontSize: 9.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
        color: tone, marginBottom: 6, paddingLeft: 2,
        display: "flex", alignItems: "center", gap: 6
      }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: tone, display: "inline-block" }}/>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ children, flash, dot, subtle }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 7px",
      background: flash ? "var(--accent-soft)" : (subtle ? "transparent" : "var(--surface-2)"),
      border: `1px solid ${flash ? "var(--accent)" : "var(--hairline)"}`,
      borderRadius: 6,
      fontFamily: "ui-monospace, monospace", fontSize: 10.5,
      color: "var(--ink-2)",
      transition: "background 400ms, border-color 400ms",
      opacity: subtle ? 0.6 : 1,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }}/>}
      {children}
    </div>
  );
}

function SymptomRow({ sym, flash }) {
  return (
    <div style={{
      padding: "8px 10px",
      background: flash ? "rgba(245, 158, 11, 0.10)" : "var(--surface-2)",
      border: `1px solid ${flash ? "#F59E0B" : "var(--hairline)"}`,
      borderRadius: 6,
      transition: "all 400ms",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: sym.color }}/>
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink-1)" }}>{sym.name}</span>
      </div>
      <div style={{ display: "flex", gap: 6, fontSize: 9.5, color: "var(--ink-3)", fontFamily: "ui-monospace, monospace" }}>
        <span>open</span><span>·</span><span>sev {sym.sev}</span>
      </div>
    </div>
  );
}

Object.assign(window, { HeroVisual });
