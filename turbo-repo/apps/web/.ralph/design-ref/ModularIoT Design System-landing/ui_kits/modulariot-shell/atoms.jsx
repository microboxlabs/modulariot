// atoms.jsx — platform-neutral primitives for the MIOT shell
const { useState: useAtS } = React;

function MButton({ variant = "primary", size = "base", children, icon, onClick, style = {} }) {
  const v = {
    primary:   { bg: "#111928", hover: "#1F2A37", color: "#fff", border: "transparent" },
    secondary: { bg: "#fff",    hover: "#F9FAFB", color: "#111928", border: "#D1D5DB" },
    accent:    { bg: "#1C64F2", hover: "#1A56DB", color: "#fff", border: "transparent" },
    ghost:     { bg: "transparent", hover: "#F3F4F6", color: "#374151", border: "transparent" },
    danger:    { bg: "#fff",    hover: "#FEF2F2", color: "#991B1B", border: "#FECACA" },
  }[variant];
  const s = { xs: [5,10,12], sm: [7,12,13], base: [9,16,14], lg: [12,20,15] }[size];
  const [hov, setHov] = useAtS(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: `${s[0]}px ${s[1]}px`, fontSize: s[2], fontWeight: 500,
        fontFamily: "Inter", borderRadius: 8,
        border: `1px solid ${v.border}`, background: hov ? v.hover : v.bg,
        color: v.color, cursor: "pointer", lineHeight: 1, whiteSpace: "nowrap",
        transition: "background 120ms", ...style,
      }}>
      {icon}{children}
    </button>
  );
}

function MAvatar({ initials, color = "#1C64F2", size = 28 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", background: color, color: "#fff",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 600, fontFamily: "Inter", flexShrink: 0,
    }}>{initials}</span>
  );
}

function MKbd({ children }) {
  return (
    <span style={{ display: "inline-flex", gap: 3, fontFamily: "ui-monospace, monospace", fontSize: 10.5 }}>
      {String(children).split(" ").map((k, i) => (
        <span key={i} style={{
          background: "#fff", border: "1px solid #E5E7EB", borderBottomWidth: 2,
          borderRadius: 4, padding: "2px 5px", minWidth: 16, textAlign: "center", color: "#6B7280",
        }}>{k}</span>
      ))}
    </span>
  );
}

const MIco = {
  search:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path strokeLinecap="round" d="M20 20l-3-3"/></svg>,
  sparkle:   <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zM19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14z"/></svg>,
  home:      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>,
  dash:      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="10" rx="1"/><rect x="14" y="3" width="7" height="6" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/><rect x="14" y="11" width="7" height="10" rx="1"/></svg>,
  story:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v4H4zM4 12h10v4H4zM4 20h16v0"/><path strokeLinecap="round" d="M18 12v8"/></svg>,
  truck:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h10v10H3zM13 10h5l3 3v4h-8zM7 20a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z"/></svg>,
  people:    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path strokeLinecap="round" d="M3 20c0-3 3-5 6-5s6 2 6 5M17 11a2.5 2.5 0 100-5M21 20c0-2-2-4-5-4"/></svg>,
  settings:  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  bell:      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  plus:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>,
  chevDown:  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>,
  chevRight: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6"/></svg>,
  x:         <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18"/></svg>,
  arrow:     <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>,
  send:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 20l16-8L4 4l3 8-3 8z"/></svg>,
  attach:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7l-7 7a3 3 0 004 4l8-8a5 5 0 00-7-7L5 11a7 7 0 0010 10"/></svg>,
  clock:     <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 7v5l3 2"/></svg>,
  check:     <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>,
  bolt:      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>,
  expand:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m12-6h4a2 2 0 012 2v4M9 21H5a2 2 0 01-2-2v-4m12 6h4a2 2 0 002-2v-4"/></svg>,
  bars:      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M5 20V10M12 20V4M19 20v-8"/></svg>,
  pie:       <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12A9 9 0 103 12a9 9 0 0018 0zM12 3v9l6.5 6.5"/></svg>,
  line:      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8"/></svg>,
  dots:      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>,
  share:     <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v14"/></svg>,
  edit:      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 4H5a2 2 0 00-2 2v13a2 2 0 002 2h13a2 2 0 002-2v-6M18.4 2.6a2.3 2.3 0 013.2 3.2L12 15.4l-4 1 1-4z"/></svg>,
  text:      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h14"/></svg>,
  quote:     <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h4v4H8c0 2 1 3 3 3v2c-3 0-5-2-5-5V7zm8 0h4v4h-3c0 2 1 3 3 3v2c-3 0-5-2-5-5V7z"/></svg>,
  workflow:  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="5" width="6" height="4" rx="1"/><rect x="15" y="5" width="6" height="4" rx="1"/><rect x="3" y="15" width="6" height="4" rx="1"/><rect x="15" y="15" width="6" height="4" rx="1"/><path strokeLinecap="round" d="M9 7h6M9 17h6M6 9v6M18 9v6"/></svg>,
  link:      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>,
};

Object.assign(window, { MButton, MAvatar, MKbd, MIco });
