// KanbanBoard.jsx
function KanbanBoard({ onOpen }) {
  const columns = [
    { id: "validation", title: "Driver / Transport Validation", count: 3, cards: [
      { code: "VJ-24-8710", status: "Pendiente", tone: "pending", title: "Camión 412 · Tocopilla → Antofagasta", driver: "Juan Pérez R.", eta: "14:32", weight: "22 t", avInit: "JP" },
      { code: "VJ-24-8711", status: "Pendiente", tone: "pending", title: "Camión 118 · Calama → Mejillones", driver: "Marta Cofré", eta: "15:10", weight: "19 t", avInit: "MC", avColor: "#F59E0B" },
      { code: "VJ-24-8714", status: "Rechazada", tone: "danger", title: "Camión 207 · Sin coordinación", driver: "Roberto Salas", eta: null, weight: "—", avInit: "RS", avColor: "#E11D48" },
    ]},
    { id: "tower", title: "Mission Control — Start Trip", count: 2, cards: [
      { code: "VJ-24-8702", status: "Aprobada", tone: "success", title: "Camión 301 · Chuquicamata → Antofagasta", driver: "Luis Mora", eta: "13:45", weight: "24 t", avInit: "LM", avColor: "#0E9F6E" },
      { code: "VJ-24-8703", status: "Requiere Overlord", tone: "solidWarn", title: "Camión 412 · Sin firma Sovos", driver: "Elena Vásquez", eta: null, weight: "21 t", avInit: "EV", avColor: "#F59E0B", alert: true },
    ]},
    { id: "firma", title: "Sovos Digital Signature", count: 1, cards: [
      { code: "VJ-24-8698", status: "En firma", tone: "info", title: "Camión 508 · Escondida → Coloso", driver: "Pablo Reinoso", eta: "—", weight: "27 t", avInit: "PR" },
    ]},
    { id: "inCourse", title: "Monitoring In Course", count: 4, cards: [
      { code: "VJ-24-8690", status: "En curso", tone: "info", title: "Camión 412 · Antofagasta → Coloso", driver: "Juan Pérez R.", eta: "16:08", weight: "22 t", avInit: "JP" },
      { code: "VJ-24-8691", status: "En curso", tone: "info", title: "Camión 201 · Calama → Baquedano", driver: "Ana Torres", eta: "15:55", weight: "18 t", avInit: "AT" },
      { code: "VJ-24-8692", status: "GPS sin señal", tone: "danger", title: "Camión 304 · Ruta 5 Norte", driver: "Diego Salinas", eta: "—", weight: "20 t", avInit: "DS", avColor: "#E11D48", alert: true },
      { code: "VJ-24-8693", status: "En curso", tone: "info", title: "Camión 115 · Radomiro → Tocopilla", driver: "Luis Mora", eta: "17:20", weight: "24 t", avInit: "LM", avColor: "#0E9F6E" },
    ]},
    { id: "arrival", title: "Confirm Destination Arrival", count: 2, cards: [
      { code: "VJ-24-8684", status: "Por confirmar", tone: "pending", title: "Camión 405 · Coloso ETA 12:30", driver: "Marcelo Díaz", eta: "arribo", weight: "25 t", avInit: "MD", avColor: "#F59E0B" },
      { code: "VJ-24-8685", status: "Por confirmar", tone: "pending", title: "Camión 512 · Mejillones ETA 13:05", driver: "Francisca Rojas", eta: "arribo", weight: "22 t", avInit: "FR", avColor: "#F59E0B" },
    ]},
    { id: "delivery", title: "Confirm Delivery", count: 1, cards: [
      { code: "VJ-24-8680", status: "Entregando", tone: "info", title: "Camión 314 · Descarga en curso", driver: "Pedro Navarro", eta: "en descarga", weight: "23 t", avInit: "PN" },
    ]},
    { id: "departure", title: "Confirm Departure", count: 1, cards: [
      { code: "VJ-24-8676", status: "Listo salida", tone: "success", title: "Camión 607 · Coloso → Antofagasta vacío", driver: "Rosa Muñoz", eta: "12:15", weight: "—", avInit: "RM", avColor: "#0E9F6E" },
    ]},
    { id: "finalized", title: "Monitoring Finalized", count: 2, cards: [
      { code: "VJ-24-8670", status: "Finalizado", tone: "neutral", title: "Camión 412 · Cerrado 11:42", driver: "Juan Pérez R.", eta: "—", weight: "22 t", avInit: "JP" },
      { code: "VJ-24-8671", status: "Finalizado", tone: "neutral", title: "Camión 118 · Cerrado 10:55", driver: "Marta Cofré", eta: "—", weight: "19 t", avInit: "MC", avColor: "#6B7280" },
    ]},
  ];

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "16px 24px", background: "#F9FAFB" }}>
      <div style={{ display: "flex", gap: 12, minHeight: "100%" }}>
        {columns.map(col => (
          <div key={col.id} style={{
            width: 280, flexShrink: 0, background: "#F3F4F6", borderRadius: 8, padding: 12,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {col.title}
                </span>
                <span style={{ background: "#E5E7EB", color: "#4B5563", fontSize: 10, padding: "1px 7px", borderRadius: 999, fontWeight: 500 }}>{col.count}</span>
              </div>
              <IconButton icon={<Icon.dots/>} label="more"/>
            </div>
            {col.cards.map(c => (
              <TripCard key={c.code} trip={c} alert={c.alert} onClick={() => onOpen?.(c)}/>
            ))}
            <button style={{
              width: "100%", padding: "8px", background: "transparent", border: "1px dashed #D1D5DB",
              borderRadius: 6, color: "#6B7280", fontSize: 12, cursor: "pointer", fontFamily: "Inter",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <Icon.plus/>Add trip
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { KanbanBoard });
