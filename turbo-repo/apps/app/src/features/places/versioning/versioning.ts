// Versionado de geocercas y trayectos, con el mismo sistema que los síntomas
// en Ajustes: versión semántica (mayor.menor.parche), cada cambio del
// formulario trae su tamaño y la versión recomendada sale del mayor de ellos.
// Las versiones las guarda miot-places (miot_places.place_version): cada
// edición manda su tamaño y descripción, y el servidor pone el número.
import type { VersionBump } from "@/features/symptoms/maintainer/maintainer-api";
import type {
  FormLugar,
  FormTrayecto,
  InnerGeofence,
  LatLon,
  Parada,
} from "../places.types";
import { textosLugares, type TextosLugares } from "../i18n/places-i18n";

export type { VersionBump };
export { nextVersion } from "@/features/symptoms/maintainer/publish-dialog";

/** Todo lo creado empieza en esta. */
export const VERSION_INICIAL = "1.0.0";

export type TipoVersionado = "lugar" | "trayecto";

export type CambioVersion = { texto: string; bump: VersionBump };

const ORDEN: VersionBump[] = ["PATCH", "MINOR", "MAJOR"];

/** El tamaño mayor entre los cambios; sin cambios, ninguno. */
export function bumpRecomendado(cambios: CambioVersion[]): VersionBump | null {
  let max = -1;
  for (const c of cambios) max = Math.max(max, ORDEN.indexOf(c.bump));
  return ORDEN[max] ?? null;
}

const EPS = 1e-7;
const mismoPunto = (a: LatLon | null, b: LatLon | null): boolean => {
  if (!a || !b) return a === b;
  return Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
};
const mismosPuntos = (a: LatLon[], b: LatLon[]): boolean =>
  a.length === b.length && a.every((p, i) => mismoPunto(p, b[i] ?? null));
const mismoTexto = (a: string, b: string) => a.trim() === b.trim();
const porTexto = (a: string, b: string) => a.localeCompare(b);
const mismaLista = (a: string[], b: string[]) =>
  a.length === b.length &&
  [...a].sort(porTexto).join("|") === [...b].sort(porTexto).join("|");
const citar = (t: TextosLugares, s: string) =>
  s.trim() ? t("versioning.quote", { s: s.trim() }) : t("versioning.empty");

/**
 * Los mismos códigos tomados de otra lista: no cambian las categorías, pero sí
 * dónde se buscan sus nombres. Si cambian los códigos, eso ya lo dice su cambio.
 */
function cambioDeLista(
  t: TextosLugares,
  que: string,
  antes: { codigos: string[]; lista?: string | null },
  despues: { codigos: string[]; lista?: string | null }
): CambioVersion[] {
  const listaAntes = antes.lista ?? null;
  const listaDespues = despues.lista ?? null;
  if (despues.codigos.length === 0 || listaAntes === listaDespues) return [];
  if (!mismaLista(antes.codigos, despues.codigos)) return [];
  return [
    {
      texto: t("versioning.list_changed", {
        que,
        antes: citar(t, listaAntes ?? ""),
        despues: citar(t, listaDespues ?? ""),
      }),
      bump: "MINOR",
    },
  ];
}

/** "2 agregadas, 1 quitada" entre dos listas de códigos. */
function diferenciaLista(
  t: TextosLugares,
  antes: string[],
  despues: string[]
): string {
  const agregadas = despues.filter((c) => !antes.includes(c)).length;
  const quitadas = antes.filter((c) => !despues.includes(c)).length;
  const partes: string[] = [];
  if (agregadas)
    partes.push(
      t(agregadas > 1 ? "versioning.added_many" : "versioning.added_one", {
        n: agregadas,
      })
    );
  if (quitadas)
    partes.push(
      t(quitadas > 1 ? "versioning.removed_many" : "versioning.removed_one", {
        n: quitadas,
      })
    );
  return partes.join(", ");
}

function cambioTexto(
  t: TextosLugares,
  etiqueta: string,
  antes: string,
  despues: string,
  bump: VersionBump
): CambioVersion[] {
  if (mismoTexto(antes, despues)) return [];
  return [
    {
      texto: t("versioning.field_changed", {
        etiqueta,
        antes: citar(t, antes),
        despues: citar(t, despues),
      }),
      bump,
    },
  ];
}

const textoVigencia = (t: TextosLugares, desde: string, hasta: string) =>
  desde || hasta
    ? t("versioning.validity_range", {
        desde: desde || "…",
        hasta: hasta || "…",
      })
    : t("versioning.no_validity");

const textoGeom = (t: TextosLugares, g: "circle" | "polygon") =>
  g === "polygon" ? t("versioning.polygon") : t("versioning.circle");

type FormaGeocerca = Pick<
  InnerGeofence,
  "geom" | "lat" | "lon" | "radius_m" | "vertices"
>;

