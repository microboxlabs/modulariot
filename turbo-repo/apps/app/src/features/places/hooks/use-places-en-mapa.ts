"use client";

// Todo lo que un mapa necesita para mostrar y editar Lugares: el estado del
// editor, los badges de nombres (con clusters y resaltado) y lo que el mapa
// debe hacer con los clics. Lo usan la vista geográfica y el mapa de viaje
// (bento y síntomas), así ninguno lo arma por su cuenta.
import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import type { MapRef } from "react-map-gl";
import { CURSOR_AGREGAR } from "../map/cursors";
import { zoomAlClicNombre } from "../map/geofence-lod";
import { useResaltadoAnimado } from "../map/highlight-animation";
import {
  itemsNombresMapa,
  itemsTrayectos,
  type ItemNombre,
} from "../map/place-labels";
import { capasNombresGeocercas } from "../map/place-name-layer";
import { usePlacesWorkspace } from "./use-places-workspace";

export function usePlacesEnMapa(
  mapRef: RefObject<MapRef | null>,
  {
    editando,
    verGeocercas = editando,
    puedeEditar = true,
    nombres = {},
    mapStyle,
    zoom,
  }: {
    /** El editor de Lugares está abierto: los clics del mapa son suyos. */
    editando: boolean;
    /** Las geocercas se ven (solo lectura si no se edita). */
    verGeocercas?: boolean;
    /** Sin el permiso "Editor de lugares": solo ver, buscar y descargar. */
    puedeEditar?: boolean;
    /** Qué badges de nombre van: geocercas (por defecto sí) y trayectos (no). */
    nombres?: { geocercas?: boolean; trayectos?: boolean };
    mapStyle: string;
    zoom: number;
  }
) {
  const ws = usePlacesWorkspace(mapRef, {
    enabled: editando || verGeocercas,
    puedeEditar,
  });

  // al cerrar el editor, lo que quedó abierto (formulario, import) se cierra
  useEffect(() => {
    if (!editando && ws.modo !== "ver") ws.cerrarForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);

  // deck.gl vuelve a crear la capa de nombres cada vez que se abre el editor
  const generacion = useRef(0);
  const editandoAntes = useRef(editando);
  if (editando && !editandoAntes.current) generacion.current += 1;
  editandoAntes.current = editando;

  // importando: los badges son los de lo importado, no los de lo guardado
  const conGeocercas = nombres.geocercas ?? true;
  const conTrayectos = nombres.trayectos ?? false;
  const nombresItems = useMemo(
    () =>
      ws.nombresImport ?? [
        ...(conGeocercas
          ? itemsNombresMapa(ws.fcPropios, ws.prevLugarFC, ws.todosLugares)
          : []),
        ...(conTrayectos ? itemsTrayectos(ws.fcTray) : []),
      ],
    [
      ws.nombresImport,
      ws.fcPropios,
      ws.prevLugarFC,
      ws.todosLugares,
      ws.fcTray,
      conGeocercas,
      conTrayectos,
    ]
  );

  const { irATrayecto, todosTrayectos } = ws;
  const alClicNombre = useCallback(
    (item: ItemNombre) => {
      // el de un trayecto: igual que elegirlo en la lista
      const trayecto = item.trayectoId
        ? todosTrayectos.find((t) => t.trayecto_id === item.trayectoId)
        : undefined;
      if (trayecto) {
        irATrayecto(trayecto);
        return;
      }
      mapRef.current?.flyTo({
        center: [item.ancla[1], item.ancla[0]],
        zoom: zoomAlClicNombre(item, zoom, nombresItems),
        duration: 800,
      });
    },
    [mapRef, zoom, nombresItems, irATrayecto, todosTrayectos]
  );

  const resaltadoAnim = useResaltadoAnimado(
    ws.importando ? ws.hoverImportUid : ws.hoveredPlaceId
  );
  // clic en un cluster de geocercas: acercar lo justo para que se separe
  const abrirCluster = useCallback(
    (centro: [number, number], z: number) =>
      mapRef.current?.flyTo({
        center: [centro[1], centro[0]],
        zoom: z,
        duration: 600,
      }),
    [mapRef]
  );

  const capaId = `place-names-${generacion.current}`;
  const capasNombres = useMemo(
    () =>
      capasNombresGeocercas(nombresItems, {
        layerId: capaId,
        mapStyle,
        zoom,
        onNombre: alClicNombre,
        onHoverNombre: ws.onHoverNombre,
        resaltadoAnim,
        onHoverBadge: ws.onHoverBadge,
        onAcercar: abrirCluster,
      }),
    [
      nombresItems,
      capaId,
      mapStyle,
      zoom,
      alClicNombre,
      ws.onHoverNombre,
      resaltadoAnim,
      ws.onHoverBadge,
      abrirCluster,
    ]
  );

  return {
    ws,
    capasNombres,
    /** Para el mapa: solo con el editor abierto los clics van a Lugares. */
    propsMapa: {
      onMapClick: editando ? ws.onMapClick : undefined,
      // el clic derecho abre los menús de crear o editar: solo con permiso
      onMapContextMenu:
        editando && puedeEditar ? ws.onMapContextMenu : undefined,
      idleCursor: editando && ws.clicAgrega ? CURSOR_AGREGAR : undefined,
    },
  };
}
