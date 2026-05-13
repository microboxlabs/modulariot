// Topbar.jsx
function Topbar({ crumbs = [], count }) {
  return (
    <header style={{
      height: 60, borderBottom: "1px solid #E5E7EB", background: "#fff",
      display: "flex", alignItems: "center", padding: "0 24px", gap: 20,
      position: "sticky", top: 0, zIndex: 10,
    }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6B7280" }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            <span style={{
              color: i === crumbs.length - 1 ? "#111928" : "#6B7280",
              fontWeight: i === crumbs.length - 1 ? 500 : 400,
            }}>{c}</span>
            {i < crumbs.length - 1 && <Icon.chevRight style={{ color: "#D1D5DB" }}/>}
          </React.Fragment>
        ))}
        {count != null && (
          <span style={{
            marginLeft: 12, background: "#FEF3C7", color: "#D97706",
            fontSize: 11, padding: "3px 10px", borderRadius: 999, fontWeight: 500,
          }}>{count} visibles</span>
        )}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
        height: 38, background: "#F9FAFB", border: "1px solid #E5E7EB",
        borderRadius: 8, width: 320,
      }}>
        <span style={{color:"#6B7280"}}><Icon.search/></span>
        <input placeholder="Search trip, plate or driver…" style={{
          flex: 1, border: "none", outline: "none", background: "transparent",
          fontFamily: "Inter", fontSize: 13, color: "#111928",
        }}/>
        <span style={{
          fontFamily: "monospace", fontSize: 10, color: "#9CA3AF",
          background: "#E5E7EB", padding: "2px 6px", borderRadius: 4,
        }}>⌘K</span>
      </div>

      <IconButton icon={<Icon.bell/>} label="Notifications"/>
      <IconButton icon={<Icon.settings/>} label="Settings"/>
      <div style={{ width: 1, height: 28, background: "#E5E7EB" }}/>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar initials="JP" size={32}/>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#111928" }}>Juan Pérez</span>
          <span style={{ fontSize: 11, color: "#6B7280" }}>Operador</span>
        </div>
      </div>
    </header>
  );
}

Object.assign(window, { Topbar });
