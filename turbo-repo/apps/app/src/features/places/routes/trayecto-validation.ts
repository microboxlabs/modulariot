// Validación del trayecto antes de guardar (el botón y el "Guardar" del aviso
// de cambios sin guardar): si algo está mal no se guarda.
import { puntosRecorrido } from "./recorrido";
import type { FormTrayecto } from "../places.types";

/** Ancho del corredor en metros (mismo control que el radio de geocercas). */
export const ANCHO_MIN = 1;
export const ANCHO_MAX = 10_000;

/** Primer problema que impide guardar el trayecto, o null si está listo. */
export function errorTrayecto(tray: FormTrayecto): string | null {
  const puntos = puntosRecorrido(tray);
  if (!puntos) return "Ubica al menos el origen (A) y el destino (B).";
  if (!tray.confirmado)
    return "Confirma el recorrido con «Listo» en la barra del mapa.";
  if (tray.pts.length < 2) return "El recorrido necesita al menos 2 puntos.";
  if (!tray.name.trim()) return "Falta el nombre del trayecto.";
  const ancho = tray.width_m;
  if (!Number.isFinite(ancho) || ancho < ANCHO_MIN || ancho > ANCHO_MAX)
    return `El ancho debe estar entre ${ANCHO_MIN} y ${ANCHO_MAX.toLocaleString("es-CL")} m.`;
  return null;
}
