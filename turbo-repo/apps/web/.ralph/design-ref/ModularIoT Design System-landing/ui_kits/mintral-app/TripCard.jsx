// TripCard.jsx — a single kanban trip card
function TripCard({ trip, onClick, alert }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={alert ? "mintral-alert-pulse" : ""}
      style={{
        background: "#fff",
        border: `1px solid ${alert ? "#FDA4AF" : "#E5E7EB"}`,
        borderRadius: 8, padding: 12, marginBottom: 8, cursor: "pointer",
        boxShadow: hov ? "0 4px 6px -1px rgba(0,0,0,0.10),0 2px 4px -1px rgba(0,0,0,0.06)" : "none",
        transition: "box-shadow 120ms",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6B7280" }}>{trip.code}</span>
        <Badge tone={trip.tone} dot>{trip.status}</Badge>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#111928", lineHeight: 1.35, marginBottom: 4 }}>
        {trip.title}
      </div>
      <div style={{ fontSize: 12, color: "#4B5563", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon.truck style={{ width: 14, height: 14, color: "#6B7280" }}/>
        <span>{trip.driver}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#6B7280" }}>
        {trip.eta && <><Icon.clock/><span>ETA {trip.eta}</span></>}
        {trip.weight && <span style={{ background:"#F3F4F6", padding:"2px 6px", borderRadius:4 }}>{trip.weight}</span>}
        <span style={{ flex: 1 }}/>
        <Avatar initials={trip.avInit} color={trip.avColor || "#1C64F2"} size={22}/>
      </div>
    </div>
  );
}

Object.assign(window, { TripCard });
