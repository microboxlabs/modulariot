// SearchAgent.jsx — MIOT operational copilot
// Invoked by ⌘K from the topbar. Not just search — a natural-language
// interface to the unified operational data plane (fleet, drivers, trips,
// signals, contracts). Combines classic command-palette affordances (jump-to,
// recent, slash-actions) with an AI answer surface that actually queries the
// data.
const { useState: useSA, useEffect: useSAEffect, useRef: useSARef, useMemo: useSAMemo } = React;

// ── Mock operational data ────────────────────────────────────────────────
const SA_TRIPS = [
  { id: "T-4821", plate: "BRTX-42", driver: "Carlos Muñoz", route: "SCL → Los Bronces", tons: 34.2, status: "En ruta", eta: "14:32", delayed: true, delay: 42 },
  { id: "T-4820", plate: "HJKL-89", driver: "Marta Rivas",  route: "SCL → Andina",      tons: 36.0, status: "En ruta", eta: "13:15", delayed: false },
  { id: "T-4819", plate: "VRTY-11", driver: "Pedro Gálvez", route: "SCL → Los Bronces", tons: 32.5, status: "Firmado",  eta: "—",     delayed: false },
  { id: "T-4814", plate: "KLMN-03", driver: "Ana Herrera",  route: "SCL → El Teniente", tons: 35.1, status: "En ruta", eta: "15:48", delayed: true, delay: 18 },
  { id: "T-4812", plate: "QPOR-77", driver: "Luis Bravo",   route: "SCL → Andina",      tons: 33.8, status: "Cargando",eta: "—",     delayed: false },
];
const SA_DRIVERS = [
  { id: "D-212", name: "Carlos Muñoz",  plate: "BRTX-42", medical: "2026-04-24", status: "En ruta" },
  { id: "D-198", name: "Marta Rivas",   plate: "HJKL-89", medical: "2026-04-26", status: "En ruta" },
  { id: "D-145", name: "Pedro Gálvez",  plate: "VRTY-11", medical: "2026-04-27", status: "Disponible" },
  { id: "D-301", name: "Ana Herrera",   plate: "KLMN-03", medical: "2026-05-12", status: "En ruta" },
];
const SA_SIGNALS = [
  { id: "S-1", plate: "BRTX-42", kind: "signal_loss", duration: 14, last: "—33.54, —70.61" },
  { id: "S-2", plate: "KLMN-03", kind: "geofence",    duration: 2,  last: "Corredor B-12" },
];

const SA_ACTIONS = [
  { id: "a.new-trip",   label: "Start new trip",        hint: "Planning → new",           icon: "plus",   kbd: "N T" },
  { id: "a.approve",    label: "Approve pending signatures",  hint: "3 waiting",          icon: "check",  kbd: "A S" },
  { id: "a.driver-new", label: "Enroll new driver",     hint: "Collaborators → add",      icon: "person", kbd: "N D" },
  { id: "a.export-day", label: "Export today's manifest", hint: "CSV, SOVOS-compliant",   icon: "export", kbd: "⌘ E" },
];

const SA_NAV = [
  { id: "nav.tower",    label: "Control Tower",   path: "Control Tower",       icon: "tower" },
  { id: "nav.kanban",   label: "Shipping kanban", path: "Kanban › Shipping",   icon: "kanban" },
  { id: "nav.calendar", label: "Calendar",        path: "Calendar",            icon: "calendar" },
  { id: "nav.fleet",    label: "Fleet management",path: "Fleet Management",    icon: "truck" },
  { id: "nav.collab",   label: "Collaborators",   path: "Collaborators",       icon: "people" },
];

const SA_RECENT = [
  "Trips delayed from Faena SCL",
  "Drivers with medical expiring in 7 days",
  "T-4821",
  "Approve Pedro's pending signature",
];

