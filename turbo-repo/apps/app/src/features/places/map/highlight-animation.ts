"use client";

// Animación suave del badge resaltado: al entrar sube de 0 a 1 y al salir
// vuelve a 0 (el badge sigue visible mientras se desvanece).
import { useEffect, useRef, useState } from "react";

export const DURACION_RESALTADO_MS = 180;

/** Entra rápido y frena al final. */
export const easeOutCubic = (k: number) => 1 - (1 - k) ** 3;

const sinMovimiento = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useResaltadoAnimado(
  id: string | null,
  ms = DURACION_RESALTADO_MS
): { id: string | null; t: number } {
  const [estado, setEstado] = useState<{ id: string | null; t: number }>({
    id: null,
    t: 0,
  });
  const actual = useRef(estado);
  actual.current = estado;

  useEffect(() => {
    // otro lugar: arranca de cero; el mismo o ninguno: sigue desde donde va
    const otro = id !== null && id !== actual.current.id;
    const desde = otro ? 0 : actual.current.t;
    const hasta = id ? 1 : 0;
    const visible = id ?? actual.current.id;
    if (sinMovimiento()) {
      setEstado({ id: hasta ? visible : null, t: hasta });
      return;
    }
    let raf = 0;
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const k = Math.min(1, (ahora - inicio) / ms);
      const t = desde + (hasta - desde) * easeOutCubic(k);
      const termino = k === 1;
      setEstado({ id: termino && !hasta ? null : visible, t });
      if (!termino) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [id, ms]);

  return estado;
}
