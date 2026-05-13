// Shell.jsx — MIOT platform shell (sidebar + topbar)
const { useState: useSh, useEffect: useShE } = React;

function MIOTSidebar({ active, onNavigate, chatOpen, onToggleChat }) {
  const [collapsed, setCollapsed] = useSh(false);
  const nav = [
    { id: "home",      label: "Home",           icon: MIco.home },
    { id: "dashboard", label: "Dashboards",     icon: MIco.dash, counter: 4 },
    { id: "story",     label: "Storytelling",   icon: MIco.story, badge: "new" },
    { id: "fleet",     label: "Fleet",          icon: MIco.truck },
    { id: "people",    label: "Collaborators",  icon: MIco.people },
    { id: "settings",  label: "Settings",       icon: MIco.settings },
  ];
  const W = collapsed ? 64 : 228;
  return (
    <aside style={{
      width: W, flexShrink: 0, background: "#fff",
      borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column",
      height: "100vh", transition: "width 200ms",
    }}>
      <div style={{
        height: 56, display: "flex", alignItems: "center",
        padding: collapsed ? "0" : "0 18px", justifyContent: collapsed ? "center" : "flex-start",
        borderBottom: "1px solid #F3F4F6",
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: 7,
          background: "linear-gradient(135deg, #111928 0%, #374151 100%)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: 2, background: "#F1B300",
            boxShadow: "10px 0 0 -2px #3F83F8, -10px 0 0 -2px #0E9F6E",
          }}/>
        </span>
        {!collapsed && (
          <span style={{ marginLeft: 10, fontFamily: "Inter", fontSize: 14, fontWeight: 600, color: "#111928", letterSpacing: "-0.01em" }}>
            ModularIoT
          </span>
        )}
      </div>

      <nav style={{ flex: 1, overflow: "auto", padding: "10px 8px" }}>
        {nav.map(item => {
          const isActive = item.id === active;
          return (
            <div key={item.id}
              onClick={() => onNavigate?.(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 11,
                padding: collapsed ? "9px" : "9px 11px", borderRadius: 7,
                background: isActive ? "#F3F4F6" : "transparent",
                color: isActive ? "#111928" : "#4B5563",
                fontSize: 13.5, fontWeight: isActive ? 600 : 500, cursor: "pointer",
                justifyContent: collapsed ? "center" : "flex-start",
                marginBottom: 1, transition: "background 120ms",
              }}
              onMouseEnter={(e)=>{ if(!isActive) e.currentTarget.style.background="#F9FAFB" }}
              onMouseLeave={(e)=>{ if(!isActive) e.currentTarget.style.background="transparent" }}
            >
              {item.icon}
              {!collapsed && <>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.counter != null && (
                  <span style={{ background: "#E5E7EB", color: "#374151", fontSize: 10.5, padding: "1px 6px", borderRadius: 999, fontWeight: 500 }}>{item.counter}</span>
                )}
                {item.badge && (
                  <span style={{ background: "#EBF5FF", color: "#1A56DB", fontSize: 9.5, padding: "2px 6px", borderRadius: 999, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{item.badge}</span>
                )}
              </>}
            </div>
          );
        })}

        {!collapsed && <div style={{ height: 1, background: "#F3F4F6", margin: "12px 8px" }}/>}

        {/* Assistant dock toggle */}
        <div onClick={onToggleChat}
          style={{
            display: "flex", alignItems: "center", gap: 11,
            padding: collapsed ? "9px" : "9px 11px", borderRadius: 7,
            background: chatOpen ? "#FFFAEB" : "transparent",
            color: chatOpen ? "#92400E" : "#4B5563",
            fontSize: 13.5, fontWeight: 500, cursor: "pointer",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
          onMouseEnter={(e)=>{ if(!chatOpen) e.currentTarget.style.background="#F9FAFB" }}
          onMouseLeave={(e)=>{ if(!chatOpen) e.currentTarget.style.background="transparent" }}
        >
          <span style={{ color: "#D18900" }}>{MIco.sparkle}</span>
          {!collapsed && <>
            <span style={{ flex: 1 }}>Assistant</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "#6B7280" }}>⌘K</span>
          </>}
        </div>
      </nav>

      <div style={{ borderTop: "1px solid #F3F4F6", padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: collapsed ? 0 : 10, justifyContent: collapsed ? "center" : "flex-start" }}>
          <MAvatar initials="JR" size={28}/>
          {!collapsed && <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "#111928" }}>Javiera Rojas</div>
            <div style={{ fontSize: 10.5, color: "#6B7280" }}>Tenant admin</div>
          </div>}
          {!collapsed && (
            <button onClick={(e) => { e.stopPropagation(); setCollapsed(true); }} style={{
              background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer", padding: 4,
            }}>{MIco.chevRight}</button>
          )}
        </div>
        {collapsed && (
          <button onClick={() => setCollapsed(false)} style={{
            marginTop: 8, width: "100%", padding: "4px", border: "1px solid #E5E7EB", borderRadius: 6,
            background: "transparent", color: "#6B7280", cursor: "pointer",
          }}>›</button>
        )}
      </div>
    </aside>
  );
}

function MIOTTopbar({ title, crumbs, onOpenPalette, right }) {
  return (
    <header style={{
      height: 56, borderBottom: "1px solid #E5E7EB", background: "#fff",
      display: "flex", alignItems: "center", padding: "0 20px", gap: 16,
      flexShrink: 0,
    }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#6B7280" }}>
        {crumbs && crumbs.map((c, i) => (
          <React.Fragment key={i}>
            <span style={{
              color: i === crumbs.length - 1 ? "#111928" : "#6B7280",
              fontWeight: i === crumbs.length - 1 ? 600 : 400,
            }}>{c}</span>
            {i < crumbs.length - 1 && <span style={{ color: "#D1D5DB" }}>{MIco.chevRight}</span>}
          </React.Fragment>
        ))}
        {title && <span style={{ color: "#111928", fontWeight: 600, fontSize: 14.5 }}>{title}</span>}
      </div>

      <button onClick={onOpenPalette} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
        height: 34, background: "#F9FAFB", border: "1px solid #E5E7EB",
        borderRadius: 8, width: 280, cursor: "pointer", color: "#6B7280",
        fontFamily: "Inter",
      }}>
        <span style={{ color: "#9CA3AF" }}>{MIco.search}</span>
        <span style={{ flex: 1, textAlign: "left", fontSize: 13 }}>Search or ask…</span>
        <MKbd>⌘ K</MKbd>
      </button>

      {right}
      <div style={{ width: 1, height: 24, background: "#E5E7EB" }}/>
      <MAvatar initials="JR" size={30}/>
    </header>
  );
}

Object.assign(window, { MIOTSidebar, MIOTTopbar });
