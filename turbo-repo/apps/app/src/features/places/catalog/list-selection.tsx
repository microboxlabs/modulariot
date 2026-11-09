"use client";

// Elegir varios lugares y trayectos de la lista para borrarlos de una vez:
// el estado de la selección y la barra que aparece mientras hay algo elegido.
import { useCallback, useMemo, useState } from "react";
import { Button, Checkbox } from "flowbite-react";
import { HiOutlineTrash } from "react-icons/hi";
import { CASILLA_SIN_ANILLO, type MarcasLista } from "./list-card";
import type { Lugar, Trayecto } from "../places.types";
import {
  textosLugares,
  usePlacesT,
  type TextosLugares,
} from "../i18n/places-i18n";

/** "3 lugares y 2 trayectos" para la confirmación del lote. */
export function resumenSeleccion(
  lugares: number,
  trayectos: number,
  t: TextosLugares = textosLugares()
): string {
  const partes: string[] = [];
  if (lugares)
    partes.push(
      t(lugares === 1 ? "catalog.places_one" : "catalog.places_many", {
        n: lugares,
      })
    );
  if (trayectos)
    partes.push(
      t(trayectos === 1 ? "catalog.routes_one" : "catalog.routes_many", {
        n: trayectos,
      })
    );
  return partes.join(t("catalog.and"));
}

function conVarios(prev: Set<string>, ids: string[], marcado: boolean) {
  const next = new Set(prev);
  for (const id of ids) {
    if (marcado) next.add(id);
    else next.delete(id);
  }
  return next;
}

function alternar(prev: Set<string>, id: string, marcado: boolean) {
  if (prev.has(id) === marcado) return prev;
  const next = new Set(prev);
  if (marcado) next.add(id);
  else next.delete(id);
  return next;
}

/**
 * Selección de la lista. Solo cuenta lo que sigue existiendo: si un elemento
 * se borra o desaparece, deja de estar elegido.
 */
export function useSeleccionLista(lugares: Lugar[], trayectos: Trayecto[]) {
  const [idsLugares, setIdsLugares] = useState<Set<string>>(() => new Set());
  const [idsTray, setIdsTray] = useState<Set<string>>(() => new Set());

  const lugaresSel = useMemo(
    () => lugares.filter((l) => idsLugares.has(l.place_id)),
    [lugares, idsLugares]
  );
  const trayectosSel = useMemo(
    () => trayectos.filter((t) => idsTray.has(t.trayecto_id)),
    [trayectos, idsTray]
  );
  const total = lugaresSel.length + trayectosSel.length;

  const marcarLugar = useCallback(
    (id: string, v: boolean) => setIdsLugares((p) => alternar(p, id, v)),
    []
  );
  const marcarTrayecto = useCallback(
    (id: string, v: boolean) => setIdsTray((p) => alternar(p, id, v)),
    []
  );
  const marcarLugares = useCallback(
    (ids: string[], v: boolean) => setIdsLugares((p) => conVarios(p, ids, v)),
    []
  );
  const marcarTrayectos = useCallback(
    (ids: string[], v: boolean) => setIdsTray((p) => conVarios(p, ids, v)),
    []
  );
  const limpiar = useCallback(() => {
    setIdsLugares(new Set());
    setIdsTray(new Set());
  }, []);
  /** Todo lo que se ve (con la búsqueda aplicada), o nada si ya estaba. */
  const marcarVisibles = (visLugares: Lugar[], visTray: Trayecto[]) => {
    const todos =
      visLugares.every((l) => idsLugares.has(l.place_id)) &&
      visTray.every((t) => idsTray.has(t.trayecto_id));
    if (todos) {
      limpiar();
      return;
    }
    setIdsLugares(new Set(visLugares.map((l) => l.place_id)));
    setIdsTray(new Set(visTray.map((t) => t.trayecto_id)));
  };

  const marcasLugares: MarcasLista = {
    marcados: idsLugares,
    onMarcar: marcarLugar,
    onMarcarVarios: marcarLugares,
    siempre: total > 0,
  };
  const marcasTrayectos: MarcasLista = {
    marcados: idsTray,
    onMarcar: marcarTrayecto,
    onMarcarVarios: marcarTrayectos,
    siempre: total > 0,
  };

  return {
    lugaresSel,
    trayectosSel,
    total,
    marcasLugares,
    marcasTrayectos,
    marcarVisibles,
    limpiar,
  };
}

export function SelectionBar({
  total,
  todosVisibles,
  onTodos,
  onCancelar,
  onEliminar,
}: Readonly<{
  total: number;
  /** Todo lo que se ve está elegido. */
  todosVisibles: boolean;
  onTodos: () => void;
  onCancelar: () => void;
  onEliminar: () => void;
}>) {
  const t = usePlacesT();
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 py-1 pr-1 pl-3 dark:border-blue-900/50 dark:bg-blue-900/20">
      <Checkbox
        color="blue"
        id="seleccionar-todos"
        aria-label={t("catalog.select_visible")}
        className={CASILLA_SIN_ANILLO}
        checked={todosVisibles}
        onChange={onTodos}
      />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-blue-900 dark:text-blue-100">
        {total === 1
          ? t("catalog.selected_one")
          : t("catalog.selected_many", { n: total })}
      </span>
      <Button size="xs" color="alternative" onClick={onCancelar}>
        {t("common.cancel")}
      </Button>
      <Button size="xs" color="red" onClick={onEliminar}>
        <HiOutlineTrash className="mr-1 h-3.5 w-3.5" />
        {t("common.delete")}
      </Button>
    </div>
  );
}