// ── Inline icon helpers (16×16) ──────────────────────────────────────────
const sa_ico = {
  search:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path strokeLinecap="round" d="M20 20l-3-3"/></svg>,
  plus:     <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>,
  check:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>,
  person:   <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path strokeLinecap="round" d="M4 21c0-4 4-7 8-7s8 3 8 7"/></svg>,
  export:   <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12l-4 4m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>,
  tower:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M7 7h10l-1 4H8zM9 11l-1 10m8-10l1 10"/></svg>,
  kanban:   <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/></svg>,
  calendar: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path strokeLinecap="round" d="M8 3v4M16 3v4M3 10h18"/></svg>,
  truck:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h10v10H3zM13 10h5l3 3v4h-8zM7 20a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z"/></svg>,
  people:   <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path strokeLinecap="round" d="M3 20c0-3 3-5 6-5s6 2 6 5M17 11a2.5 2.5 0 100-5M21 20c0-2-2-4-5-4"/></svg>,
  clock:    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 7v5l3 2"/></svg>,
  arrow:    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>,
  sparkle:  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zM19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14z"/></svg>,
  bolt:     <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>,
};

// ── Keyboard pill ────────────────────────────────────────────────────────
function SAKbd({ children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 10.5, color: "#6B7280", lineHeight: 1,
    }}>
      {String(children).split(" ").map((k, i) => (
        <span key={i} style={{
          background: "#fff", border: "1px solid #E5E7EB", borderBottomWidth: 2,
          borderRadius: 4, padding: "2px 5px", minWidth: 16, textAlign: "center",
        }}>{k}</span>
      ))}
    </span>
  );
}