/** Cambios de la forma de una geocerca (padre o interior): todos MAYOR. */
function cambiosForma(
  t: TextosLugares,
  antes: FormaGeocerca,
  despues: FormaGeocerca,
  de: string
): CambioVersion[] {
  if (antes.geom !== despues.geom) {
    return [
      {
        texto: t("versioning.shape_type", {
          de,
          antes: textoGeom(t, antes.geom),
          despues: textoGeom(t, despues.geom),
        }),
        bump: "MAJOR",
      },
    ];
  }
  if (despues.geom === "polygon") {
    if (mismosPuntos(antes.vertices, despues.vertices)) return [];
    const n = antes.vertices.length;
    const m = despues.vertices.length;
    const detalle =
      n === m
        ? t("versioning.vertices_moved")
        : t("versioning.vertices_count", { n, m });
    return [
      { texto: t("versioning.shape_of", { de, detalle }), bump: "MAJOR" },
    ];
  }
  const out: CambioVersion[] = [];
  const centroAntes: LatLon | null =
    antes.lat != null && antes.lon != null ? [antes.lat, antes.lon] : null;
  const centroDespues: LatLon | null =
    despues.lat != null && despues.lon != null
      ? [despues.lat, despues.lon]
      : null;
  if (!mismoPunto(centroAntes, centroDespues))
    out.push({ texto: t("versioning.center_moved", { de }), bump: "MAJOR" });
  if (antes.radius_m !== despues.radius_m)
    out.push({
      texto: t("versioning.radius_changed", {
        de,
        antes: String(antes.radius_m),
        despues: String(despues.radius_m),
      }),
      bump: "MAJOR",
    });
  return out;
}

/** Geocercas interiores: agregar o quitar es MENOR; cambiar su forma, MAYOR. */
function cambiosInteriores(
  t: TextosLugares,
  antes: InnerGeofence[],
  despues: InnerGeofence[]
): CambioVersion[] {
  const out: CambioVersion[] = [];
  const porId = new Map(antes.map((i) => [i.id, i]));
  const siguen = new Set(despues.map((i) => i.id));
  for (const i of despues) {
    const prev = porId.get(i.id);
    const nombre = citar(t, i.name);
    if (!prev) {
      out.push({
        texto: t("versioning.inner_added", { nombre }),
        bump: "MINOR",
      });
      continue;
    }
    out.push(...cambiosForma(t, prev, i, t("versioning.of_inner", { nombre })));
    if (!mismoTexto(prev.name, i.name))
      out.push({
        texto: t("versioning.inner_renamed", {
          antes: citar(t, prev.name),
          nombre,
        }),
        bump: "PATCH",
      });
    if (prev.color !== i.color)
      out.push({
        texto: t("versioning.inner_color", { nombre }),
        bump: "PATCH",
      });
  }
  for (const i of antes) {
    if (!siguen.has(i.id))
      out.push({
        texto: t("versioning.inner_removed", { nombre: citar(t, i.name) }),
        bump: "MINOR",
      });
  }
  return out;
}

const filasMetadata = (f: FormLugar) =>
  f.metadata
    .filter((r) => r.k.trim())
    .map((r) => `${r.k.trim()}=${r.v.trim()}`);

/**
 * Qué cambió en una geocerca entre que se abrió y se guarda.
 * MAYOR: su forma (lo que detecta); MENOR: categorías, vigencia, interiores;
 * PARCHE: nombre, color, ícono y demás datos.
 */
export function cambiosLugar(
  antes: FormLugar,
  despues: FormLugar,
  t: TextosLugares = textosLugares()
): CambioVersion[] {
  const out: CambioVersion[] = [
    ...cambiosForma(t, antes, despues, t("versioning.of_geofence")),
    ...cambiosInteriores(t, antes.inners, despues.inners),
  ];
  if (!mismaLista(antes.categorias, despues.categorias))
    out.push({
      texto: t("versioning.categories_diff", {
        detalle: diferenciaLista(t, antes.categorias, despues.categorias),
      }),
      bump: "MINOR",
    });
  out.push(
    ...cambioDeLista(
      t,
      t("common.categories"),
      { codigos: antes.categorias, lista: antes.categorias_lista },
      { codigos: despues.categorias, lista: despues.categorias_lista }
    )
  );
  if (antes.category_id !== despues.category_id)
    out.push({ texto: t("versioning.place_category"), bump: "MINOR" });
  const vigAntes = textoVigencia(t, antes.active_from, antes.active_until);
  const vigDespues = textoVigencia(
    t,
    despues.active_from,
    despues.active_until
  );
  if (vigAntes !== vigDespues)
    out.push({
      texto: t("versioning.validity_changed", {
        antes: vigAntes,
        despues: vigDespues,
      }),
      bump: "MINOR",
    });
  out.push(
    ...cambioTexto(t, t("versioning.name"), antes.name, despues.name, "PATCH"),
    ...cambioTexto(
      t,
      t("versioning.address"),
      antes.address,
      despues.address,
      "PATCH"
    ),
    ...cambioTexto(
      t,
      t("versioning.external_id"),
      antes.external_id,
      despues.external_id,
      "PATCH"
    )
  );
  if (antes.color !== despues.color)
    out.push({ texto: t("versioning.color_changed"), bump: "PATCH" });
  if (antes.icon !== despues.icon)
    out.push({ texto: t("versioning.icon_changed"), bump: "PATCH" });
  if (!mismaLista(filasMetadata(antes), filasMetadata(despues)))
    out.push({ texto: t("versioning.metadata_changed"), bump: "PATCH" });
  return out;
}

