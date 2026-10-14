"use client";

import { type Dispatch, type SetStateAction } from "react";
import { Layer, Source } from "react-map-gl";
import {
  GeofenceHandles,
  INNER_RADIO_MAX,
  INNER_RADIO_MIN,
} from "./geofence-editor";
import RouteHandles from "./route-editor";
import {
  actualizarInner,
  innerComoForm,
  innerEnEdicion,
} from "./inner-geofences";
import { GEOJSON_EXACTO, type PlacesWorkspace } from "./use-places-workspace";
import type { FormLugar } from "./places.types";

function InnerGeofenceHandles({
  form,
  setForm,
}: {
  form: FormLugar;
  setForm: Dispatch<SetStateAction<FormLugar>>;
}) {
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

export default function PlacesMapLayers({ ws }: { ws: PlacesWorkspace }) {
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
            paint={{
              "fill-color": ["get", "color"],
              "fill-opacity": 0.12,
            }}
          />
          <Layer
            id="glob-line"
            type="line"
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
      </Source>
      <Source id="tray" type="geojson" tolerance={GEOJSON_EXACTO} data={fcTray}>
        <Layer
          id="tray-line"
          type="line"
          paint={{
            "line-color": "#7E3AF2",
            "line-width": 2.5,
            "line-opacity": 0.8,
          }}
        />
      </Source>
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
      </Source>
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
