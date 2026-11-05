"use client";

// Edición del recorrido sobre el mapa: los puntos (A, paradas, B) se
// arrastran y, mientras no se confirma, un handle que sigue al mouse sobre la
// línea inserta una parada con clic o arrastre.
import { twMerge } from "tailwind-merge";
import { SimboloDesvio, SimboloParada } from "./point-symbol";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { Marker, useMap, type MarkerDragEvent } from "react-map-gl";
import {
  TOLERANCIA_ARRASTRE,
  aLatLon,
  frenar,
  type ClicMarker,
} from "../map/map-handles";
import type { FormTrayecto, LatLon } from "../places.types";
import {
  MAX_PUNTOS,
  distintivos,
  type Distintivo,
  insertarParada,
  marcarHistorialRecorrido,
  moverPunto,
  nuevoPunto,
  puntoSobreLinea,
  textoDesdeCoords,
  tramosRecorrido,
} from "./recorrido";

type SetTray = Dispatch<SetStateAction<FormTrayecto>>;

// el que sigue al mouse se ve más firme que los puntos medios de pista
const handleParada = (key: string) =>
  twMerge(
    "block h-2.5 w-2.5 cursor-pointer rounded-full border-2 border-blue-600 bg-white/80 shadow-sm opacity-70 transition-transform hover:scale-125 hover:opacity-100 active:cursor-grabbing",
    !key.startsWith("tramo-") && "h-3 w-3 bg-white opacity-100"
  );

type Acciones = {
  setTray: SetTray;
  /** La geometría cambió: descartar la ruta calculada. */
  onEditar: () => void;
  /** Un punto quedó en su lugar: rotularlo con su dirección. */
  onSoltar: (id: string, punto: LatLon) => void;
};

type Arrastre = { key: string; id: string; p: LatLon };

/**
 * Sigue al mouse sobre la línea del borrador: el punto de la línea más
 * cercano al cursor, o `null` lejos de ella. Estado local para no
 * re-renderizar la página en cada mousemove (como PolygonRubberBand).
 */
function useFantasmaEnLinea(
  tray: FormTrayecto,
  pausado: boolean
): { indice: number; p: LatLon } | null {
  const { current: map } = useMap();
  const [fantasma, setFantasma] = useState<{
    indice: number;
    p: LatLon;
  } | null>(null);
  // el handler lee siempre el recorrido y la pausa actuales
  const estado = useRef({ tray, pausado });
  estado.current = { tray, pausado };

  useEffect(() => {
    const m = map?.getMap();
    if (!m) return;
    const px = ([la, lo]: LatLon): [number, number] => {
      const q = m.project([lo, la]);
      return [q.x, q.y];
    };
    const mover = (e: { point: { x: number; y: number } }) => {
      if (estado.current.pausado) return;
      const tramos = tramosRecorrido(estado.current.tray).map((x) => ({
        indice: x.indice,
        a: px(x.desde),
        b: px(x.hasta),
      }));
      const r = puntoSobreLinea([e.point.x, e.point.y], tramos);
      if (!r) {
        setFantasma(null);
        return;
      }
      const ll = m.unproject(r.punto);
      setFantasma({ indice: r.indice, p: [ll.lat, ll.lng] });
    };
    const salir = () => setFantasma(null);
    m.on("mousemove", mover);
    m.on("mouseout", salir);
    return () => {
      m.off("mousemove", mover);
      m.off("mouseout", salir);
    };
  }, [map]);

  return pausado ? null : fantasma;
}

/**
 * Agregar paradas en la línea: un handle sigue al mouse sobre el tramo más
 * cercano (clic = parada ahí; presionar y arrastrar = parada y moverla). Lejos
 * de la línea quedan los puntos medios como pista. Mientras se arrastra, solo
 * ese handle queda montado y con la misma key, para no cortar el arrastre.
 */
