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

const enRango = (n: number, min: number, max: number) =>
  Number.isFinite(n) && n >= min && n <= max;

/** Fecha AAAA-MM-DD válida (vacía = sin límite). */
const fechaValida = (s: string) =>
  s === "" || !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

function errorForma(form: FormLugar): string | null {
  if (form.geom === "circle" && !enRango(form.radius_m, RADIO_MIN, RADIO_MAX))
    return `El radio debe estar entre ${RADIO_MIN} y ${RADIO_MAX.toLocaleString("es-CL")} m.`;
  if (
    esFormaParametrica(geomKindDe(form)) &&
    !(
      enRango(form.rect_w_m, RECT_MIN, RECT_MAX) &&
      enRango(form.rect_h_m, RECT_MIN, RECT_MAX)
    )
  )
    return `El ancho y el alto deben estar entre ${RECT_MIN} y ${RECT_MAX.toLocaleString("es-CL")} m.`;
  if (esPoligonoLibre(form) && !form.cerrado)
    return "Cierra el polígono (une el último punto con el primero) antes de guardar.";
  return null;
}

function errorVigencia(form: FormLugar): string | null {
  const { active_from: desde, active_until: hasta } = form;
  if (!fechaValida(desde) || !fechaValida(hasta))
    return "Revisa las fechas de vigencia.";
  if (desde && hasta && desde > hasta)
    return "La vigencia «Desde» no puede ser posterior a «Hasta».";
  return null;
}

/** Primer problema que impide guardar el lugar, o null si está listo. */
export function errorLugar(form: FormLugar): string | null {
  const incompleto = mensajePadreIncompleto(form);
  if (incompleto) return incompleto;
  const forma = errorForma(form);
  if (forma) return forma;
  const vigencia = errorVigencia(form);
  if (vigencia) return vigencia;
  for (const inner of innersParaGuardar(form.inners)) {
    const msg = mensajeInnerIncompleto(inner);
    if (msg) return msg;
    if (esPoligonoLibre(inner) && !inner.cerrado)
      return `Cierra el polígono del interior «${inner.name}» antes de guardar.`;
  }
  return null;
}
