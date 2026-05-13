// atoms.jsx — small primitives shared across Mintral app UI kit
const { useState } = React;

function Button({ variant = "primary", size = "base", children, icon, ...rest }) {
  const v = {
    primary:   { bg: "#1C64F2", hover: "#1A56DB", color: "#fff", border: "transparent" },
    secondary: { bg: "#fff",    hover: "#F9FAFB", color: "#111928", border: "#D1D5DB" },
    danger:    { bg: "#E11D48", hover: "#BE123C", color: "#fff", border: "transparent" },
    ghost:     { bg: "transparent", hover: "#EBF5FF", color: "#1C64F2", border: "transparent" },
  }[variant];
  const s = { xs: [5,10,12], sm: [7,12,13], base: [9,16,14], lg: [12,20,15] }[size];
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: `${s[0]}px ${s[1]}px`, fontSize: s[2], fontWeight: 500,
        fontFamily: "Inter, sans-serif", borderRadius: 8,
        border: `1px solid ${v.border}`, background: hov ? v.hover : v.bg,
        color: v.color, cursor: "pointer", lineHeight: 1, whiteSpace: "nowrap",
        transition: "background 120ms",
      }} {...rest}>
      {icon}{children}
    </button>
  );
}

function Badge({ tone = "neutral", children, dot = true }) {
  const m = {
    success: ["#DEF7EC", "#046C4E", "#0E9F6E"],
    pending: ["#FEF3C7", "#D97706", "#F59E0B"],
    danger:  ["#FFE4E6", "#BE123C", "#E11D48"],
    info:    ["#E1EFFE", "#1A56DB", "#1C64F2"],
    neutral: ["#F3F4F6", "#374151", "#6B7280"],
    solidWarn:   ["#FFB017", "#262626", "#262626"],
    solidDanger: ["#E11D48", "#fff", "#fff"],
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "2px 10px", borderRadius: 999,
      fontFamily: "Inter", fontSize: 11, fontWeight: 500,
      background: m[0], color: m[1],
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: m[2] }}/>}
      {children}
    </span>
  );
}

function Avatar({ initials, color = "#1C64F2", size = 28 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%", background: color, color: "#fff",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 600, fontFamily: "Inter",
    }}>{initials}</span>
  );
}

function Input({ label, error, hint, icon, ...rest }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <span style={{ fontSize: 13, fontWeight: 500, color: "#111928" }}>{label}</span>}
      <div style={{
        position: "relative", display: "flex", alignItems: "center",
        background: "#F9FAFB", border: `1px solid ${error ? "#E11D48" : "#D1D5DB"}`,
        borderRadius: 8, height: 42, padding: icon ? "0 14px 0 40px" : "0 14px",
      }}>
        {icon && <span style={{ position: "absolute", left: 12, color: "#6B7280" }}>{icon}</span>}
        <input {...rest} style={{
          flex: 1, border: "none", outline: "none", background: "transparent",
          fontFamily: "Inter", fontSize: 14, color: "#111928",
        }}/>
      </div>
      {error && <span style={{ fontSize: 12, color: "#BE123C" }}>{error}</span>}
      {hint && !error && <span style={{ fontSize: 12, color: "#6B7280" }}>{hint}</span>}
    </label>
  );
}

function IconButton({ icon, label, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      aria-label={label}
      style={{
        width: 36, height: 36, border: "none", borderRadius: 8,
        background: hov ? "#F3F4F6" : "transparent", color: "#4B5563", cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
      {icon}
    </button>
  );
}

// Small inline SVG icon lib — Flowbite-style, stroke 2, 20×20 viewBox
const Icon = {
  home: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  calendar: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  clipboard: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  book: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>,
  tower: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M7 7h10l-1 4H8zM9 11l-1 10m8-10l1 10"/></svg>,
  video: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>,
  people: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
  truck: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>,
  search: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
  bell: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  settings: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  chevDown: (p) => <svg {...p} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>,
  chevRight: (p) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>,
  plus: (p) => <svg {...p} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>,
  x: (p) => <svg {...p} width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>,
  dots: (p) => <svg {...p} width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>,
  package: (p) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>,
  clock: (p) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  pin: (p) => <svg {...p} width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
};

Object.assign(window, { Button, Badge, Avatar, Input, IconButton, Icon });