const ubicados = (t: FormTrayecto): Parada[] =>
  t.recorrido.filter((p) => p.punto);

const categoriasDePuntos = (t: FormTrayecto): string[] =>
  t.recorrido.flatMap((p) => (p.categoria ? [p.categoria] : []));

/** El recorrido: origen, destino o puntos intermedios distintos son MAYOR. */
function cambiosRecorrido(
  t: TextosLugares,
  antes: FormTrayecto,
  despues: FormTrayecto
): CambioVersion[] {
  const a = ubicados(antes);
  const b = ubicados(despues);
  const out: CambioVersion[] = [];
  if (!mismoPunto(a[0]?.punto ?? null, b[0]?.punto ?? null))
    out.push({ texto: t("versioning.origin_moved"), bump: "MAJOR" });
  if (!mismoPunto(a.at(-1)?.punto ?? null, b.at(-1)?.punto ?? null))
    out.push({ texto: t("versioning.destination_moved"), bump: "MAJOR" });
  const midA = a.slice(1, -1);
  const midB = b.slice(1, -1);
  if (midA.length !== midB.length) {
    out.push({
      texto: t("versioning.midpoints_count", {
        antes: midA.length,
        despues: midB.length,
      }),
      bump: "MAJOR",
    });
    return out;
  }
  const movidos = midA.filter(
    (p, i) => !mismoPunto(p.punto, midB[i]?.punto ?? null)
  ).length;
  if (movidos)
    out.push({
      texto: t("versioning.midpoints_moved", { n: movidos }),
      bump: "MAJOR",
    });
  // mismos puntos: lo que cambia es qué son (parada o desvío) o su categoría
  const tipos = midA.filter(
    (p, i) => (p.tipo ?? "parada") !== (midB[i]?.tipo ?? "parada")
  ).length;
  if (tipos)
    out.push({
      texto: t(
        tipos > 1 ? "versioning.stop_kind_many" : "versioning.stop_kind_one",
        { n: tipos }
      ),
      bump: "MINOR",
    });
  const cats = midA.filter(
    (p, i) => (p.categoria ?? "") !== (midB[i]?.categoria ?? "")
  ).length;
  if (cats)
    out.push({
      texto: t(
        cats > 1
          ? "versioning.point_category_many"
          : "versioning.point_category_one",
        { n: cats }
      ),
      bump: "MINOR",
    });
  return out;
}

/**
 * Qué cambió en un trayecto entre que se abrió y se guarda.
 * MAYOR: el recorrido, el tipo de ruta o su ancho; MENOR: categorías y qué
 * es cada punto; PARCHE: nombre, ícono e ID externo.
 */
export function cambiosTrayecto(
  antes: FormTrayecto,
  despues: FormTrayecto,
  t: TextosLugares = textosLugares()
): CambioVersion[] {
  const out = cambiosRecorrido(t, antes, despues);
  if (antes.kind !== despues.kind)
    out.push({
      texto: t("versioning.route_kind", {
        antes: antes.kind,
        despues: despues.kind,
      }),
      bump: "MAJOR",
    });
  if (antes.width_m !== despues.width_m)
    out.push({
      texto: t("versioning.width_changed", {
        antes: String(antes.width_m),
        despues: String(despues.width_m),
      }),
      bump: "MAJOR",
    });
  if (antes.ajustado !== despues.ajustado)
    out.push({
      texto: despues.ajustado
        ? t("versioning.snapped")
        : t("versioning.unsnapped"),
      bump: "MAJOR",
    });
  if (!mismaLista(antes.categorias, despues.categorias))
    out.push({
      texto: t("versioning.categories_diff", {
        detalle: diferenciaLista(t, antes.categorias, despues.categorias),
      }),
      bump: "MINOR",
    });
  out.push(
    ...cambioDeLista(
      t,
      t("common.categories"),
      { codigos: antes.categorias, lista: antes.categorias_lista },
      { codigos: despues.categorias, lista: despues.categorias_lista }
    ),
    ...cambioDeLista(
      t,
      t("versioning.point_categories"),
      {
        codigos: categoriasDePuntos(antes),
        lista: antes.categorias_puntos_lista,
      },
      {
        codigos: categoriasDePuntos(despues),
        lista: despues.categorias_puntos_lista,
      }
    ),
    ...cambioTexto(t, t("versioning.name"), antes.name, despues.name, "PATCH"),
    ...cambioTexto(
      t,
      t("versioning.external_id"),
      antes.external_id,
      despues.external_id,
      "PATCH"
    )
  );
  if (antes.icon !== despues.icon)
    out.push({ texto: t("versioning.icon_changed"), bump: "PATCH" });
  return out;
}
