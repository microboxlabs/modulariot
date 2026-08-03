// Gráficos SVG conceptuales por caja de procesamiento. Planos y en los tokens
// del DS (var(--…)), así siguen el tema claro/oscuro sin variantes duplicadas.
// Cada caja usa su color semántico: señal azul, síntoma ámbar, urgente rosa.

import { LYNX_SOLID, LYNX_EYE_X, LYNX_IRIS_R, LYNX_PUPIL_R, LYNX_BEAK_LINE } from "@modulariot/ui/brand/logo";

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
          {/* Blip sincronizado con la barrida (mismo dur="4.5s", sin
              desfase): el sweep empieza arriba (rotate 0) apuntando justo a
              este punto, así que el blip aparece rápido en ese instante y se
              apaga lento el resto de la vuelta, en vez de titilar aparte. */}
          <circle cx="32" cy="-24" r="7" fill="var(--urgent)">
            <animate attributeName="opacity" values="0;1;0;0" keyTimes="0;0.05;0.4;1" dur="4.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="32" cy="-24" r="7" fill="none" stroke="var(--urgent)" strokeWidth="2">
            <animate attributeName="r" values="7;18;18" keyTimes="0;0.4;1" dur="4.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.8;0;0" keyTimes="0;0.05;0.4;1" dur="4.5s" repeatCount="indefinite" />
          </circle>
        </g>
        {/* checklist de severidad */}
        <g transform="translate(200 46)">
          <rect x="-8" y="-10" width="180" height="104" rx="14" fill="var(--surface)" stroke="var(--hairline)" />
          {/* fila destacada: el síntoma urgente que el radar acaba de marcar */}
          <rect x="-4" y="-2" width="172" height="28" rx="8" fill="var(--urgent)" opacity="0.08" />
          {[
            { c: "var(--urgent)", w: 128 },
            { c: "var(--symptom)", w: 112 },
            { c: "var(--signal)", w: 96 },
          ].map((r, i) => (
            <g key={i} transform={`translate(4 ${i * 30 + 4})`}>
              <circle cx="8" cy="8" r="9" fill={r.c} />
              <path d="M4 8l2.6 2.6L12.5 5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <rect x="26" y="3" width={r.w} height="10" rx="5" fill={r.c} opacity="0.18" />
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
          <circle r="30" fill="#0b1220" />
          <circle r="30" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.5" />
          {/* Nodo central = marca Lynx (prueba), disco oscuro fijo (no el
              acento) para que la marca resalte. Centro vertical real del
              path (medido con getBBox, no a ojo): y≈-29.665 — ni el centro
              del viewBox (-12) ni la estimación anterior (-48). */}
          <g transform="translate(0 4.75) scale(0.16)">
            <path d={LYNX_SOLID} fill="#fff" fillRule="nonzero" />
            <circle cx={-LYNX_EYE_X} cy={0} r={LYNX_IRIS_R} fill="var(--brand-amber)" />
            <circle cx={LYNX_EYE_X} cy={0} r={LYNX_IRIS_R} fill="var(--brand-amber)" />
            <circle cx={-LYNX_EYE_X} cy={0} r={LYNX_PUPIL_R} fill="#0b1220" />
            <circle cx={LYNX_EYE_X} cy={0} r={LYNX_PUPIL_R} fill="#0b1220" />
            <path d={LYNX_BEAK_LINE} fill="#fff" />
          </g>
        </g>
      </svg>
    );
  }

  // video
  return (
    <svg viewBox="0 0 400 176" className={banner} fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Streaming de video en vivo desde cámaras">
      <rect width="400" height="176" fill="var(--surface-2)" />
      {/* reproductor: pantalla tipo TV, con luz de "en vivo" en la esquina */}
      <g transform="translate(98 88)">
        <rect x="-64" y="-52" width="128" height="104" rx="14" fill="var(--surface)" stroke="var(--hairline)" />
        <rect x="-54" y="-44" width="108" height="88" rx="8" fill="#0b0d12" />
        <circle cx="0" cy="0" r="20" fill="#3a3f47" />
        <path d="M-6 -10l16 10-16 10z" fill="#fff" opacity="0.8" />
        {/* mismo patrón de pulso rápido-lento que la grilla de cámaras */}
        <circle cx="-43" cy="-33" r="4" fill="var(--urgent)">
          <animate attributeName="opacity" values="1;1;0.25;1" keyTimes="0;0.1;0.55;1" dur="1.8s" repeatCount="indefinite" />
        </circle>
      </g>
      {/* grilla de cámaras: mismo tamaño de tarjeta que el panel de síntomas, más cerca del televisor */}
      <g transform="translate(188 46)">
        <rect x="-8" y="-10" width="180" height="104" rx="14" fill="var(--surface)" stroke="var(--hairline)" />
        {[
          { x: 0, y: -2 },
          { x: 86, y: -2 },
          { x: 0, y: 44 },
          { x: 86, y: 44 },
        ].map((tile, i) => (
          <g key={i} transform={`translate(${tile.x} ${tile.y})`}>
            <rect width="78" height="40" rx="6" fill="#0b0d12" />
            <circle cx="10" cy="10" r="3" fill="var(--urgent)">
              <animate attributeName="opacity" values="1;1;0.25;1" keyTimes="0;0.1;0.55;1" dur="1.8s" repeatCount="indefinite" begin={`${i * 0.35}s`} />
            </circle>
          </g>
        ))}
      </g>
    </svg>
  );
}
