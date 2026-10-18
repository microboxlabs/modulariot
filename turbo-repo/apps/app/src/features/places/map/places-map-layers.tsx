"use client";

import { type Dispatch, type SetStateAction } from "react";
import { Layer, Source } from "react-map-gl";
import type { ExpressionSpecification } from "mapbox-gl";
import {
  GeofenceHandles,
  INNER_RADIO_MAX,
  INNER_RADIO_MIN,
} from "../geofences/geofence-editor";
import RouteHandles from "../routes/route-editor";
import { FlechasRuta, useFlechaRuta } from "../routes/route-arrows";
import {
  actualizarInner,
  innerComoForm,
  innerEnEdicion,
} from "../geofences/inner-geofences";
import {
  GEOJSON_EXACTO,
  type PlacesWorkspace,
} from "../hooks/use-places-workspace";
import type { FormLugar } from "../places.types";

const COLOR_ESTADO_IMPORT: ExpressionSpecification = [
  "match",
  ["get", "estado"],
  "total",
  "#E02424",
  "parcial",
  "#F59E0B",
  "#1C64F2",
];

function InnerGeofenceHandles({
  form,
  setForm,
}: Readonly<{
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
}>) {
  const inner = innerEnEdicion(form);
  if (!inner) return null;
  return (
    <GeofenceHandles
      form={innerComoForm(inner)}
      setForm={(u) =>
        setForm((f) =>
          actualizarInner(f, inner.id, (cur) =>
            typeof u === "function" ? u(cur) : u
          )
        )
      }
      radioMin={INNER_RADIO_MIN}
      radioMax={INNER_RADIO_MAX}
    />
  );
}

/**
 * Vista general (con los camiones): las formas de las geocercas se dibujan
 * desde este zoom; más lejos solo se ven sus badges.
 */
export const ZOOM_FORMAS_VISTA_GENERAL = 13;

