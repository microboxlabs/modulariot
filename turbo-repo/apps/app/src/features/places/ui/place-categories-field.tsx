"use client";

// Categorías de geocercas, trayectos y puntos intermedios: el mismo selector
// de la vista de tratamiento (`SelectableDropdown`). Las opciones salen de un
// seleccionable (Ajustes › Seleccionables) y es la lista la que decide si se
// elige una o varias. A la derecha, para quien puede configurarla, el control
// de lista (engranaje o el nombre de la lista vinculada).
import { useParams } from "next/navigation";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import { useFieldSelectableBinding } from "@/features/settings-admin/selectables/field-bindings";
import { useSelectableOptions } from "@/features/settings-admin/selectables/selectables-api";
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

export const CAMPO_CATEGORIAS = "place_categories";
/** Categorías de los trayectos: su propia lista, aparte de la de lugares. */
export const CAMPO_CATEGORIAS_TRAYECTO = "trayecto_categories";
/** Categoría de cada punto intermedio de un trayecto. */
export const CAMPO_CATEGORIA_PUNTO = "trayecto_point_category";
const FALLO = "No se pudieron cargar las listas";
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
 * misma clave), sus opciones y si quien mira puede cambiar la lista.
 */
export function useListaCampo(fieldKey: string) {
  const lang = useParams<{ lang: string }>()?.lang ?? "es";
  const { activeOrg } = useOrgScopes();
  // como en Seleccionables: cualquiera lee, solo el dueño cambia las listas
  const puedeConfigurar = AJUSTES_PARA_TODOS || activeOrg?.role === "OWNER";
  const { selectables, hydrated } = useSelectables(FALLO);
  const [listaKey] = useFieldSelectableBinding(fieldKey, FALLO);
  const lista = selectables.find((s) => s.key === listaKey);
  const opciones = useOpcionesLista(lista);
  return { lang, puedeConfigurar, hydrated, lista, opciones };
}

/**
 * Selector de categorías con el `SelectableDropdown` de la vista de
 * tratamiento: una o varias según la lista. El valor es siempre una lista de
 * códigos (con una sola opción, de un elemento), así cambiar la lista entre
 * una y varias no rompe lo guardado. Vaciarlo es una opción del desplegable
 * ("Sin categoría" / "Limpiar selección"), sin botón aparte.
 */
export default function CampoCategorias({
  fieldKey,
  label,
  value,
  onChange,
  dict,
}: Readonly<{
  /** Campo cuyo seleccionable da las opciones. */
  fieldKey: string;
  /** Nombre del campo, para el lector de pantalla ("Categorías", "Categoría de Parada 1"). */
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** Diccionario completo (textos del selector y del control de lista). */
  dict: I18nRecord;
}>) {
  const { puedeConfigurar, lista, opciones, lang } = useListaCampo(fieldKey);
  // SelectableDropdown habla con un texto: varias van unidas por coma
  const elegir = (o: { id: string }) =>
    onChange(o.id.split(",").filter(Boolean));
  const quitar = (codigo: string) =>
    onChange(value.filter((v) => v !== codigo));
  // con varias, el desplegable solo dice "N seleccionadas": se ven abajo
  const verElegidas =
    value.length > 0 && (lista?.mode === "MULTIPLE" || value.length > 1);
  return (
    <div className="min-w-0 space-y-1.5">
      <fieldset aria-label={label} className="flex min-w-0 items-center gap-1">
        <div className="min-w-0 flex-1">
          <SelectableDropdown
            fieldKey={fieldKey}
            dict={dict}
            value={value.join(",")}
            onSelect={elegir}
            placeholder="Sin categoría"
            // vaciar el campo es una opción del propio desplegable
            clearLabel={
              lista?.mode === "MULTIPLE" ? "Limpiar selección" : "Sin categoría"
            }
            onClear={() => onChange([])}
          />
        </div>
        {puedeConfigurar && (
          <SelectableBindingControl fieldKey={fieldKey} dict={dict} />
        )}
      </fieldset>
      {verElegidas && (
        <ul aria-label={`${label} elegidas`} className="flex flex-wrap gap-1">
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
                  removeLabel={`Quitar ${pickText(opcion.label, lang) || codigo}`}
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
