// Gráficos SVG conceptuales por caja de procesamiento (estilo "imagen asociada a concepto"
// de luuk.cl, pero vectorial y en la paleta ModularIoT). Livianos, con gradientes,
// sombras suaves y animación. Paleta: azul #3f83f8 / #1c64f2, amarillo #f59e0b,
// naranja #e11d48, gris #4b5563 / #e5e7eb.

const banner = "w-full aspect-[400/176]";

// defs compartidos: gradientes + sombra suave. id único por gráfico para no colisionar.
function Defs({ uid }: { uid: string }) {
  return (
    <defs>
      <linearGradient id={`${uid}-blue`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#76a9fa" />
        <stop offset="1" stopColor="#1c64f2" />
      </linearGradient>
      <linearGradient id={`${uid}-blueSoft`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#ebf5ff" />
      </linearGradient>
      <linearGradient id={`${uid}-amber`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fcd34d" />
        <stop offset="1" stopColor="#f59e0b" />
      </linearGradient>
      <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2b2e33" />
        <stop offset="1" stopColor="#1b1d20" />
      </linearGradient>
      <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0b1b3a" floodOpacity="0.16" />
      </filter>
    </defs>
  );
}

export function ConceptGraphic({ id }: { id: string }) {
  const uid = `cg-${id}`;

  if (id === "ingesta") {
    return (
      <svg viewBox="0 0 400 176" className={banner} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ingesta de señales GPS hacia tu base de datos">
        <Defs uid={uid} />
        <rect width="400" height="176" fill={`url(#${uid}-blueSoft)`} />
        {/* nodo de señal */}
        <g filter={`url(#${uid}-shadow)`}>
          <circle cx="53" cy="92" r="20" fill={`url(#${uid}-blue)`} />
        </g>
        <path d="M53 78a14 14 0 010 28M53 84a8 8 0 010 16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9" />
        <circle cx="53" cy="92" r="3.5" fill="#fff" />
        <circle cx="53" cy="92" r="34" stroke="#3f83f8" strokeWidth="2" opacity="0.18">
          <animate attributeName="r" values="30;40;30" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.25;0;0.25" dur="2.6s" repeatCount="indefinite" />
        </circle>
        {/* flujo de datos */}
        <line x1="85" y1="92" x2="287" y2="92" stroke="#3f83f8" strokeWidth="2.5" strokeDasharray="1 8" strokeLinecap="round" opacity="0.35" />
        {[107, 152, 197, 242].map((x, i) => (
          <circle key={x} cx={x} cy="92" r="5.5" fill="#3f83f8">
            <animate attributeName="cx" values={`${x};${x + 45}`} dur="1.8s" repeatCount="indefinite" begin={`${i * 0.22}s`} />
            <animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" begin={`${i * 0.22}s`} />
          </circle>
        ))}
        {/* base de datos */}
        <g filter={`url(#${uid}-shadow)`} transform="translate(287 52)">
          <path d="M0 14v52c0 7 17 13 40 13s40-6 40-13V14" fill={`url(#${uid}-blue)`} />
          <ellipse cx="40" cy="40" rx="40" ry="13" fill="#1a56db" opacity="0.5" />
          <ellipse cx="40" cy="14" rx="40" ry="14" fill="#a4cafe" />
          <ellipse cx="40" cy="14" rx="40" ry="14" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
        </g>
      </svg>
    );
  }

  if (id === "sintomas") {
    return (
      <svg viewBox="0 0 400 176" className={banner} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Motor de reglas que detecta síntomas por severidad">
        <Defs uid={uid} />
        <rect width="400" height="176" fill="#f9fafb" />
        {/* radar */}
        <g transform="translate(90 88)">
          <circle r="62" fill="#fff" opacity="0.55" filter={`url(#${uid}-shadow)`} />
          <circle r="62" stroke="#f59e0b" strokeWidth="1.5" opacity="0.22" />
          <circle r="42" stroke="#f59e0b" strokeWidth="1.5" opacity="0.3" />
          <circle r="22" stroke="#f59e0b" strokeWidth="1.5" opacity="0.4" />
          <line x1="-62" y1="0" x2="62" y2="0" stroke="#f59e0b" strokeWidth="1" opacity="0.25" />
          <line x1="0" y1="-62" x2="0" y2="62" stroke="#f59e0b" strokeWidth="1" opacity="0.25" />
          <path d="M0 0 L0 -62 A62 62 0 0 1 54 -30 Z" fill={`url(#${uid}-amber)`} opacity="0.35">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4.5s" repeatCount="indefinite" />
          </path>
          <g filter={`url(#${uid}-shadow)`}>
            <circle cx="32" cy="-24" r="7" fill="#e11d48" />
          </g>
          <circle cx="32" cy="-24" r="7" fill="none" stroke="#e11d48" strokeWidth="2">
            <animate attributeName="r" values="7;16;7" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0;0.8" dur="1.6s" repeatCount="indefinite" />
          </circle>
        </g>
        {/* checklist de severidad */}
        <g transform="translate(200 46)" filter={`url(#${uid}-shadow)`}>
          <rect x="-8" y="-10" width="180" height="104" fill="#fff" />
        </g>
        <g transform="translate(200 46)">
          {[
            { c: "#e11d48", w: 140 },
            { c: "#f59e0b", w: 104 },
            { c: "#3f83f8", w: 122 },
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
      [-118, -44, "#1a56db"], [118, -44, "#1c64f2"], [-128, 30, "#76a9fa"],
      [128, 30, "#a4cafe"], [-58, 62, "#3f83f8"], [58, 62, "#4b5563"],
    ];
    return (
      <svg viewBox="0 0 400 176" className={banner} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hub de integraciones conectando tus sistemas">
        <Defs uid={uid} />
        <rect width="400" height="176" fill={`url(#${uid}-blueSoft)`} />
        <g transform="translate(200 84)">
          {spokes.map(([x, y], i) => (
            <line key={i} x1="0" y1="0" x2={x} y2={y} stroke="#3f83f8" strokeWidth="2" opacity="0.28" strokeLinecap="round" />
          ))}
          {spokes.map(([x, y, c], i) => (
            <g key={i} filter={`url(#${uid}-shadow)`}>
              <circle cx={x} cy={y} r="15" fill={c}>
                <animate attributeName="r" values="15;17;15" dur="2.2s" repeatCount="indefinite" begin={`${i * 0.25}s`} />
              </circle>
            </g>
          ))}
          <g filter={`url(#${uid}-shadow)`}>
            <circle r="30" fill={`url(#${uid}-blue)`} />
          </g>
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
      <Defs uid={uid} />
      <rect width="400" height="176" fill="#f9fafb" />
      {/* pantalla */}
      <g filter={`url(#${uid}-shadow)`}>
        <rect x="40" y="36" width="188" height="112" fill={`url(#${uid}-dark)`} />
      </g>
      <rect x="52" y="48" width="164" height="72" fill="#0e1013" />
      {/* botón play */}
      <g filter={`url(#${uid}-shadow)`}>
        <circle cx="134" cy="84" r="24" fill={`url(#${uid}-blue)`} />
      </g>
      <path d="M126 72l20 12-20 12z" fill="#fff" />
      {/* etiqueta LIVE */}
      <rect x="60" y="128" width="42" height="12" fill="#e11d48" opacity="0.9" />
      <circle cx="70" cy="134" r="3" fill="#fff">
        <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
      </circle>
      <rect x="150" y="129" width="60" height="8" fill="#4b5563" />
      {/* tira de frames */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={248} y={46 + i * 27} width="116" height="19" fill="#3f83f8">
          <animate attributeName="opacity" values="0.18;0.6;0.18" dur="2.2s" repeatCount="indefinite" begin={`${i * 0.3}s`} />
        </rect>
      ))}
    </svg>
  );
}