export default function PlacesMapLayers({
  ws,
  vistaGeneral = false,
  ocultar,
}: Readonly<{
  ws: PlacesWorkspace;
  /**
   * Vista general: solo geocercas (sin trayectos) y sus formas solo de
   * cerca (ZOOM_FORMAS_VISTA_GENERAL); los badges van aparte, siempre.
   */
  vistaGeneral?: boolean;
  /**
   * Capas apagadas desde la barra "Capas" del mapa. Lo que se está editando
   * o importando (vistas previas, conflictos) se sigue viendo.
   */
  ocultar?: { geocercas?: boolean; trayectos?: boolean };
}>) {
  // flechas de sentido de los trayectos: su imagen se registra en el mapa
  useFlechaRuta();
  const desdeZoom = vistaGeneral ? { minzoom: ZOOM_FORMAS_VISTA_GENERAL } : {};
  const formas = {
    ...desdeZoom,
    layout: { visibility: ocultar?.geocercas ? "none" : "visible" } as const,
  };
  const verTrayectos = !vistaGeneral && !ocultar?.trayectos;
  const {
    carrierMode,
    fcGlobales,
    fcPropios,
    fcTray,
    prevLugarFC,
    prevTrayRawFC,
    prevTrayAdjFC,
    hoveredPlaceId,
    modo,
    form,
    setForm,
    tray,
    setTray,
  } = ws;

  const hovered = hoveredPlaceId ?? "";

  return (
    <>
      {carrierMode && (
        <Source
          id="globales"
          type="geojson"
          tolerance={GEOJSON_EXACTO}
          data={fcGlobales}
        >
          <Layer
            id="glob-fill"
            type="fill"
            {...formas}
            paint={{
              "fill-color": ["get", "color"],
              "fill-opacity": 0.12,
            }}
          />
          <Layer
            id="glob-line"
            type="line"
            {...formas}
            paint={{
              "line-color": ["get", "color"],
              "line-width": 1,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
      )}
      <Source
        id="propios"
        type="geojson"
        tolerance={GEOJSON_EXACTO}
        data={fcPropios}
      >
        <Layer
          id="prop-fill"
          type="fill"
          {...formas}
          paint={{
            "fill-color": ["get", "color"],
            "fill-opacity": [
              "case",
              ["==", ["get", "place_id"], hovered],
              0.5,
              0.22,
            ],
          }}
        />
        <Layer
          id="prop-line"
          type="line"
          {...formas}
          paint={{
            "line-color": ["get", "color"],
            "line-width": [
              "case",
              ["==", ["get", "place_id"], hovered],
              3.5,
              1.5,
            ],
          }}
        />
        {/* importando: el lugar guardado con el que choca la fila en hover */}
        <Layer
          id="prop-conflicto"
          type="line"
          filter={["==", ["get", "place_id"], ws.hoverConflictoId ?? ""]}
          paint={{
            "line-color": "#FFFFFF",
            "line-width": 3,
            "line-dasharray": [2, 1.5],
          }}
        />
      </Source>
      {/* vista general: solo geocercas, sin trayectos */}
      {verTrayectos && (
        <Source
          id="tray"
          type="geojson"
          tolerance={GEOJSON_EXACTO}
          data={fcTray}
        >
          <Layer
            id="tray-line"
            type="line"
            paint={{
              // importando, cada trayecto en conflicto trae su propio color
              "line-color": ["coalesce", ["get", "color"], "#1C64F2"],
              "line-width": 2.5,
              "line-opacity": 0.8,
            }}
          />
          <FlechasRuta id="tray-flechas" />
          {/* importando: el trayecto guardado igual al de la fila en hover */}
          <Layer
            id="tray-conflicto"
            type="line"
            filter={["==", ["get", "trayecto_id"], ws.hoverConflictoId ?? ""]}
            paint={{
              "line-color": "#FFFFFF",
              "line-width": 4,
              "line-dasharray": [2, 1.5],
            }}
          />
        </Source>
      )}
      <Source
        id="prev-lugar"
        type="geojson"
        tolerance={GEOJSON_EXACTO}
        data={prevLugarFC}
      >
        <Layer
          id="prev-lugar-f"
          type="fill"
          filter={["==", ["get", "fill"], true]}
          paint={{
            "fill-color": ["coalesce", ["get", "color"], "#1C64F2"],
            "fill-opacity": ["case", ["get", "inner"], 0.38, 0.22],
          }}
        />
        <Layer
          id="prev-lugar-l"
          type="line"
          filter={["!", ["get", "inner"]]}
          paint={{
            "line-color": ["coalesce", ["get", "color"], "#1C64F2"],
            "line-width": 2,
          }}
        />
        <Layer
          id="prev-inner-l"
          type="line"
          filter={["get", "inner"]}
          paint={{
            "line-color": ["coalesce", ["get", "color"], "#1C64F2"],
            "line-width": 2,
            "line-dasharray": [2, 1.5],
          }}
        />
      </Source>
      <Source
        id="prev-tray-raw"
        type="geojson"
        tolerance={GEOJSON_EXACTO}
        data={prevTrayRawFC}
      >
        <Layer
          id="prev-tray-raw-l"
          type="line"
          paint={{
            "line-color": "#1C64F2",
            "line-width": 2,
            "line-dasharray": [2, 2],
          }}
        />
        <FlechasRuta id="prev-tray-raw-flechas" />
      </Source>
      <Source
        id="prev-tray-adj"
        type="geojson"
        tolerance={GEOJSON_EXACTO}
        data={prevTrayAdjFC}
      >
        <Layer
          id="prev-tray-adj-l"
          type="line"
          paint={{ "line-color": "#1C64F2", "line-width": 3 }}
        />
        <FlechasRuta id="prev-tray-adj-flechas" />
      </Source>
      {ws.importando && (
        <Source
          id="import"
          type="geojson"
          tolerance={GEOJSON_EXACTO}
          data={ws.fcImport}
        >
          {/* Gestor de conflictos: azul sin conflicto, ámbar parcial, rojo total */}
          <Layer
            id="import-fill"
            type="fill"
            // solo geocercas: un trayecto es una línea; sin este filtro Mapbox
            // cierra la línea y la rellena como si fuera un polígono
            filter={["==", ["geometry-type"], "Polygon"]}
            paint={{
              "fill-color": COLOR_ESTADO_IMPORT,
              "fill-opacity": [
                "case",
                ["==", ["get", "uid"], ws.hoverImportUid ?? ""],
                0.5,
                0.25,
              ],
            }}
          />
          {/* borde con el color propio de cada geocerca (ver coloresImport);
              el relleno de arriba indica el estado del conflicto */}
          <Layer
            id="import-line"
            type="line"
            paint={{
              "line-color": ["coalesce", ["get", "color"], "#1C64F2"],
              // un trayecto importado (línea) se ve más grueso que un contorno
              "line-width": [
                "case",
                ["==", ["geometry-type"], "LineString"],
                4,
                2,
              ],
            }}
          />
          {/* la fila con hover: borde blanco grueso encima de todo */}
          <Layer
            id="import-hover"
            type="line"
            filter={["==", ["get", "uid"], ws.hoverImportUid ?? ""]}
            paint={{ "line-color": "#FFFFFF", "line-width": 4 }}
          />
          {/* otra fila con la que choca: borde blanco punteado */}
          <Layer
            id="import-conflicto"
            type="line"
            filter={["==", ["get", "uid"], ws.hoverConflictoId ?? ""]}
            paint={{
              "line-color": "#FFFFFF",
              "line-width": 3,
              "line-dasharray": [2, 1.5],
            }}
          />
          {/* sentido de los trayectos importados (no de las geocercas) */}
          <FlechasRuta
            id="import-flechas"
            filter={["==", ["geometry-type"], "LineString"]}
          />
        </Source>
      )}
      {modo === "lugar" && ws.pasoLugar === "geocerca" && (
        <GeofenceHandles form={form} setForm={setForm} />
      )}
      {modo === "lugar" && ws.pasoLugar === "interiores" && (
        <InnerGeofenceHandles form={form} setForm={setForm} />
      )}
      {modo === "trayecto" && (
        <RouteHandles
          tray={tray}
          setTray={setTray}
          onEditar={ws.descartarRuta}
          onSoltar={ws.rotularPuntoSiSigue}
          editable={ws.pasoTrayecto === "recorrido"}
          resaltadoId={ws.hoverPuntoId}
          onHover={ws.setHoverPuntoId}
        />
      )}
    </>
  );
}
