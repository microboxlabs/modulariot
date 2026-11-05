"use client";

// Categoría de un punto intermedio del trayecto: una o varias (según la
// lista), con el mismo selector de geocercas y trayectos.
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { pickText } from "@/features/settings-admin/selectables/localized";
import CampoCategorias, {
  CAMPO_CATEGORIA_PUNTO,
  useListaCampo,
} from "../ui/place-categories-field";

/** Nombre de la categoría elegida (o el código si ya no está en la lista). */
export function useNombreCategoriaPunto(
  value: string | undefined,
  lista?: string | null
) {
  const { lang, opciones } = useListaCampo(CAMPO_CATEGORIA_PUNTO, lista);
  const codigos = value ? value.split(",").filter(Boolean) : [];
  const [primero] = codigos;
  if (!primero) return null;
  const o = opciones.find((x) => x.value === primero);
  const nombre = o ? pickText(o.label, lang) || primero : primero;
  // lista de selección múltiple: "Carga +2"
  return codigos.length > 1 ? `${nombre} +${codigos.length - 1}` : nombre;
}

/**
 * Categoría de un punto intermedio: el mismo selector de geocercas y
 * trayectos (una o varias según la lista). En el punto se guardan unidas por
 * coma; sin ninguna, el punto queda sin categoría.
 */
export default function PointCategorySelect({
  label,
  value,
  lista = null,
  onChange,
  dict,
}: Readonly<{
  /** Rótulo del punto ("Parada 1", "Desvío 2"), para el lector de pantalla. */
  label: string;
  value: string | undefined;
  /** El seleccionable de las categorías de los puntos del trayecto. */
  lista?: string | null;
  onChange: (codigo: string | undefined, lista: string | null) => void;
  dict: I18nRecord;
}>) {
  return (
    <CampoCategorias
      fieldKey={CAMPO_CATEGORIA_PUNTO}
      label={`Categoría de ${label}`}
      value={value ? value.split(",").filter(Boolean) : []}
      listaGuardada={lista}
      onChange={(codigos, nueva) =>
        onChange(codigos.join(",") || undefined, nueva)
      }
      dict={dict}
    />
  );
}
