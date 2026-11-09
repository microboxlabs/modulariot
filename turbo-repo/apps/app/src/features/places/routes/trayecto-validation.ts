// Validación del trayecto antes de guardar (el botón y el "Guardar" del aviso
// de cambios sin guardar): si algo está mal no se guarda.
import { puntosRecorrido } from "./recorrido";
import type { FormTrayecto } from "../places.types";
import { textosLugares, type TextosLugares } from "../i18n/places-i18n";

/** Ancho del corredor en metros (mismo control que el radio de geocercas). */
export const ANCHO_MIN = 1;
export const ANCHO_MAX = 10_000;

/** Obligatorio, pero se puede editar: un trayecto solo se usa en Lugares. */
export const faltaExternalIdTrayecto = (tray: FormTrayecto) =>
  !tray.external_id.trim();

/** Primer problema que impide guardar el trayecto, o null si está listo. */
export function errorTrayecto(
  tray: FormTrayecto,
  t: TextosLugares = textosLugares()
): string | null {
  const puntos = puntosRecorrido(tray);
  if (!puntos) return t("workspace.place_origin_destination");
  if (!tray.confirmado) return t("validation.confirm_path");
  if (tray.pts.length < 2) return t("validation.path_two_points");
  if (!tray.name.trim()) return t("workspace.route_name_missing");
  if (faltaExternalIdTrayecto(tray)) return t("validation.code_missing");
  const ancho = tray.width_m;
  if (!Number.isFinite(ancho) || ancho < ANCHO_MIN || ancho > ANCHO_MAX)
    return t("validation.width_range", {
      min: ANCHO_MIN,
      max: ANCHO_MAX.toLocaleString(t("common.number_locale")),
    });
  return null;
}