// ── Trip row (inline result) ─────────────────────────────────────────────
function SATripRow({ t, selected, onSelect }) {
  return (
    <div onMouseMove={onSelect} style={{
      display: "grid", gridTemplateColumns: "72px 100px 1fr 80px 100px 24px",
      alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8,
      background: selected ? "#EBF5FF" : "transparent",
      color: "#111928", fontSize: 13, cursor: "pointer",
      border: `1px solid ${selected ? "#BFDBFE" : "transparent"}`,
    }}>
      <span style={{
        fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600,
        color: selected ? "#1A56DB" : "#374151",
      }}>{t.id}</span>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#6B7280" }}>{t.plate}</span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ color: "#111928", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.driver}</span>
        <span style={{ color: "#6B7280", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.route}</span>
      </span>
      <span style={{ color: "#374151", fontVariantNumeric: "tabular-nums", fontSize: 12 }}>{t.tons} t</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {t.delayed ? (
          <span style={{
            background: "#FEE2E2", color: "#991B1B", fontSize: 11, fontWeight: 500,
            padding: "2px 8px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#DC2626" }}/>
            +{t.delay}m
          </span>
        ) : (
          <span style={{ color: "#6B7280", fontSize: 12 }}>{t.eta}</span>
        )}
      </span>
      <span style={{ color: selected ? "#1A56DB" : "transparent" }}>{sa_ico.arrow}</span>
    </div>
  );
}

// ── Driver row ───────────────────────────────────────────────────────────
function SADriverRow({ d, selected, onSelect }) {
  const days = Math.ceil((new Date(d.medical) - new Date("2026-04-21")) / 86400000);
  const warn = days <= 7;
  return (
    <div onMouseMove={onSelect} style={{
      display: "grid", gridTemplateColumns: "1fr 100px 140px 90px 24px",
      alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8,
      background: selected ? "#EBF5FF" : "transparent",
      color: "#111928", fontSize: 13, cursor: "pointer",
      border: `1px solid ${selected ? "#BFDBFE" : "transparent"}`,
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar initials={d.name.split(" ").map(s=>s[0]).join("").slice(0,2)} size={24}/>
        <span style={{ fontWeight: 500 }}>{d.name}</span>
      </span>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#6B7280" }}>{d.plate}</span>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        color: warn ? "#991B1B" : "#6B7280", fontSize: 12,
      }}>
        {warn && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#DC2626" }}/>}
        Medical · {days}d
      </span>
      <span style={{ color: "#374151", fontSize: 12 }}>{d.status}</span>
      <span style={{ color: selected ? "#1A56DB" : "transparent" }}>{sa_ico.arrow}</span>
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────
function SASection({ label, count, children }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        padding: "8px 14px 4px", fontSize: 10.5, fontWeight: 600,
        color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span>{label}</span>
        {count != null && <span style={{ color: "#9CA3AF", fontWeight: 500 }}>· {count}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Generic row for actions / nav / recents ──────────────────────────────
function SARow({ icon, label, hint, kbd, accent, selected, onSelect }) {
  return (
    <div onMouseMove={onSelect} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
      borderRadius: 8, cursor: "pointer",
      background: selected ? "#EBF5FF" : "transparent",
      border: `1px solid ${selected ? "#BFDBFE" : "transparent"}`,
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: accent || "#F3F4F6", color: accent ? "#fff" : "#4B5563",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 13.5, color: "#111928", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {hint && <span style={{ fontSize: 11.5, color: "#6B7280" }}>{hint}</span>}
      </span>
      {kbd && <SAKbd>{kbd}</SAKbd>}
      <span style={{ color: selected ? "#1A56DB" : "transparent", flexShrink: 0 }}>{sa_ico.arrow}</span>
    </div>
  );
}

// ── Query classifier — decides what the agent "did" ──────────────────────
function classifySA(q) {
  const s = q.trim().toLowerCase();
  if (!s) return { kind: "empty" };
  // Trip id
  if (/^t-?\d{3,}$/i.test(s.replace(/\s/g, ""))) {
    const id = "T-" + s.replace(/[^\d]/g, "");
    const t = SA_TRIPS.find(x => x.id === id);
    return t ? { kind: "direct", trip: t } : { kind: "empty_result", q };
  }
  if (/driver|conductor|medical|medico|license|licencia/.test(s)) {
    return { kind: "agentic", intent: "drivers", q };
  }
  if (/approve|aprobar|sign|firma|pending|pendient/.test(s)) {
    return { kind: "agentic", intent: "approvals", q };
  }
  // Trips first — "delayed trips" should route here, not exceptions
  if (/trip|viaje|shipping|envio|ruta|route|delay|atras|retraso|late|eta/.test(s)) {
    return { kind: "agentic", intent: "trips", q };
  }
  if (/signal|señal|lost|perdid|geofence|exception|excepcion|alert/.test(s)) {
    return { kind: "agentic", intent: "exceptions", q };
  }
  // Free text → treat as agentic "general"
  return { kind: "agentic", intent: "general", q };
}

// ── Agent plan renderer — the "what it did" trace ─────────────────────────
function SAPlan({ steps, activeStep }) {
  return (
    <div style={{
      padding: "10px 14px 12px", borderTop: "1px dashed #E5E7EB",
      borderBottom: "1px dashed #E5E7EB", background: "#FAFBFC",
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, color: "#6B7280",
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ color: "#D18900" }}>{sa_ico.sparkle}</span>
        <span>Agent plan</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map((s, i) => {
          const done = i < activeStep;
          const running = i === activeStep;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, fontSize: 12.5,
              color: done ? "#111928" : running ? "#111928" : "#9CA3AF",
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                background: done ? "#008A2E" : running ? "#fff" : "#F3F4F6",
                border: running ? "2px solid #D18900" : "1px solid #E5E7EB",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "#fff",
              }}>
                {done && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                {running && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D18900", animation: "sa-pulse 1.4s infinite" }}/>}
              </span>
              <span style={{ fontFamily: s.code ? "ui-monospace, monospace" : "Inter", fontSize: s.code ? 11.5 : 12.5 }}>
                {s.label}
              </span>
              {s.source && (
                <span style={{
                  background: "#F3F4F6", color: "#6B7280", fontSize: 10,
                  padding: "1px 6px", borderRadius: 4, fontFamily: "ui-monospace, monospace",
                }}>{s.source}</span>
              )}
              {done && s.ms != null && (
                <span style={{ marginLeft: "auto", color: "#9CA3AF", fontSize: 10.5, fontFamily: "ui-monospace, monospace" }}>{s.ms}ms</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main agent ───────────────────────────────────────────────────────────
function SearchAgent({ onClose }) {
  const [q, setQ] = useSA("");
  const [sel, setSel] = useSA(0);
  const [agentState, setAgentState] = useSA("idle"); // idle | planning | answering | done
  const [activeStep, setActiveStep] = useSA(0);
  const [answer, setAnswer] = useSA("");
  const inputRef = useSARef(null);
  const resultsRef = useSARef(null);

  useSAEffect(() => { inputRef.current?.focus(); }, []);

  const classified = useSAMemo(() => classifySA(q), [q]);

  // When user submits a natural-language question, spin up the plan
  function run() {
    if (!q.trim() || classified.kind === "direct") return;
    setAgentState("planning");
    setActiveStep(0);
    setAnswer("");
    const steps = getPlan(classified);
    // Animate plan steps
    steps.forEach((s, i) => {
      setTimeout(() => {
        setActiveStep(i + 1);
        if (i === steps.length - 1) {
          setAgentState("answering");
          streamAnswer(classified);
        }
      }, s.delay);
    });
  }

  function streamAnswer(c) {
    const full = getAnswer(c);
    let i = 0;
    const tick = () => {
      i += 2;
      setAnswer(full.slice(0, i));
      if (i < full.length) setTimeout(tick, 18);
      else setAgentState("done");
    };
    tick();
  }

  function onKey(e) {
    if (e.key === "Escape") return onClose?.();
    if (e.key === "Enter") {
      if (agentState === "idle" && q.trim()) { e.preventDefault(); run(); }
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => s + 1); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
  }

  const showDefault = !q.trim();
  const plan = agentState !== "idle" ? getPlan(classified) : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(17, 25, 40, 0.45)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "10vh",
    }} onClick={onClose}>
      <style>{`
        @keyframes sa-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
        @keyframes sa-caret { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
        @keyframes sa-in    { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
      <div onClick={e => e.stopPropagation()} style={{
        width: 720, maxWidth: "92vw", maxHeight: "80vh",
        background: "#fff", borderRadius: 14,
        boxShadow: "0 25px 60px -10px rgba(0,0,0,.35), 0 10px 20px -6px rgba(0,0,0,.12)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        animation: "sa-in 160ms cubic-bezier(.2,.8,.2,1)",
      }}>

        {/* INPUT BAR */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
          borderBottom: "1px solid #F3F4F6",
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #D18900, #F1B300)",
            color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>{sa_ico.sparkle}</span>
          <input ref={inputRef}
            value={q}
            onChange={e => { setQ(e.target.value); setAgentState("idle"); setAnswer(""); setSel(0); }}
            onKeyDown={onKey}
            placeholder="Ask MIOT — trips, drivers, signals, actions…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontFamily: "Inter", fontSize: 17, color: "#111928", letterSpacing: "-0.005em",
            }}/>
          {agentState === "idle" && q.trim() && classified.kind !== "direct" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#6B7280", fontSize: 11.5 }}>
              <span>Press</span><SAKbd>↵</SAKbd><span>to ask agent</span>
            </span>
          )}
          {agentState !== "idle" && agentState !== "done" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#D18900", fontSize: 12, fontWeight: 500 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D18900", animation: "sa-pulse 1s infinite" }}/>
              {agentState === "planning" ? "Planning" : "Answering"}
            </span>
          )}
          <button onClick={onClose} style={{
            border: "1px solid #E5E7EB", background: "#F9FAFB", borderRadius: 6,
            padding: "3px 8px", fontSize: 10.5, fontFamily: "ui-monospace, monospace",
            color: "#6B7280", cursor: "pointer",
          }}>esc</button>
        </div>

        {/* BODY */}
        <div ref={resultsRef} style={{ flex: 1, overflow: "auto", padding: "6px 8px" }}>

          {/* Default state: recent + actions + nav */}
          {showDefault && (
            <>
              <SASection label="Suggestions" count={null}>
                <SARow icon={sa_ico.sparkle} accent="#D18900"
                  label="Which trips from Faena SCL are delayed right now?"
                  hint="Agent · fleet + signals · realtime"
                  selected={sel === 0} onSelect={() => setSel(0)}/>
                <SARow icon={sa_ico.sparkle} accent="#D18900"
                  label="Drivers with medical expiring in the next 7 days"
                  hint="Agent · compliance · scheduled"
                  selected={sel === 1} onSelect={() => setSel(1)}/>
                <SARow icon={sa_ico.sparkle} accent="#D18900"
                  label="Summarize today's exceptions across all faenas"
                  hint="Agent · multi-source"
                  selected={sel === 2} onSelect={() => setSel(2)}/>
              </SASection>

              <SASection label="Quick actions">
                {SA_ACTIONS.map((a, i) => (
                  <SARow key={a.id} icon={sa_ico[a.icon]} label={a.label} hint={a.hint} kbd={a.kbd}
                    selected={sel === i + 3} onSelect={() => setSel(i + 3)}/>
                ))}
              </SASection>

              <SASection label="Jump to">
                {SA_NAV.map((n, i) => (
                  <SARow key={n.id} icon={sa_ico[n.icon]} label={n.label} hint={n.path}
                    selected={sel === i + 7} onSelect={() => setSel(i + 7)}/>
                ))}
              </SASection>

              <SASection label="Recent">
                {SA_RECENT.map((r, i) => (
                  <SARow key={i} icon={sa_ico.clock} label={r} hint="Previously asked"
                    selected={sel === i + 12} onSelect={() => setSel(i + 12)}/>
                ))}
              </SASection>
            </>
          )}

          {/* Direct match — instant (no agent) */}
          {classified.kind === "direct" && (
            <>
              <SASection label={`Trip match`} count={1}>
                <SATripRow t={classified.trip} selected={true}/>
              </SASection>
              <div style={{ padding: "8px 14px 12px", fontSize: 11.5, color: "#6B7280" }}>
                Exact ID match — press <SAKbd>↵</SAKbd> to open trip, or keep typing to ask the agent instead.
              </div>
            </>
          )}

          {/* Agentic flow */}
          {classified.kind === "agentic" && agentState !== "idle" && (
            <>
              <SAPlan steps={plan} activeStep={activeStep}/>
              {(agentState === "answering" || agentState === "done") && (
                <div style={{ padding: "14px 18px 4px" }}>
                  <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#111928", whiteSpace: "pre-wrap" }}>
                    {answer}
                    {agentState === "answering" && <span style={{ display: "inline-block", width: 8, height: 15, background: "#111928", marginLeft: 2, verticalAlign: "-2px", animation: "sa-caret 1s infinite" }}/>}
                  </div>
                </div>
              )}
              {agentState === "done" && renderAgentResults(classified)}
            </>
          )}

          {classified.kind === "agentic" && agentState === "idle" && q.trim() && (
            <div style={{ padding: "18px 18px 8px" }}>
              <div style={{
                padding: "14px 16px", borderRadius: 10, background: "#FFFAEB",
                border: "1px solid #FDE68A", display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ color: "#D18900" }}>{sa_ico.sparkle}</span>
                <div style={{ flex: 1, fontSize: 13.5, color: "#451A03", lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Ask the MIOT agent</div>
                  <div style={{ color: "#7C2D12" }}>
                    I'll query fleet, drivers, signals, and contracts — then give you a plan and actions.
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={run} icon={sa_ico.bolt}>Ask agent</Button>
              </div>
            </div>
          )}

          {classified.kind === "empty_result" && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#6B7280", fontSize: 13.5 }}>
              No trip matches <span style={{ fontFamily: "ui-monospace, monospace", color: "#111928" }}>"{q}"</span>.
              Try a plate, driver name, or ask the agent a question.
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          borderTop: "1px solid #F3F4F6", padding: "10px 16px",
          background: "#FAFBFC", display: "flex", alignItems: "center", gap: 16,
          fontSize: 11, color: "#6B7280",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <SAKbd>↑ ↓</SAKbd> navigate
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <SAKbd>↵</SAKbd> {classified.kind === "agentic" ? "ask agent" : classified.kind === "direct" ? "open" : "select"}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <SAKbd>esc</SAKbd> close
          </span>
          <span style={{ flex: 1 }}/>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#D18900" }}>{sa_ico.sparkle}</span>
            <span>Agent connected · 7 data sources</span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#008A2E" }}/>
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Plan definitions per intent ──────────────────────────────────────────
function getPlan(c) {
  if (c.kind !== "agentic") return [];
  const common = [
    { label: "Parse query → structured intent", source: "LLM", delay: 280, ms: 240 },
  ];
  const byIntent = {
    trips: [
      { label: "fleet.trips.find({ status: 'en_ruta', faena: 'SCL' })", source: "Fleet API", code: true, delay: 680, ms: 380 },
      { label: "signals.realtime.join(trips) → delay calc", source: "GPS stream", code: true, delay: 1120, ms: 410 },
      { label: "Rank by severity · format response", source: "LLM", delay: 1520, ms: 320 },
    ],
    exceptions: [
      { label: "signals.realtime.stream(last_15m)", source: "GPS stream", code: true, delay: 620, ms: 280 },
      { label: "trips.anomaly_detect(threshold=10m)", source: "Fleet API", code: true, delay: 1100, ms: 420 },
      { label: "Compose operator summary", source: "LLM", delay: 1520, ms: 380 },
    ],
    drivers: [
      { label: "hr.drivers.query({ medical_expires_within: '7d' })", source: "HR", code: true, delay: 700, ms: 360 },
      { label: "Join with current assignment state", source: "Fleet API", code: true, delay: 1100, ms: 280 },
      { label: "Compose actionable list", source: "LLM", delay: 1440, ms: 260 },
    ],
    approvals: [
      { label: "kanban.signatures.pending.list()", source: "Kanban DB", code: true, delay: 660, ms: 240 },
      { label: "Check permissions · surface actions", source: "LLM", delay: 1080, ms: 290 },
    ],
    general: [
      { label: "Decompose into sub-questions", source: "LLM", delay: 520, ms: 290 },
      { label: "Query relevant data sources", source: "MIOT plane", code: true, delay: 1200, ms: 560 },
      { label: "Synthesize answer", source: "LLM", delay: 1720, ms: 360 },
    ],
  };
  return [...common, ...(byIntent[c.intent] || byIntent.general)];
}

// ── Canned answers per intent ────────────────────────────────────────────
function getAnswer(c) {
  if (c.intent === "trips") {
    return "2 trips delayed from Faena SCL right now. T-4821 (Carlos Muñoz) is +42m behind schedule — last GPS fix shows it stationary near KM 38 for 11 minutes. T-4814 (Ana Herrera) is +18m, likely recoverable. The other 3 in-flight trips are on time.";
  }
  if (c.intent === "exceptions") {
    return "Two exceptions in the last 15 minutes. BRTX-42 has lost GPS signal for 14 minutes on the SCL → Los Bronces route. KLMN-03 entered geofence B-12 two minutes ago (expected). No alerts from vital-signs sensors.";
  }
  if (c.intent === "drivers") {
    return "Three drivers have medical certificates expiring in the next 7 days. Carlos Muñoz (D-212) expires on Apr 24 — currently on trip T-4821. Marta Rivas (D-198) expires Apr 26. Pedro Gálvez (D-145) expires Apr 27. I can auto-schedule medicals and block new assignments until renewed.";
  }
  if (c.intent === "approvals") {
    return "3 signatures are waiting for dispatcher approval. Pedro Gálvez (T-4819), final delivery signature · 12 min ago. Two earlier ones from yesterday's shift. All three look clean — no exceptions flagged.";
  }
  return "I checked fleet, drivers, signals, and today's shift log. Nothing above your attention threshold right now: 5 trips in-flight, 2 on schedule, 2 with manageable delay, 1 loading. One pending approval. Ask a more specific question — or try 'exceptions today' for the watchlist view.";
}

// ── Inline result cards after agent answer ────────────────────────────────
function renderAgentResults(c) {
  if (c.intent === "trips") {
    const delayed = SA_TRIPS.filter(t => t.delayed);
    return (
      <>
        <SASection label="Affected trips" count={delayed.length}>
          {delayed.map((t, i) => <SATripRow key={t.id} t={t} selected={i === 0}/>)}
        </SASection>
        <SAActionBar actions={[
          { label: "Open in Control Tower", primary: true },
          { label: "Notify dispatchers", icon: sa_ico.bolt },
          { label: "Export incident CSV" },
        ]}/>
      </>
    );
  }
  if (c.intent === "drivers") {
    return (
      <>
        <SASection label="Drivers at risk" count={3}>
          {SA_DRIVERS.slice(0, 3).map((d, i) => <SADriverRow key={d.id} d={d} selected={i === 0}/>)}
        </SASection>
        <SAActionBar actions={[
          { label: "Schedule medicals", primary: true, icon: sa_ico.bolt },
          { label: "Open HR directory" },
          { label: "Block new assignments", danger: true },
        ]}/>
      </>
    );
  }
  if (c.intent === "exceptions") {
    return (
      <>
        <SASection label="Active exceptions" count={SA_SIGNALS.length}>
          {SA_SIGNALS.map((s, i) => (
            <div key={s.id} style={{
              display: "grid", gridTemplateColumns: "100px 1fr 140px 24px",
              alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8,
              background: i === 0 ? "#FEF2F2" : "transparent",
              border: `1px solid ${i === 0 ? "#FECACA" : "transparent"}`, fontSize: 13,
            }}>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#6B7280" }}>{s.plate}</span>
              <span>
                <span style={{ fontWeight: 500, color: "#111928" }}>{s.kind === "signal_loss" ? "Signal loss" : "Geofence entry"}</span>
                <span style={{ color: "#6B7280", fontSize: 12, marginLeft: 8 }}>{s.last}</span>
              </span>
              <span style={{
                background: s.kind === "signal_loss" ? "#FEE2E2" : "#DBEAFE",
                color: s.kind === "signal_loss" ? "#991B1B" : "#1E40AF",
                fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999,
                justifySelf: "start",
              }}>{s.duration}m {s.kind === "signal_loss" ? "dark" : "inside"}</span>
              <span style={{ color: i === 0 ? "#991B1B" : "transparent" }}>{sa_ico.arrow}</span>
            </div>
          ))}
        </SASection>
        <SAActionBar actions={[
          { label: "Open Control Tower map", primary: true },
          { label: "Radio vehicle", icon: sa_ico.bolt },
        ]}/>
      </>
    );
  }
  if (c.intent === "approvals") {
    return (
      <SAActionBar actions={[
        { label: "Review 3 pending signatures", primary: true, icon: sa_ico.check },
        { label: "Delegate to shift lead" },
      ]}/>
    );
  }
  return null;
}

function SAActionBar({ actions }) {
  return (
    <div style={{
      display: "flex", gap: 8, padding: "4px 14px 14px", flexWrap: "wrap",
    }}>
      {actions.map((a, i) => (
        <button key={i} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 12px", fontSize: 12.5, fontWeight: 500,
          fontFamily: "Inter", borderRadius: 8, cursor: "pointer",
          border: "1px solid " + (a.primary ? "transparent" : a.danger ? "#FECACA" : "#E5E7EB"),
          background: a.primary ? "#1C64F2" : a.danger ? "#FEF2F2" : "#fff",
          color: a.primary ? "#fff" : a.danger ? "#991B1B" : "#374151",
        }}>
          {a.icon}{a.label}
        </button>
      ))}
    </div>
  );
}

Object.assign(window, { SearchAgent });
