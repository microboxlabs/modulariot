// Validación del lugar antes de guardar: si algo está mal no se guarda y el
// formulario muestra el primer problema. La usa todo guardado (el botón y el
// "Guardar" del aviso de cambios sin guardar).
import {
  RADIO_MAX,
  RADIO_MIN,
  RECT_MAX,
  RECT_MIN,
  esFormaParametrica,
  esPoligonoLibre,
  geomKindDe,
} from "./geofence-editor";
import {
  innersParaGuardar,
  mensajeInnerIncompleto,
  mensajePadreIncompleto,
} from "./inner-geofences";
import type { FormLugar } from "../places.types";
import { textosLugares, type TextosLugares } from "../i18n/places-i18n";

const enRango = (n: number, min: number, max: number) =>
  Number.isFinite(n) && n >= min && n <= max;

/** Fecha AAAA-MM-DD válida (vacía = sin límite). */
const fechaValida = (s: string) =>
  s === "" || !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

function errorForma(form: FormLugar, t: TextosLugares): string | null {
  if (form.geom === "circle" && !enRango(form.radius_m, RADIO_MIN, RADIO_MAX))
    return t("validation.radius_range", {
      min: RADIO_MIN,
      max: RADIO_MAX.toLocaleString(t("common.number_locale")),
    });
  if (
    esFormaParametrica(geomKindDe(form)) &&
    !(
      enRango(form.rect_w_m, RECT_MIN, RECT_MAX) &&
      enRango(form.rect_h_m, RECT_MIN, RECT_MAX)
    )
  )
    return t("validation.size_range", {
      min: RECT_MIN,
      max: RECT_MAX.toLocaleString(t("common.number_locale")),
    });
  if (esPoligonoLibre(form) && !form.cerrado)
    return t("validation.close_polygon");
  return null;
}

function errorVigencia(form: FormLugar, t: TextosLugares): string | null {
  const { active_from: desde, active_until: hasta } = form;
  if (!fechaValida(desde) || !fechaValida(hasta))
    return t("validation.check_dates");
  if (desde && hasta && desde > hasta) return t("validation.dates_order");
  return null;
}

/**
 * El External ID es obligatorio: junto a la organización es la llave con la
 * que la geocerca se encuentra en StreamHub (client_geofence_id).
 */
export const faltaExternalId = (form: FormLugar) => !form.external_id.trim();

/** Primer problema que impide guardar el lugar, o null si está listo. */
export function errorLugar(
  form: FormLugar,
  t: TextosLugares = textosLugares()
): string | null {
  const incompleto = mensajePadreIncompleto(form, t);
  if (incompleto) return incompleto;
  if (faltaExternalId(form)) return t("validation.code_missing");
  const forma = errorForma(form, t);
  if (forma) return forma;
  const vigencia = errorVigencia(form, t);
  if (vigencia) return vigencia;
  for (const inner of innersParaGuardar(form.inners)) {
    const msg = mensajeInnerIncompleto(inner, t);
    if (msg) return msg;
    if (esPoligonoLibre(inner) && !inner.cerrado)
      return t("validation.close_inner_polygon", { nombre: inner.name });
  }
  return null;
}
