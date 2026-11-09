"use client";

// Categorías de geocercas, trayectos y puntos intermedios: el mismo selector
// de la vista de tratamiento (`SelectableDropdown`). Las opciones salen de un
// seleccionable (Ajustes › Seleccionables) y es la lista la que decide si se
// elige una o varias. A la derecha, para quien puede configurarla, el control
// de lista (engranaje o el nombre de la lista vinculada).
import { useEffect } from "react";
import { useParams } from "next/navigation";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { useFieldSelectableBinding } from "@/features/settings-admin/selectables/field-bindings";
import {
  useSelectableBindings,
  useSelectableOptions,
} from "@/features/settings-admin/selectables/selectables-api";
import { useSelectables } from "@/features/settings-admin/selectables/store";
import { OptionBadge } from "@/features/settings-admin/selectables/field/field-parts";
import { pickText } from "@/features/settings-admin/selectables/localized";
import type {
  Selectable,
  SelectableOption,
} from "@/features/settings-admin/selectables/types";
import {
  SelectableBindingControl,
  SelectableDropdown,
} from "@/features/symptoms/components/map-view/prototype/prototype-form-kit";
import { usePlacesT } from "../i18n/places-i18n";

export const CAMPO_CATEGORIAS = "place_categories";
/** Categorías de los trayectos: su propia lista, aparte de la de lugares. */
export const CAMPO_CATEGORIAS_TRAYECTO = "trayecto_categories";
/** Categoría de cada punto intermedio de un trayecto. */
export const CAMPO_CATEGORIA_PUNTO = "trayecto_point_category";
/**
 * Temporal: el control de lista se muestra a todos mientras se prueba. Al
 * volver a `false`, solo el dueño de la organización lo ve (la API igual
 * rechaza el vínculo de quien no es dueño).
 */
export const AJUSTES_PARA_TODOS = true;

/** Opciones de la lista: las propias o, si es dinámica, las de su fuente. */
function useOpcionesLista(lista: Selectable | undefined): SelectableOption[] {
  const dinamica = !!lista && lista.source.kind !== "STATIC";
  const { data } = useSelectableOptions(dinamica ? lista.key : null, {});
  if (!lista) return [];
  return dinamica ? (data ?? []) : lista.options;
}

/**
 * La lista de un campo (la vinculada a `fieldKey` o, sin vínculo, la de esa
 * misma clave), sus opciones y si quien mira puede cambiar la lista. Con
 * `listaGuardada`, la de lo guardado: sus nombres no dependen del vínculo actual.
 */
export function useListaCampo(fieldKey: string, listaGuardada?: string | null) {
  const lang = useParams<{ lang: string }>()?.lang ?? "es";
  const { activeOrg } = useOrgScopes();
  // como en Seleccionables: cualquiera lee, solo el dueño cambia las listas
  const puedeConfigurar = AJUSTES_PARA_TODOS || activeOrg?.role === "OWNER";
  const t = usePlacesT();
  const fallo = t("form.lists_failed");
  const { selectables, hydrated } = useSelectables(fallo);
  const [listaKey] = useFieldSelectableBinding(fieldKey, fallo);
  // hasta que lleguen los vínculos, `listaKey` es la clave del campo y no su lista
  const { data: vinculos, error: falloVinculos } = useSelectableBindings();
  const listo = hydrated && (vinculos !== undefined || !!falloVinculos);
  const buscada = listaGuardada ?? listaKey;
  const lista = selectables.find((s) => s.key === buscada);
  const opciones = useOpcionesLista(lista);
  return { lang, puedeConfigurar, hydrated, listo, lista, opciones };
}

/**
 * Selector de categorías con el `SelectableDropdown` de la vista de
 * tratamiento: una o varias según la lista. El valor es siempre una lista de
 * códigos (con una sola opción, de un elemento), así cambiar la lista entre
 * una y varias no rompe lo guardado. Un lugar usa un solo seleccionable: si lo
 * guardado viene de otro (se cambió la lista del campo), se ve con sus nombres
 * hasta que elegir de la lista actual lo reemplaza. Vaciarlo es una opción del desplegable
 * ("Sin categoría" / "Limpiar selección"), sin botón aparte.
 */
export default function CampoCategorias({
  fieldKey,
  label,
  value,
  listaGuardada = null,
  onChange,
  dict,
}: Readonly<{
  /** Campo cuyo seleccionable da las opciones. */
  fieldKey: string;
  /** Nombre del campo, para el lector de pantalla ("Categorías", "Categoría de Parada 1"). */
  label: string;
  value: string[];
  /** El seleccionable de `value`, donde buscar sus nombres. */
  listaGuardada?: string | null;
  /** Los códigos y el seleccionable de donde salen (null si no quedan). */
  onChange: (next: string[], lista: string | null) => void;
  /** Diccionario completo (textos del selector y del control de lista). */
  dict: I18nRecord;
}>) {
  const t = usePlacesT();
  const { puedeConfigurar, lista, lang, listo } = useListaCampo(fieldKey);
  const { opciones } = useListaCampo(fieldKey, listaGuardada);
  const listaActual = lista?.key ?? fieldKey;
  const deOtraLista = !!listaGuardada && listaGuardada !== listaActual;
  // guardado en este navegador antes de que se guardara la lista: sus códigos
  // son de la del campo. Sin ella, guardarlo en el servidor los perdería.
  const sinLista = listo && value.length > 0 && !listaGuardada;
  useEffect(() => {
    if (sinLista) onChange(value, listaActual);
  }, [sinLista, value, listaActual, onChange]);
  // SelectableDropdown habla con un texto: varias van unidas por coma
  const elegir = (o: { id: string }) => {
    const codigos = o.id.split(",").filter(Boolean);
    onChange(codigos, codigos.length > 0 ? listaActual : null);
  };
  const quitar = (codigo: string) => {
    const quedan = value.filter((v) => v !== codigo);
    onChange(quedan, quedan.length > 0 ? (listaGuardada ?? listaActual) : null);
  };
  // con varias, el desplegable solo dice "N seleccionadas": se ven abajo
  const verElegidas =
    value.length > 0 &&
    (lista?.mode === "MULTIPLE" || value.length > 1 || deOtraLista);
  return (
    <div className="min-w-0 space-y-1.5">
      <fieldset aria-label={label} className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1">
          <SelectableDropdown
            fieldKey={fieldKey}
            dict={dict}
            value={deOtraLista ? "" : value.join(",")}
            onSelect={elegir}
            placeholder={t("form.no_category")}
            // vaciar el campo es una opción del propio desplegable
            clearLabel={
              lista?.mode === "MULTIPLE"
                ? t("form.clear_selection")
                : t("form.no_category")
            }
            onClear={() => onChange([], null)}
          />
        </div>
        {puedeConfigurar && (
          <SelectableBindingControl fieldKey={fieldKey} dict={dict} />
        )}
      </fieldset>
      {verElegidas && (
        <ul
          aria-label={t("form.chosen", { label })}
          className="flex flex-wrap gap-1"
        >
          {value.map((codigo) => {
            // un código que ya no está en la lista se muestra tal cual
            const opcion = opciones.find((o) => o.value === codigo) ?? {
              value: codigo,
              label: { es: codigo },
            };
            return (
              <li key={codigo}>
                <OptionBadge
                  option={opcion}
                  lang={lang}
                  removeLabel={t("form.remove_item", {
                    nombre: pickText(opcion.label, lang) || codigo,
                  })}
                  onRemove={quitar}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
