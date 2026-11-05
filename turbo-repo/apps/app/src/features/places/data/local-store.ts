"use client";

// Respaldo local (localStorage) para lugares y trayectos mientras el backend
// PT4 (PostgREST :3011) no esté disponible. Los ids locales llevan prefijo
// "local-" para que guardar/borrar no intente ir al servidor.
import { useCallback, useEffect, useState } from "react";
import type {
  Categoria,
  FormLugar,
  FormTrayecto,
  LatLon,
  Lugar,
  Trayecto,
} from "../places.types";
import { metadataParaGuardar } from "../places.types";
import { placesStorageKey } from "./storage-key";
import { categoriasUbicadas, tiposUbicados } from "../routes/recorrido";

const STORAGE_KEY = "miot.settings.places.local.v1";
export const LOCAL_PREFIX = "local-";

type LocalData = { lugares: Lugar[]; trayectos: Trayecto[] };
const EMPTY: LocalData = { lugares: [], trayectos: [] };

export const isLocalId = (id: string | null | undefined): boolean =>
  !!id?.startsWith(LOCAL_PREFIX);

export const newLocalId = (): string => `${LOCAL_PREFIX}${crypto.randomUUID()}`;

export function readLocal(scope: string | null): LocalData {
  const key = placesStorageKey(STORAGE_KEY, scope);
  if (!key) return EMPTY;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<LocalData>;
    return {
      lugares: Array.isArray(parsed.lugares) ? parsed.lugares : [],
      trayectos: Array.isArray(parsed.trayectos) ? parsed.trayectos : [],
    };
  } catch {
    return EMPTY;
  }
}

function writeLocal(scope: string | null, data: LocalData): boolean {
  const key = placesStorageKey(STORAGE_KEY, scope);
  if (!key) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

const upsert = <T>(xs: T[], x: T, same: (a: T) => boolean): T[] =>
  xs.some(same) ? xs.map((a) => (same(a) ? x : a)) : [...xs, x];

export function useLocalPlaces(scope: string | null) {
  const [stored, setStored] = useState({ scope, data: EMPTY });
  const data = stored.scope === scope ? stored.data : EMPTY;

  useEffect(() => setStored({ scope, data: readLocal(scope) }), [scope]);

  const commit = useCallback(
    (next: LocalData) => {
      if (!writeLocal(scope, next)) return false;
      setStored({ scope, data: next });
      return true;
    },
    [scope]
  );

  const saveLugar = useCallback(
    (l: Lugar) => {
      const cur = readLocal(scope);
      return commit({
        ...cur,
        lugares: upsert(cur.lugares, l, (a) => a.place_id === l.place_id),
      });
    },
    [commit, scope]
  );

  const deleteLugar = useCallback(
    (id: string) => {
      const cur = readLocal(scope);
      return commit({
        ...cur,
        lugares: cur.lugares.filter((a) => a.place_id !== id),
      });
    },
    [commit, scope]
  );

  const saveTrayecto = useCallback(
    (t: Trayecto) => {
      const cur = readLocal(scope);
      return commit({
        ...cur,
        trayectos: upsert(
          cur.trayectos,
          t,
          (a) => a.trayecto_id === t.trayecto_id
        ),
      });
    },
    [commit, scope]
  );

  const deleteTrayecto = useCallback(
    (id: string) => {
      const cur = readLocal(scope);
      return commit({
        ...cur,
        trayectos: cur.trayectos.filter((a) => a.trayecto_id !== id),
      });
    },
    [commit, scope]
  );

  return {
    lugares: data.lugares,
    trayectos: data.trayectos,
    saveLugar,
    deleteLugar,
    saveTrayecto,
    deleteTrayecto,
  };
}

export function lugarDesdeForm(
  form: FormLugar,
  cats: Categoria[],
  placeId: string
): Lugar {
  const cat = cats.find((c) => String(c.category_id) === form.category_id);
  const polygon = form.geom === "polygon";
  return {
    place_id: placeId,
    name: form.name,
    address: form.address || null,
    category: cat?.name ?? null,
    category_id: cat?.category_id ?? null,
    geometry_type: form.geom,
    color: form.color || cat?.color || null,
    center: form.lat != null && form.lon != null ? [form.lat, form.lon] : null,
    polygon: polygon ? form.vertices : null,
    radius_m: polygon ? null : form.radius_m,
    metadata: metadataParaGuardar(form),
    icon: form.icon || null,
    external_id: form.external_id || null,
    active_from: form.active_from || null,
    active_until: form.active_until || null,
  };
}

export function trayectoDesdeForm(
  tray: FormTrayecto,
  pathAjustado: LatLon[] | null,
  trayectoId: string
): Trayecto {
  return {
    trayecto_id: trayectoId,
    name: tray.name,
    kind: tray.kind,
    width_m: tray.width_m,
    points: tray.ajustado && pathAjustado ? pathAjustado : tray.pts,
    waypoints: tray.pts,
    parent_name: null,
    ajustado: tray.ajustado,
    external_id: tray.external_id || null,
    icon: tray.icon || null,
    categorias: tray.categorias.length > 0 ? tray.categorias : null,
    tipos_puntos: tiposUbicados(tray),
    categorias_puntos: categoriasUbicadas(tray),
  };
}

/**
 * Lista del servidor + copias locales. Si un lugar/trayecto del servidor se
 * editó y quedó guardado localmente (servidor caído al guardar), la copia
 * local lo reemplaza: así no se dibujan dos formas para el mismo id.
 */
export function fusionarPorId<T>(
  servidor: T[],
  locales: T[],
  id: (x: T) => string
): T[] {
  const ids = new Set(locales.map(id));
  return [...servidor.filter((x) => !ids.has(id(x))), ...locales];
}
