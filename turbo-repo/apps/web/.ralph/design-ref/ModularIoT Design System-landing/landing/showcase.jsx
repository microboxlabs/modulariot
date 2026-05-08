// showcase.jsx — animated kanban + map widget for the dashboard showcase
const { useState: useSC, useEffect: useSCE } = React;

function KanbanShowcase({ lang }) {
  const [tick, setTick] = useSC(0);
  useSCE(() => {
    const id = setInterval(() => setTick(x => x + 1), 2200);
    return () => clearInterval(id);
  }, []);

  const cols = lang === 'es'
    ? [{ name: "Pendiente", tone: "#F59E0B", bg: "#FEF3C7", fg: "#D97706" },
       { name: "En curso", tone: "#1C64F2", bg: "#E1EFFE", fg: "#1A56DB" },
       { name: "Aprobada", tone: "#0E9F6E", bg: "#DEF7EC", fg: "#046C4E" }]
    : [{ name: "Pending", tone: "#F59E0B", bg: "#FEF3C7", fg: "#D97706" },
       { name: "In progress", tone: "#1C64F2", bg: "#E1EFFE", fg: "#1A56DB" },
       { name: "Approved", tone: "#0E9F6E", bg: "#DEF7EC", fg: "#046C4E" }];

  // Trips that move across columns
  const trips = [
    { code: "VJ-4821", driver: "O. Mendoza", loc: "Faena Norte", weight: "32t", col: (tick) % 3, alert: tick % 5 === 2 },
    { code: "VJ-4815", driver: "L. Quiroga", loc: "Salar Sur", weight: "28t", col: (tick + 1) % 3, alert: false },
    { code: "VJ-4807", driver: "M. Vargas", loc: "Faena Este", weight: "30t", col: (tick + 2) % 3, alert: false },
    { code: "VJ-4798", driver: "C. Rojas", loc: "Puerto", weight: "31t", col: 2, alert: false },
  ];

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--hairline)", borderRadius: 14, overflow: "hidden",
      boxShadow: "0 24px 60px -30px rgba(15,23,42,0.18)",
    }}>
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid var(--hairline)",
        background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 10,
        fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--ink-3)",
      }}>
        <span className="live-dot"/>
        <span style={{ color: "var(--ink-1)", fontWeight: 500 }}>Torre de control · Mintral</span>
        <span style={{ marginLeft: "auto" }}>12 visibles · ETA 14:32</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: 14, background: "var(--surface-2)" }}>
        {cols.map((col, ci) => (
          <div key={col.name} style={{ minHeight: 280 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: col.fg, background: col.bg,
              padding: "5px 10px", borderRadius: 999, display: "inline-flex", gap: 6,
              alignItems: "center", marginBottom: 10
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: col.tone }}/>
              {col.name}
              <span style={{ color: col.fg, opacity: 0.7 }}>{trips.filter(t => t.col === ci).length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {trips.filter(t => t.col === ci).map(trip => (
                <TripCard key={trip.code} trip={trip} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TripCard({ trip }) {
  return (
    <div style={{
      background: "var(--surface)", border: `1px solid ${trip.alert ? "#FDA4AF" : "var(--hairline)"}`,
      borderRadius: 8, padding: 10,
      boxShadow: trip.alert ? "0 0 0 4px rgba(225,29,72,0.10)" : "none",
      animation: trip.alert ? "alert-pulse 1.4s ease-in-out infinite alternate" : "none",
      transition: "all 300ms",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "var(--ink-3)" }}>{trip.code}</span>
        {trip.alert && (
          <span style={{
            fontSize: 9, color: "#BE123C", background: "#FFE4E6",
            padding: "1px 6px", borderRadius: 999, fontWeight: 600, letterSpacing: "0.04em"
          }}>SÍNTOMA</span>
        )}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-1)", marginBottom: 3 }}>{trip.driver}</div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", display: "flex", justifyContent: "space-between" }}>
        <span>{trip.loc}</span>
        <span style={{ background: "var(--surface-3)", padding: "1px 5px", borderRadius: 4, fontFamily: "ui-monospace, monospace", fontSize: 10 }}>{trip.weight}</span>
      </div>
    </div>
  );
}

function MapShowcase({ lang }) {
  const [tick, setTick] = useSC(0);
  useSCE(() => {
    const id = setInterval(() => setTick(x => x + 1), 1100);
    return () => clearInterval(id);
  }, []);

  const trucks = [
    { id: "T-01", x: 25 + (tick % 10), y: 30, sym: false },
    { id: "T-02", x: 60 + Math.sin(tick / 3) * 8, y: 50 + Math.cos(tick / 4) * 5, sym: tick % 8 < 4 },
    { id: "T-03", x: 40, y: 70 - (tick % 6), sym: false },
    { id: "T-04", x: 75, y: 25, sym: false },
  ];

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 14, overflow: "hidden",
      boxShadow: "0 24px 60px -30px rgba(15,23,42,0.18)",
      height: "100%", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid var(--hairline)",
        background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 10,
        fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--ink-3)",
      }}>
        <span style={{ color: "var(--ink-1)", fontWeight: 500 }}>Mapa · {lang === 'es' ? "vista satelital" : "satellite view"}</span>
        <span style={{ marginLeft: "auto" }}>4 vehículos</span>
      </div>
      <div style={{
        flex: 1, position: "relative", minHeight: 240,
        background: `
          radial-gradient(circle at 20% 30%, rgba(63,131,248,0.08) 0%, transparent 50%),
          radial-gradient(circle at 70% 60%, rgba(14,159,110,0.06) 0%, transparent 50%),
          var(--surface-2)
        `,
        backgroundSize: "100% 100%, 100% 100%, 24px 24px",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(var(--hairline) 1px, transparent 1px), linear-gradient(90deg, var(--hairline) 1px, transparent 1px)`,
          backgroundSize: "32px 32px", opacity: 0.4,
        }}/>
        {/* Geofence */}
        <div style={{
          position: "absolute", left: "15%", top: "15%", width: "55%", height: "55%",
          border: "1.5px dashed var(--accent)", borderRadius: 12, opacity: 0.5,
        }}/>
        {/* Route lines */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <path d="M 80 80 Q 200 100 280 180" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" opacity="0.4"/>
          <path d="M 100 220 Q 180 180 240 140" stroke="var(--ink-4)" strokeWidth="1" strokeDasharray="2 4" fill="none" opacity="0.5"/>
        </svg>
        {/* Trucks */}
        {trucks.map(t => (
          <div key={t.id} style={{
            position: "absolute", left: `${t.x}%`, top: `${t.y}%`,
            transform: "translate(-50%, -50%)",
            transition: "all 1100ms linear",
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              background: t.sym ? "#E11D48" : "#1C64F2",
              boxShadow: t.sym
                ? "0 0 0 6px rgba(225,29,72,0.15), 0 0 14px rgba(225,29,72,0.6)"
                : "0 0 0 4px rgba(28,100,242,0.15)",
              border: "2px solid var(--surface)",
              display: "grid", placeItems: "center",
              color: "#fff", fontSize: 8, fontWeight: 600,
              animation: t.sym ? "alert-pulse 1.2s ease-in-out infinite alternate" : "none",
            }}>
              {t.id.slice(-1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { KanbanShowcase, MapShowcase });