function TramoHandles({
  tray,
  setTray,
  onEditar,
  onSoltar,
  recienArrastrado,
}: Readonly<
  Acciones & { tray: FormTrayecto; recienArrastrado: RefObject<boolean> }
>) {
  // parada recién insertada que se está arrastrando
  const [arrastre, setArrastre] = useState<Arrastre | null>(null);
  const lleno = tray.recorrido.length >= MAX_PUNTOS;
  const fantasma = useFantasmaEnLinea(tray, !!arrastre || lleno);

  const insertar = (indice: number, p: LatLon) => {
    const parada = { ...nuevoPunto(), punto: p, texto: textoDesdeCoords(p) };
    setTray((t) => insertarParada(t, indice, parada));
    onEditar();
    return parada.id;
  };

  const clic = (indice: number, p: LatLon, e: ClicMarker) => {
    frenar(e);
    if (recienArrastrado.current) {
      recienArrastrado.current = false;
      return;
    }
    onSoltar(insertar(indice, p), p);
  };
  const empezar = (key: string, indice: number, e: MarkerDragEvent) => {
    recienArrastrado.current = true;
    const p = aLatLon(e);
    setArrastre({ key, id: insertar(indice, p), p });
  };
  const arrastrar = (e: MarkerDragEvent) => {
    if (!arrastre) return;
    const p = aLatLon(e);
    setTray((t) => moverPunto(t, arrastre.id, p));
    setArrastre({ ...arrastre, p });
  };
  const soltar = () => {
    if (arrastre) onSoltar(arrastre.id, arrastre.p);
    setArrastre(null);
  };

  if (!arrastre && lleno) return null;
  const handles = (() => {
    if (arrastre) return [{ key: arrastre.key, indice: -1, p: arrastre.p }];
    if (fantasma)
      return [{ key: "fantasma", indice: fantasma.indice, p: fantasma.p }];
    return tramosRecorrido(tray).map((x) => ({
      key: `tramo-${x.indice}`,
      indice: x.indice,
      p: x.medio,
    }));
  })();

  return (
    <>
      {handles.map(({ key, indice, p }) => (
        <Marker
          key={key}
          longitude={p[1]}
          latitude={p[0]}
          draggable
          clickTolerance={TOLERANCIA_ARRASTRE}
          onDragStart={(e) => empezar(key, indice, e)}
          onDrag={arrastrar}
          onDragEnd={soltar}
          onClick={(e) => clic(indice, p, e)}
        >
          <span
            className={handleParada(key)}
            title="Clic o arrastra para agregar una parada"
          />
        </Marker>
      ))}
    </>
  );
}

function sinHover() {
  // sin resaltado: quien usa los puntos no sigue el hover
}

/** A y B: círculo con su letra; parada: el "PARE"; desvío: círculo hueco. */
function MarcaPunto({
  distintivo,
  resaltado,
}: Readonly<{
  distintivo: Distintivo;
  resaltado: boolean;
}>) {
  const anillo = resaltado && "ring-4 ring-blue-400/60";
  if (distintivo.rol === "parada") {
    return (
      <SimboloParada numero={distintivo.letra} className={twMerge(anillo)} />
    );
  }
  if (distintivo.rol === "desvio") {
    return <SimboloDesvio className={twMerge(anillo)} />;
  }
  return (
    <span
      className={twMerge(
        "flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow",
        anillo,
        distintivo.colorCls
      )}
    >
      {distintivo.letra}
    </span>
  );
}

const tituloMarca = (label: string, editable: boolean) =>
  editable ? `${label} · arrastra para mover` : label;

/**
 * Puntos del recorrido con el mismo distintivo que la lista. Editables:
 * arrastrables y con paradas en los tramos; si no, solo se muestran.
 */
export default function RouteHandles({
  tray,
  setTray,
  onEditar,
  onSoltar,
  editable = true,
  resaltadoId = null,
  onHover = sinHover,
}: Readonly<
  Acciones & {
    tray: FormTrayecto;
    editable?: boolean;
    /** Punto resaltado (hover en la lista o en el mapa). */
    resaltadoId?: string | null;
    onHover?: (id: string | null) => void;
  }
>) {
  // el navegador dispara click al soltar un arrastre: ignorar ese click
  const recienArrastrado = useRef(false);
  const ds = distintivos(tray.recorrido);

  const empezarArrastre = () => {
    setTray(marcarHistorialRecorrido);
    onEditar();
  };
  const arrastrar = (id: string, e: MarkerDragEvent) => {
    const p = aLatLon(e);
    setTray((t) => moverPunto(t, id, p));
  };

  return (
    <>
      {editable && !tray.confirmado && (
        <TramoHandles
          tray={tray}
          setTray={setTray}
          onEditar={onEditar}
          onSoltar={onSoltar}
          recienArrastrado={recienArrastrado}
        />
      )}
      {tray.recorrido.map((p, i) => {
        if (!p.punto) return null;
        const distintivo = ds[i]!;
        const resaltado = p.id === resaltadoId;
        return (
          <Marker
            key={p.id}
            longitude={p.punto[1]}
            latitude={p.punto[0]}
            anchor="center"
            draggable={editable}
            style={resaltado ? { zIndex: 1 } : undefined}
            clickTolerance={TOLERANCIA_ARRASTRE}
            onDragStart={empezarArrastre}
            onDrag={(e) => arrastrar(p.id, e)}
            onDragEnd={(e) => onSoltar(p.id, aLatLon(e))}
            onClick={frenar}
          >
            <span
              className={twMerge(
                "block transition-transform",
                editable &&
                  "cursor-grab hover:scale-110 active:cursor-grabbing",
                resaltado && "scale-125"
              )}
              title={tituloMarca(distintivo.label, editable)}
              onMouseEnter={() => onHover(p.id)}
              onMouseLeave={() => onHover(null)}
            >
              <MarcaPunto distintivo={distintivo} resaltado={resaltado} />
            </span>
          </Marker>
        );
      })}
    </>
  );
}
