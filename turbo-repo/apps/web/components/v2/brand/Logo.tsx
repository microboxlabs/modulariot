import {
  LYNX_VIEWBOX,
  LYNX_SOLID,
  LYNX_EYE_X,
  LYNX_IRIS_R,
  LYNX_PUPIL_R,
  LYNX_BEAK_LINE,
  LOCKUP_VIEWBOX,
  LOCKUP_MARK_TRANSFORM,
  WORDMARK_MODULAR,
  WORDMARK_IOT,
} from "./lynx-geometry";

// Marca Lynx en línea, consciente del tema: la tinta hereda `currentColor`
// (la define el texto que la rodea) y el iris usa el ámbar de marca, que
// cambia con .dark vía --brand-amber. Así el mismo componente sirve en
// header claro, footer oscuro y cualquier superficie intermedia.
function MarkBody() {
  return (
    <>
      <path d={LYNX_SOLID} fill="currentColor" fillRule="nonzero" />
      <circle cx={-LYNX_EYE_X} cy={0} r={LYNX_IRIS_R} fill="var(--brand-amber)" />
      <circle cx={LYNX_EYE_X} cy={0} r={LYNX_IRIS_R} fill="var(--brand-amber)" />
      <circle cx={-LYNX_EYE_X} cy={0} r={LYNX_PUPIL_R} fill="currentColor" />
      <circle cx={LYNX_EYE_X} cy={0} r={LYNX_PUPIL_R} fill="currentColor" />
      <path d={LYNX_BEAK_LINE} fill="currentColor" />
    </>
  );
}

export function LynxMark({ className }: { className?: string }) {
  return (
    <svg viewBox={LYNX_VIEWBOX} className={className} aria-hidden="true" focusable="false">
      <MarkBody />
    </svg>
  );
}

// Solo el wordmark kerneado (sin marca), para cuando el Lynx ya está en escena.
export function LynxWordmark({ className }: { className?: string }) {
  return (
    <svg viewBox="330 70 690 120" className={className} role="img" aria-label="ModularIoT">
      <path d={WORDMARK_MODULAR} fill="currentColor" />
      <path d={WORDMARK_IOT} fill="var(--brand-amber)" />
    </svg>
  );
}

// Lockup completo (marca + wordmark kerneado, Opción B: "Modular" en tinta,
// "IoT" en ámbar — resuelve la ambigüedad I/l y hace intencional el ámbar).
export function LynxLockup({ className }: { className?: string }) {
  return (
    <svg viewBox={LOCKUP_VIEWBOX} className={className} role="img" aria-label="ModularIoT">
      <g transform={LOCKUP_MARK_TRANSFORM}>
        <MarkBody />
      </g>
      <path d={WORDMARK_MODULAR} fill="currentColor" />
      <path d={WORDMARK_IOT} fill="var(--brand-amber)" />
    </svg>
  );
}
