// Gráficos SVG conceptuales por caja de procesamiento. Planos y en los tokens
// del DS (var(--…)), así siguen el tema claro/oscuro sin variantes duplicadas.
// Cada caja usa su color semántico: señal azul, síntoma ámbar, urgente rosa.

const banner = "w-full aspect-[400/176]";

export function ConceptGraphic({ id }: { id: string }) {
  if (id === "ingesta") {
    return (
      <svg viewBox="0 0 400 176" className={banner} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ingesta de señales GPS hacia tu base de datos">
        <rect width="400" height="176" fill="var(--surface-2)" />
        {/* nodo de señal */}
        <circle cx="53" cy="92" r="20" fill="var(--signal)" />
        <path d="M53 78a14 14 0 010 28M53 84a8 8 0 010 16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9" />
        <circle cx="53" cy="92" r="3.5" fill="#fff" />
        <circle cx="53" cy="92" r="34" stroke="var(--signal)" strokeWidth="2" opacity="0.18">
          <animate attributeName="r" values="30;40;30" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.25;0;0.25" dur="2.6s" repeatCount="indefinite" />
        </circle>
        {/* flujo de datos */}
        <line x1="85" y1="92" x2="287" y2="92" stroke="var(--signal)" strokeWidth="2.5" strokeDasharray="1 8" strokeLinecap="round" opacity="0.35" />
        {[107, 152, 197, 242].map((x, i) => (
          <circle key={x} cx={x} cy="92" r="5.5" fill="var(--signal)">
            <animate attributeName="cx" values={`${x};${x + 45}`} dur="1.8s" repeatCount="indefinite" begin={`${i * 0.22}s`} />
            <animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" begin={`${i * 0.22}s`} />
          </circle>
        ))}
        {/* base de datos */}
        <g transform="translate(287 52)">
          <path d="M0 14v52c0 7 17 13 40 13s40-6 40-13V14" fill="var(--accent)" />
          <path d="M0 40c0 7 17 13 40 13s40-6 40-13" fill="none" stroke="var(--accent-strong)" strokeWidth="2" opacity="0.6" />
          <ellipse cx="40" cy="14" rx="40" ry="14" fill="var(--accent)" />
          <ellipse cx="40" cy="14" rx="40" ry="14" fill="none" stroke="var(--accent-strong)" strokeWidth="1.5" />
        </g>
      </svg>
    );
  }

  if (id === "sintomas") {
    return (
      <svg viewBox="0 0 400 176" className={banner} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Motor de reglas que detecta síntomas por severidad">
        <rect width="400" height="176" fill="var(--surface-2)" />
        {/* radar */}
        <g transform="translate(90 88)">
          <circle r="62" fill="var(--surface)" opacity="0.7" />
          <circle r="62" stroke="var(--symptom)" strokeWidth="1.5" opacity="0.22" />
          <circle r="42" stroke="var(--symptom)" strokeWidth="1.5" opacity="0.3" />
          <circle r="22" stroke="var(--symptom)" strokeWidth="1.5" opacity="0.4" />
          <line x1="-62" y1="0" x2="62" y2="0" stroke="var(--symptom)" strokeWidth="1" opacity="0.25" />
          <line x1="0" y1="-62" x2="0" y2="62" stroke="var(--symptom)" strokeWidth="1" opacity="0.25" />
          <path d="M0 0 L0 -62 A62 62 0 0 1 54 -30 Z" fill="var(--symptom)" opacity="0.3">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4.5s" repeatCount="indefinite" />
          </path>
          <circle cx="32" cy="-24" r="7" fill="var(--urgent)" />
          <circle cx="32" cy="-24" r="7" fill="none" stroke="var(--urgent)" strokeWidth="2">
            <animate attributeName="r" values="7;16;7" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
        {/* checklist de severidad */}
        <g transform="translate(200 46)">
          <rect x="-8" y="-10" width="180" height="104" fill="var(--surface)" stroke="var(--hairline)" />
          {[
            { c: "var(--urgent)", w: 140 },
            { c: "var(--symptom)", w: 104 },
            { c: "var(--signal)", w: 122 },
          ].map((r, i) => (
            <g key={i} transform={`translate(4 ${i * 30})`}>
              <circle cx="8" cy="8" r="9" fill={r.c} />
              <path d="M4 8l2.6 2.6L12.5 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <rect x="26" y="3" width={r.w} height="10" fill={r.c} opacity="0.18" />
            </g>
          ))}
        </g>
      </svg>
    );
  }

  if (id === "integraciones") {
    const spokes: [number, number, string][] = [
      [-118, -44, "var(--accent-strong)"], [118, -44, "var(--accent)"], [-128, 30, "var(--signal)"],
      [128, 30, "var(--signal)"], [-58, 62, "var(--accent)"], [58, 62, "var(--ink-3)"],
    ];
    return (
      <svg viewBox="0 0 400 176" className={banner} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hub de integraciones conectando tus sistemas">
        <rect width="400" height="176" fill="var(--surface-2)" />
        <g transform="translate(200 84)">
          {spokes.map(([x, y], i) => (
            <line key={i} x1="0" y1="0" x2={x} y2={y} stroke="var(--signal)" strokeWidth="2" opacity="0.28" strokeLinecap="round" />
          ))}
          {spokes.map(([x, y, c], i) => (
            <circle key={i} cx={x} cy={y} r="15" fill={c}>
              <animate attributeName="r" values="15;17;15" dur="2.2s" repeatCount="indefinite" begin={`${i * 0.25}s`} />
            </circle>
          ))}
          <circle r="30" fill="var(--accent)" />
          <circle r="30" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.5" />
          <path d="M-10 -3a7 7 0 0110-6 7 7 0 0110 6" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M-10 5l5 5M10 5l-5 5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  // video
  return (
    <svg viewBox="0 0 400 176" className={banner} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Streaming de video en vivo desde cámaras">
      <rect width="400" height="176" fill="var(--surface-2)" />
      {/* pantalla */}
      <rect x="40" y="36" width="188" height="112" fill="#13273D" />
      <rect x="52" y="48" width="164" height="72" fill="#0e1013" />
      {/* botón play */}
      <circle cx="134" cy="84" r="24" fill="var(--accent)" />
      <path d="M126 72l20 12-20 12z" fill="#fff" />
      {/* etiqueta LIVE */}
      <rect x="60" y="128" width="42" height="12" fill="var(--urgent)" opacity="0.9" />
      <circle cx="70" cy="134" r="3" fill="#fff">
        <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
      </circle>
      <rect x="150" y="129" width="60" height="8" fill="var(--ink-4)" />
      {/* tira de frames */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={248} y={46 + i * 27} width="116" height="19" fill="var(--signal)">
          <animate attributeName="opacity" values="0.18;0.6;0.18" dur="2.2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
        </rect>
      ))}
    </svg>
  );
}
