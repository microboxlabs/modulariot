// Drawer.jsx — right-side trip details
function Drawer({ trip, onClose }) {
  if (!trip) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(17,25,40,0.45)", zIndex: 20,
      }}/>
      <aside style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: 480, background: "#fff",
        zIndex: 21, boxShadow: "-10px 0 30px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          height: 64, padding: "0 20px", borderBottom: "1px solid #E5E7EB",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "monospace" }}>{trip.code}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#111928" }}>{trip.title}</div>
          </div>
          <IconButton icon={<Icon.x/>} label="Close" onClick={onClose}/>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            <Badge tone={trip.tone}>{trip.status}</Badge>
            <Badge tone="neutral" dot={false}>Faena SCL</Badge>
            <Badge tone="info">GPS activo</Badge>
          </div>

          <Section title="Trip information">
            <Row label="Service #" value="SRV-228147"/>
            <Row label="Client Code" value="ESC-14"/>
            <Row label="Origin" value="Minera Escondida · Gate 3"/>
            <Row label="Destination" value="Puerto Coloso"/>
            <Row label="Departure date" value="17 Aug 2024 · 08:00"/>
            <Row label="Service Kind" value="Concentrado de cobre"/>
          </Section>

          <Section title="Transport">
            <Row label="License plate" value="JLXT-72"/>
            <Row label="Transport #" value="TR-21099"/>
            <Row label="Weight" value={trip.weight || "—"}/>
            <Row label="Carrier" value="Transportes del Norte SpA"/>
          </Section>

          <Section title="Driver">
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0" }}>
              <Avatar initials={trip.avInit} color={trip.avColor || "#1C64F2"} size={40}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#111928" }}>{trip.driver}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>RUT 16.472.091-4 · Licencia A5</div>
              </div>
              <Badge tone="success">Autorizado</Badge>
            </div>
          </Section>

          <Section title="Timeline">
            {[
              { t: "08:00", e: "Dispatched from Gate 3", ok: true },
              { t: "09:14", e: "Driver validated · ID + fingerprint", ok: true },
              { t: "09:22", e: "Sent to Control Tower", ok: true },
              { t: "09:30", e: "SOVOS digital signature confirmed", ok: true },
              { t: "10:01", e: "Trip started", ok: true },
              { t: trip.eta || "—", e: "Confirm destination arrival", ok: false },
            ].map((ev, i, arr) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "6px 0" }}>
                <div style={{
                  width: 20, display: "flex", flexDirection: "column", alignItems: "center",
                }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: ev.ok ? "#0E9F6E" : "#E5E7EB",
                    border: ev.ok ? "none" : "2px solid #D1D5DB",
                    marginTop: 5,
                  }}/>
                  {i < arr.length - 1 && <span style={{ width: 2, flex: 1, background: "#E5E7EB", minHeight: 18 }}/>}
                </div>
                <div style={{ flex: 1, paddingBottom: 8 }}>
                  <div style={{ fontSize: 13, color: ev.ok ? "#111928" : "#6B7280", fontWeight: 500 }}>{ev.e}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "monospace" }}>{ev.t}</div>
                </div>
              </div>
            ))}
          </Section>
        </div>
        <div style={{
          borderTop: "1px solid #E5E7EB", padding: "12px 20px",
          display: "flex", gap: 8, justifyContent: "flex-end",
        }}>
          <Button variant="secondary">Return to Overlord</Button>
          <Button variant="primary">Confirm arrival</Button>
        </div>
      </aside>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{title}</div>
      <div>{children}</div>
    </section>
  );
}
function Row({ label, value }) {
  return (
    <div style={{ display: "flex", padding: "6px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
      <span style={{ width: 130, color: "#6B7280" }}>{label}</span>
      <span style={{ flex: 1, color: "#111928" }}>{value}</span>
    </div>
  );
}

Object.assign(window, { Drawer });
