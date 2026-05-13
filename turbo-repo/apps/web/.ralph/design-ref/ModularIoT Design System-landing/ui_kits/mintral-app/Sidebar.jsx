// Sidebar.jsx — Mintral secured layout sidebar
const { useState: useStateSB } = React;

function Sidebar({ active = "shipping", onNavigate }) {
  const [collapsed, setCollapsed] = useStateSB(false);
  const [expanded, setExpanded] = useStateSB({ kanban: true });

  const nav = [
    { id: "home", label: "Home", icon: Icon.home, counter: 3 },
    { id: "calendar", label: "Calendar", icon: Icon.calendar },
    { id: "kanban", label: "Kanban", icon: Icon.clipboard, children: [
      { id: "planning", label: "Planning" },
      { id: "shipping", label: "Shipping", counter: 12 },
      { id: "delivery", label: "Delivery" },
      { id: "finished", label: "Finished" },
    ]},
    { id: "tasks", label: "My tasks", icon: Icon.book, counter: 8 },
    { id: "tower", label: "Control Tower", icon: Icon.tower, children: [
      { id: "geo", label: "Geographic View" },
      { id: "signal", label: "Signal History" },
    ]},
    { id: "streams", label: "Live Streams", icon: Icon.video },
    { id: "collab", label: "Collaborators", icon: Icon.people },
    { id: "fleet", label: "Fleet Management", icon: Icon.truck },
  ];

  const W = collapsed ? 64 : 256;
  return (
    <aside style={{
      width: W, flexShrink: 0, background: "#fff",
      borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0, transition: "width 200ms",
    }}>
      <div style={{
        height: 60, display: "flex", alignItems: "center",
        padding: collapsed ? "0" : "0 20px", justifyContent: collapsed ? "center" : "flex-start",
        borderBottom: "1px solid #E5E7EB",
      }}>
        {collapsed
          ? <div style={{ width: 32, height: 32, background: "#FFB017", borderRadius: 6, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Oswald", fontWeight:900, fontSize:18, color:"#262626"}}>M</div>
          : <img src="../../assets/logo-mintral.png" alt="Mintral" style={{ height: 28 }}/>}
      </div>
      <nav style={{ flex: 1, overflow: "auto", padding: "12px 8px" }}>
        {nav.map((item) => {
          const isActive = item.id === active || item.children?.some(c => c.id === active);
          const isOpen = expanded[item.id];
          return (
            <div key={item.id}>
              <div
                onClick={() => {
                  if (item.children) setExpanded(e => ({ ...e, [item.id]: !e[item.id] }));
                  else onNavigate?.(item.id);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: collapsed ? "10px" : "10px 12px", borderRadius: 8,
                  background: isActive && !item.children ? "#EBF5FF" : "transparent",
                  color: isActive && !item.children ? "#1A56DB" : "#374151",
                  fontSize: 14, fontWeight: 500, cursor: "pointer",
                  justifyContent: collapsed ? "center" : "flex-start",
                  marginBottom: 2,
                }}
                onMouseEnter={(e)=>{ if(!(isActive && !item.children)) e.currentTarget.style.background="#F3F4F6" }}
                onMouseLeave={(e)=>{ if(!(isActive && !item.children)) e.currentTarget.style.background="transparent" }}
              >
                <item.icon/>
                {!collapsed && <>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.counter != null && (
                    <span style={{
                      background: isActive && !item.children ? "#1C64F2" : "#E5E7EB",
                      color: isActive && !item.children ? "#fff" : "#4B5563",
                      fontSize: 10, padding: "1px 7px", borderRadius: 999, fontWeight: 500,
                    }}>{item.counter}</span>
                  )}
                  {item.children && (
                    <span style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 200ms" }}>
                      <Icon.chevDown/>
                    </span>
                  )}
                </>}
              </div>
              {!collapsed && item.children && isOpen && (
                <div style={{ marginLeft: 32, marginBottom: 4 }}>
                  {item.children.map(c => (
                    <div key={c.id}
                      onClick={() => onNavigate?.(c.id)}
                      style={{
                        display: "flex", alignItems: "center", padding: "8px 12px",
                        borderRadius: 6, fontSize: 13, cursor: "pointer",
                        background: active === c.id ? "#EBF5FF" : "transparent",
                        color: active === c.id ? "#1A56DB" : "#6B7280",
                        fontWeight: active === c.id ? 500 : 400,
                      }}
                      onMouseEnter={(e)=>{ if(active!==c.id) e.currentTarget.style.background="#F9FAFB" }}
                      onMouseLeave={(e)=>{ if(active!==c.id) e.currentTarget.style.background="transparent" }}>
                      <span style={{flex:1}}>{c.label}</span>
                      {c.counter && <span style={{ background: "#1C64F2", color:"#fff", fontSize:10, padding:"1px 7px", borderRadius:999, fontWeight:500 }}>{c.counter}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid #E5E7EB", padding: 12 }}>
        <div style={{ display:"flex", alignItems:"center", gap: collapsed ? 0 : 10, justifyContent: collapsed ? "center" : "flex-start" }}>
          <Avatar initials="JP" size={32}/>
          {!collapsed && <div style={{flex:1, minWidth:0}}>
            <div style={{ fontSize:13, fontWeight:500, color:"#111928", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>Juan Pérez</div>
            <div style={{ fontSize:11, color:"#6B7280"}}>Operador · Faena SCL</div>
          </div>}
        </div>
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} style={{
            marginTop: 10, width: "100%", padding: "6px 8px", border: "1px solid #E5E7EB",
            borderRadius: 6, background: "transparent", color: "#6B7280", fontSize: 11,
            cursor: "pointer", fontFamily: "Inter",
          }}>Collapse sidebar</button>
        )}
        {collapsed && (
          <button onClick={() => setCollapsed(false)} style={{
            marginTop: 10, width: "100%", padding: "6px", border: "1px solid #E5E7EB",
            borderRadius: 6, background: "transparent", color: "#6B7280", cursor: "pointer",
          }}>›</button>
        )}
      </div>
    </aside>
  );
}

Object.assign(window, { Sidebar });
