// Palette.jsx — ⌘K command palette with "Expand to chat" handoff
const { useState: usePal, useEffect: usePalE, useRef: usePalR, useMemo: usePalM } = React;

const PAL_SUGGESTIONS = [
  { id: "s1", icon: MIco.bars,  label: "Show me top 8 plates by avg. speed last week", hint: "Build widget" },
  { id: "s2", icon: MIco.bolt,  label: "Notify drivers on delayed trips from SCL",     hint: "Live action" },
  { id: "s3", icon: MIco.story, label: "Tell me the story of Q1 compliance",           hint: "Open storytelling" },
  { id: "s4", icon: MIco.check, label: "Approve 3 pending signatures",                 hint: "Review queue" },
];
const PAL_JUMP = [
  { id: "j1", icon: MIco.dash,  label: "Operations dashboard",  hint: "Dashboards" },
  { id: "j2", icon: MIco.story, label: "Storytelling workspace", hint: "Canvas" },
  { id: "j3", icon: MIco.truck, label: "Fleet management",       hint: "Fleet" },
];
const PAL_RECENT = [
  "Fuel spike on faena SCL last 24h",
  "Which drivers are over their speed threshold?",
  "Story: what changed in Q1",
];

function Palette({ onClose, onExpandToChat, onNavigate }) {
  const [q, setQ] = usePal("");
  const [sel, setSel] = usePal(0);
  const input = usePalR(null);
  usePalE(() => { setTimeout(() => input.current?.focus(), 20); }, []);

  function onKey(e) {
    if (e.key === "Escape") return onClose();
    if (e.key === "Enter") {
      e.preventDefault();
      if (q.trim()) onExpandToChat?.(q.trim());
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(17, 25, 40, 0.45)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10vh",
    }} onClick={onClose}>
      <style>{`@keyframes pal-in { from {opacity:0; transform: translateY(-8px)} to {opacity:1; transform: translateY(0)} }`}</style>
      <div onClick={e => e.stopPropagation()} style={{
        width: 640, maxWidth: "92vw", maxHeight: "72vh",
        background: "#fff", borderRadius: 14,
        boxShadow: "0 25px 60px -10px rgba(0,0,0,.35)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        animation: "pal-in 160ms cubic-bezier(.2,.8,.2,1)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
          borderBottom: "1px solid #F3F4F6",
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #D18900, #F1B300)",
            color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>{MIco.sparkle}</span>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Ask, build, or navigate…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontFamily: "Inter", fontSize: 17, color: "#111928", letterSpacing: "-0.005em",
            }}/>
          {q.trim() && (
            <button onClick={() => onExpandToChat(q.trim())} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "#111928", color: "#fff", border: "none", borderRadius: 7,
              padding: "7px 11px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "Inter",
            }}>{MIco.expand} Expand to chat <span style={{fontFamily:"ui-monospace, monospace", fontSize: 10, opacity: 0.7}}>↵</span></button>
          )}
          <button onClick={onClose} style={{
            border: "1px solid #E5E7EB", background: "#F9FAFB", borderRadius: 6,
            padding: "3px 8px", fontSize: 10.5, fontFamily: "ui-monospace, monospace",
            color: "#6B7280", cursor: "pointer",
          }}>esc</button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "8px 8px" }}>
          <PalSection label="Suggestions">
            {PAL_SUGGESTIONS.map((s, i) => (
              <PalRow key={s.id} icon={s.icon} label={s.label} hint={s.hint} accent
                selected={sel === i} onSelect={() => setSel(i)}
                onClick={() => onExpandToChat(s.label)}/>
            ))}
          </PalSection>
          <PalSection label="Jump to">
            {PAL_JUMP.map((s, i) => (
              <PalRow key={s.id} icon={s.icon} label={s.label} hint={s.hint}
                selected={false} onClick={() => { onNavigate(s.id === "j1" ? "dashboard" : s.id === "j2" ? "story" : "fleet"); onClose(); }}/>
            ))}
          </PalSection>
          <PalSection label="Recent">
            {PAL_RECENT.map((r, i) => (
              <PalRow key={i} icon={MIco.clock} label={r} hint="previously asked"
                onClick={() => onExpandToChat(r)}/>
            ))}
          </PalSection>
        </div>

        <div style={{
          borderTop: "1px solid #F3F4F6", padding: "10px 16px", background: "#FAFBFC",
          display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: "#6B7280",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MKbd>↵</MKbd> expand to chat</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><MKbd>esc</MKbd> close</span>
          <span style={{ flex: 1 }}/>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#D18900" }}>{MIco.sparkle}</span>
            <span>Agent · 7 sources</span>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#008A2E" }}/>
          </span>
        </div>
      </div>
    </div>
  );
}

function PalSection({ label, children }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ padding: "8px 14px 4px", fontSize: 10.5, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      {children}
    </div>
  );
}
function PalRow({ icon, label, hint, accent, selected, onSelect, onClick }) {
  const [h, setH] = usePal(false);
  const on = selected || h;
  return (
    <div onMouseEnter={() => { setH(true); onSelect?.(); }} onMouseLeave={() => setH(false)} onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", borderRadius: 8, cursor: "pointer",
        background: on ? "#F9FAFB" : "transparent",
        border: `1px solid ${on ? "#E5E7EB" : "transparent"}`,
      }}>
      <span style={{
        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
        background: accent ? "linear-gradient(135deg, #D18900, #F1B300)" : "#F3F4F6",
        color: accent ? "#fff" : "#4B5563",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#111928", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {hint && <span style={{ fontSize: 10.5, color: accent ? "#D18900" : "#9CA3AF", fontWeight: accent ? 600 : 500, textTransform: accent ? "uppercase" : "none", letterSpacing: accent ? "0.04em" : 0 }}>{hint}</span>}
      <span style={{ color: on ? "#111928" : "transparent" }}>{MIco.arrow}</span>
    </div>
  );
}

Object.assign(window, { Palette });
