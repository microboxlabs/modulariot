"use client";

// Edición del polígono sobre el mapa: vértices (arrastrar, clic = menú,
// clic derecho = menú), puntos medios de cada lado (clic o arrastre insertan
// un vértice), mover todo desde el centro y guía al cursor mientras se dibuja.
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  Layer,
  Marker,
  Popup,
  Source,
  useMap,
  type MarkerDragEvent,
} from "react-map-gl";
import type { FeatureCollection } from "geojson";
import { HiTrash } from "react-icons/hi";
import {
  MIN_VERTICES,
  eliminarVertice,
  insertarVertice,
  lados,
  marcarHistorial,
  moverVertice,
  puedeEliminar,
  puedeTerminar,
  puntoMedio,
  reemplazarVertices,
  terminar,
} from "./polygon-draw";
import {
  aLatLon,
  centroide,
  frenar,
  handleCentro,
  handleCierre,
  handleMedio,
  handleSeleccionado,
  handleVertice,
  type ClicMarker,
  TOLERANCIA_ARRASTRE,
} from "./map-handles";
import type { FormLugar, LatLon } from "./places.types";

/** Líneas guía del polígono en construcción, desde el último vértice al cursor. */
export function guiasPoligono(
  vertices: LatLon[],
  cursor: LatLon | null
): FeatureCollection {
  const last = vertices[vertices.length - 1];
  const first = vertices[0];
  if (!cursor || !last || !first)
    return { type: "FeatureCollection", features: [] };
  const lngLat = ([la, lo]: LatLon) => [lo, la];
  const linea = (a: LatLon, b: LatLon, cierre: boolean) => ({
    type: "Feature" as const,
    properties: { cierre },
    geometry: {
      type: "LineString" as const,
      coordinates: [lngLat(a), lngLat(b)],
    },
  });
  return {
    type: "FeatureCollection",
    features: [
      linea(last, cursor, false),
      // con 2+ vértices, cómo cerraría el polígono si se agrega este punto
      ...(vertices.length >= 2 ? [linea(cursor, first, true)] : []),
    ],
  };
}

/**
 * Sigue al mouse por su cuenta (estado local) para no re-renderizar toda la
 * página en cada mousemove.
 */
export function PolygonRubberBand({ vertices }: { vertices: LatLon[] }) {
  const { current: map } = useMap();
  const [cursor, setCursor] = useState<LatLon | null>(null);

  useEffect(() => {
    const m = map?.getMap();
    if (!m) return;
    const mover = (e: { lngLat: { lat: number; lng: number } }) =>
      setCursor([e.lngLat.lat, e.lngLat.lng]);
    const salir = () => setCursor(null);
    m.on("mousemove", mover);
    m.on("mouseout", salir);
    return () => {
      m.off("mousemove", mover);
      m.off("mouseout", salir);
    };
  }, [map]);

  return (
    <Source
      id="poly-guia"
      type="geojson"
      data={guiasPoligono(vertices, cursor)}
    >
      {/* último vértice → cursor: sólida */}
      <Layer
        id="poly-guia-l"
        type="line"
        filter={["!", ["get", "cierre"]]}
        paint={{ "line-color": "#1C64F2", "line-width": 2 }}
      />
      {/* cursor → primer vértice: punteada, cierre tentativo */}
      <Layer
        id="poly-guia-cierre"
        type="line"
        filter={["get", "cierre"]}
        paint={{
          "line-color": "#1C64F2",
          "line-width": 1.5,
          "line-opacity": 0.6,
          "line-dasharray": [2, 2],
        }}
      />
    </Source>
  );
}

type SetForm = Dispatch<SetStateAction<FormLugar>>;

function claseVertice(
  i: number,
  seleccionado: boolean,
  cerrable: boolean
): string {
  if (seleccionado) return handleSeleccionado;
  if (i === 0 && cerrable) return handleCierre;
  return handleVertice;
}

function tituloVertice(i: number, cerrable: boolean): string {
  if (i === 0 && cerrable) return "Clic para terminar · clic derecho: opciones";
  return "Arrastra para mover · clic para opciones";
}

function VertexPopup({
  punto,
  eliminable,
  onEliminar,
  onCerrar,
}: {
  punto: LatLon;
  eliminable: boolean;
  onEliminar: () => void;
  onCerrar: () => void;
}) {
  // Supr/Delete elimina el punto con el menú abierto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" || !eliminable) return;
      e.preventDefault();
      onEliminar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [eliminable, onEliminar]);

  return (
    <Popup
      longitude={punto[1]}
      latitude={punto[0]}
      anchor="bottom"
      offset={12}
      closeButton={false}
      closeOnClick
      onClose={onCerrar}
    >
      <button
        type="button"
        disabled={!eliminable}
        onClick={onEliminar}
        className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
      >
        <HiTrash className="h-3.5 w-3.5" />
        {eliminable ? "Eliminar punto" : `Mínimo ${MIN_VERTICES} puntos`}
      </button>
    </Popup>
  );
}

/** Handles de punto medio; mientras se arrastra uno, solo ese queda montado. */
function MidpointHandles({
  form,
  setForm,
  recienArrastrado,
}: {
  form: FormLugar;
  setForm: SetForm;
  recienArrastrado: RefObject<boolean>;
}) {
  // lado cuyo punto medio se está arrastrando y posición actual del cursor
  const [arrastre, setArrastre] = useState<{ lado: number; p: LatLon } | null>(
    null
  );

  const clic = (a: number, p: LatLon, e: ClicMarker) => {
    frenar(e);
    if (recienArrastrado.current) {
      recienArrastrado.current = false;
      return;
    }
    setForm((f) => insertarVertice(f, a + 1, p));
  };
  const empezar = (a: number, e: MarkerDragEvent) => {
    recienArrastrado.current = true;
    const p = aLatLon(e);
    setForm((f) => insertarVertice(f, a + 1, p));
    setArrastre({ lado: a, p });
  };
  const arrastrar = (a: number, e: MarkerDragEvent) => {
    const p = aLatLon(e);
    setForm((f) => moverVertice(f, a + 1, p));
    setArrastre({ lado: a, p });
  };

  const medios = arrastre
    ? [{ a: arrastre.lado, p: arrastre.p }]
    : lados(form).flatMap(([a, b]) => {
        const va = form.vertices[a];
        const vb = form.vertices[b];
        return va && vb ? [{ a, p: puntoMedio(va, vb) }] : [];
      });

  return (
    <>
      {medios.map(({ a, p }) => (
        <Marker
          key={`medio-${a}`}
          longitude={p[1]}
          latitude={p[0]}
          draggable
          clickTolerance={TOLERANCIA_ARRASTRE}
          onDragStart={(e) => empezar(a, e)}
          onDrag={(e) => arrastrar(a, e)}
          onDragEnd={() => setArrastre(null)}
          onClick={(e) => clic(a, p, e)}
        >
          <span
            className={handleMedio}
            title="Clic o arrastra para agregar un punto"
          />
        </Marker>
      ))}
    </>
  );
}

export default function PolygonHandles({
  form,
  setForm,
}: {
  form: FormLugar;
  setForm: SetForm;
}) {
  // posición de inicio del arrastre del polígono completo + vértices originales
  const inicio = useRef<{ desde: LatLon; vertices: LatLon[] } | null>(null);
  // el navegador dispara click al soltar un arrastre: ignorar ese click
  const recienArrastrado = useRef(false);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const cerrable = puedeTerminar(form);
  const sel =
    seleccionado != null && form.vertices[seleccionado] ? seleccionado : null;

  const clicVertice = (i: number, e: ClicMarker) => {
    frenar(e);
    if (recienArrastrado.current) {
      recienArrastrado.current = false;
      return;
    }
    if (i === 0 && cerrable) setForm(terminar);
    else setSeleccionado(i);
  };

  const menuContextual = (i: number, e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSeleccionado(i);
  };

  const eliminar = (i: number) => {
    setForm((f) => eliminarVertice(f, i));
    setSeleccionado(null);
  };

  const empezarArrastre = () => {
    recienArrastrado.current = true;
    setSeleccionado(null);
    setForm(marcarHistorial);
  };
  const arrastrarVertice = (i: number, e: MarkerDragEvent) => {
    const p = aLatLon(e);
    setForm((f) => moverVertice(f, i, p));
  };

  const empezarMover = (e: MarkerDragEvent) => {
    inicio.current = { desde: aLatLon(e), vertices: form.vertices };
    setForm(marcarHistorial);
  };
  const moverTodo = (e: MarkerDragEvent) => {
    const ini = inicio.current;
    if (!ini) return;
    const [la, lo] = aLatLon(e);
    const dLat = la - ini.desde[0];
    const dLon = lo - ini.desde[1];
    const vertices = ini.vertices.map(
      ([vLa, vLo]) => [vLa + dLat, vLo + dLon] as LatLon
    );
    setForm((f) => reemplazarVertices(f, vertices));
  };

  const centro = form.vertices.length >= 3 ? centroide(form.vertices) : null;

  return (
    <>
      {!form.cerrado && form.vertices.length > 0 && (
        <PolygonRubberBand vertices={form.vertices} />
      )}
      <MidpointHandles
        form={form}
        setForm={setForm}
        recienArrastrado={recienArrastrado}
      />
      {form.vertices.map((v, i) => (
        <Marker
          key={i}
          longitude={v[1]}
          latitude={v[0]}
          draggable
          clickTolerance={TOLERANCIA_ARRASTRE}
          onDragStart={empezarArrastre}
          onDrag={(e) => arrastrarVertice(i, e)}
          onClick={(e) => clicVertice(i, e)}
        >
          <span
            className={claseVertice(i, sel === i, cerrable)}
            title={tituloVertice(i, cerrable)}
            onContextMenu={(e) => menuContextual(i, e)}
          />
        </Marker>
      ))}
      {sel != null && form.vertices[sel] && (
        <VertexPopup
          punto={form.vertices[sel]}
          eliminable={puedeEliminar(form)}
          onEliminar={() => eliminar(sel)}
          onCerrar={() => setSeleccionado(null)}
        />
      )}
      {centro && (
        <Marker
          longitude={centro[1]}
          latitude={centro[0]}
          draggable
          clickTolerance={TOLERANCIA_ARRASTRE}
          onDragStart={empezarMover}
          onDrag={moverTodo}
          onDragEnd={() => (inicio.current = null)}
          onClick={frenar}
        >
          <span
            className={handleCentro}
            title="Arrastra para mover el polígono"
          />
        </Marker>
      )}
    </>
  );
}
