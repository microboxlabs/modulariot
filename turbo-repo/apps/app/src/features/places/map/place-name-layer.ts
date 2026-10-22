import { IconLayer, type IconLayerProps } from "deck.gl";
import type { LayersList } from "@deck.gl/core";
import type { ItemNombre } from "./place-labels";
import { trazosDeIcono } from "./place-name-icons";
import {
  agruparSolapes,
  centroDeAnclas,
  empaquetarChips,
  zoomParaSeparar,
  type Pagina,
} from "./badge-layout";
import type { LatLon } from "../places.types";

// Badges de nombres de las geocercas sobre el mapa (deck.gl IconLayer).
//
// Las imágenes de los badges se dibujan aquí y se juntan en atlas propios,
// con su mapa de posiciones, de forma sincrónica. No se usa el empaquetado
// automático de deck.gl: carga cada imagen de forma asíncrona en una
// textura que solo crece y, con muchos badges, las posiciones y la textura
// se desfasan (textos cortados o el nombre de otro lugar).

export type TemaChip = "dia" | "noche";

const TEMAS: Record<TemaChip, { texto: string; fondo: string; borde: string }> =
  {
    dia: { texto: "#111827", fondo: "#ffffff", borde: "#E5E7EB" },
    noche: { texto: "#F9FAFB", fondo: "#1F2937", borde: "#374151" },
  };

/** Mapas oscuros → chip gray-800; mapas claros → chip blanco. */
export function temaChipMapa(style: string): TemaChip {
  if (style === "dark" || style === "satellite" || style === "hybrid") {
    return "noche";
  }
  return "dia";
}

const COLOR_ICONO_DEF = "#1C64F2";
/** Badge resaltado (hover en la lista): azul del sistema, borde blanco. */
const RESALTADO = { texto: "#FFFFFF", fondo: "#1C64F2", borde: "#FFFFFF" };
/** El badge resaltado se ve un poco más grande. */
const ESCALA_RESALTADO = 1.15;
const CHIP_H = 24;
const PAD_L = 4;
const ICON = 16;
const GAP = 4;
const PAD_R = 8;
const MAX_TEXT = 148;
/** Densidad 2×: nítido en retina con imágenes chicas. */
const DPR = 2;

/** Imagen de un badge, en píxeles de textura; `size` = alto en pantalla. */
export type Chip = {
  key: string;
  canvas: HTMLCanvasElement | null;
  width: number;
  height: number;
  size: number;
};

const chipCache = new Map<string, Chip>();

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function colorIcono(color: string): string {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(color)
    ? color
    : COLOR_ICONO_DEF;
}

/** Texto recortado con "…" si pasa del ancho máximo. */
function recortar(ctx: CanvasRenderingContext2D, nombre: string) {
  let text = nombre;
  let tw = ctx.measureText(text).width;
  if (tw > MAX_TEXT) {
    while (text.length > 1 && ctx.measureText(`${text}…`).width > MAX_TEXT) {
      text = text.slice(0, -1);
    }
    text = `${text}…`;
    tw = ctx.measureText(text).width;
  }
  return { text, tw };
}

/** Icono del lugar (trazos de 24×24) escalado a `tam` en (x, y). */
function dibujarIcono(
  ctx: CanvasRenderingContext2D,
  icono: string,
  color: string,
  x: number,
  y: number,
  tam: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(tam / 24, tam / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (typeof Path2D === "function") {
    for (const d of trazosDeIcono(icono)) ctx.stroke(new Path2D(d));
  }
  ctx.restore();
}

/** Canvas listo para dibujar en coordenadas de pantalla (w × h). */
function lienzo(w: number, h: number, ctx: CanvasRenderingContext2D) {
  const canvas = ctx.canvas;
  canvas.width = Math.round(w * DPR);
  canvas.height = Math.round(h * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

/** Sin canvas (p. ej. en pruebas) no se cachea: luego se dibuja de verdad. */
function chipSinCanvas(key: string, wCss: number, hCss: number): Chip {
  return {
    key,
    canvas: null,
    width: Math.round(wCss * DPR),
    height: Math.round(hCss * DPR),
    size: hCss,
  };
}

/** Identifica la imagen de un badge: mismo texto, color, icono y tema. */
export function claveChip(
  item: ItemNombre,
  tema: TemaChip = "noche",
  resaltado = false
): string {
  const fontSize = item.inner ? 12 : 13;
  return `${item.name}|${item.color}|${item.icon}|${fontSize}|${tema}|${resaltado}`;
}

/** Badge de un lugar según el estilo del mapa: día claro / noche gray-800. */
export function chipEtiqueta(
  item: ItemNombre,
  tema: TemaChip = "noche",
  resaltado = false
): Chip {
  const key = claveChip(item, tema, resaltado);
  const hit = chipCache.get(key);
  if (hit) return hit;

  const fontSize = item.inner ? 12 : 13;
  const font = `300 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return chipSinCanvas(key, PAD_L + ICON + GAP + PAD_R, CHIP_H);

  ctx.font = font;
  const { text, tw } = recortar(ctx, item.name);
  const w = Math.ceil(PAD_L + ICON + GAP + tw + PAD_R);
  const h = CHIP_H;
  lienzo(w, h, ctx);
  ctx.font = font;

  const paleta = resaltado ? RESALTADO : TEMAS[tema];
  // el resaltado lleva un borde blanco más grueso
  const borde = resaltado ? 2 : 1;
  roundRect(ctx, borde / 2, borde / 2, w - borde, h - borde, h / 2);
  ctx.fillStyle = paleta.fondo;
  ctx.fill();
  ctx.strokeStyle = paleta.borde;
  ctx.lineWidth = borde;
  ctx.stroke();

  const colorIco = resaltado ? RESALTADO.texto : colorIcono(item.color);
  dibujarIcono(ctx, item.icon, colorIco, PAD_L, (h - ICON) / 2, ICON);

  ctx.fillStyle = paleta.texto;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, PAD_L + ICON + GAP, h / 2 + 0.5);

  const chip: Chip = {
    key,
    canvas: ctx.canvas,
    width: ctx.canvas.width,
    height: ctx.canvas.height,
    size: h,
  };
  chipCache.set(key, chip);
  return chip;
}

/** Cuántas geocercas y cuántos trayectos junta un cluster. */
export type ConteoCluster = { geocercas: number; trayectos: number };

export function contarCluster(miembros: ItemNombre[]): ConteoCluster {
  const trayectos = miembros.filter((m) => m.trayectoId).length;
  return { geocercas: miembros.length - trayectos, trayectos };
}

export const claveCluster = (c: ConteoCluster, tema: TemaChip) =>
  `cluster|${c.geocercas}|${c.trayectos}|${tema}`;

const plural = (n: number, uno: string, varios: string) =>
  `${n} ${n === 1 ? uno : varios}`;

/** Cada tipo del cluster con su icono: "2 geocercas", "1 trayecto". */
export function partesCluster(
  c: ConteoCluster
): { icono: string; texto: string }[] {
  const partes: { icono: string; texto: string }[] = [];
  if (c.geocercas > 0)
    partes.push({
      icono: "pin",
      texto: plural(c.geocercas, "geocerca", "geocercas"),
    });
  if (c.trayectos > 0)
    partes.push({
      icono: "ruta",
      texto: plural(c.trayectos, "trayecto", "trayectos"),
    });
  return partes;
}

/** Texto del cluster en una línea (pruebas, lectores): "2 geocercas · 1 trayecto". */
export const textoCluster = (c: ConteoCluster) =>
  partesCluster(c)
    .map((p) => p.texto)
    .join(" · ");

/** Alto de cada fila del cluster cuando junta geocercas y trayectos. */
const FILA_CLUSTER = 18;
/** Margen arriba y abajo del cluster de varias filas. */
const PAD_V = 3;

/** Alto del cluster: el de un badge con una fila; si no, una por tipo. */
export function altoCluster(filas: number): number {
  return filas <= 1 ? CHIP_H : PAD_V * 2 + filas * FILA_CLUSTER;
}

/**
 * Cluster: lugares que se pisarían, como un badge con cuántos son de cada
 * tipo, en columna: una fila por tipo, cada una con su icono.
 */
export function chipCluster(c: ConteoCluster, tema: TemaChip = "noche"): Chip {
  const key = claveCluster(c, tema);
  const hit = chipCache.get(key);
  if (hit) return hit;

  const font = `500 12px ui-sans-serif, system-ui, sans-serif`;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx)
    return chipSinCanvas(key, PAD_R * 2, altoCluster(partesCluster(c).length));

  ctx.font = font;
  const partes = partesCluster(c);
  const anchoTexto = Math.max(
    ...partes.map((p) => ctx.measureText(p.texto).width)
  );
  const w = Math.ceil(PAD_L + ICON + GAP + anchoTexto + PAD_R);
  const h = altoCluster(partes.length);
  // con una fila, el alto completo; con varias, cada fila centrada en la suya
  const fila = partes.length > 1 ? FILA_CLUSTER : h;
  const arriba = partes.length > 1 ? PAD_V : 0;
  lienzo(w, h, ctx);
  ctx.font = font;

  const paleta = TEMAS[tema];
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, Math.min(h, CHIP_H) / 2);
  ctx.fillStyle = paleta.fondo;
  ctx.fill();
  ctx.strokeStyle = paleta.borde;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  ctx.fillStyle = paleta.texto;
  partes.forEach((parte, i) => {
    const medio = arriba + i * fila + fila / 2;
    dibujarIcono(
      ctx,
      parte.icono,
      COLOR_ICONO_DEF,
      PAD_L,
      medio - ICON / 2,
      ICON
    );
    ctx.fillText(parte.texto, PAD_L + ICON + GAP, medio + 0.5);
  });

  const chip: Chip = {
    key,
    canvas: ctx.canvas,
    width: ctx.canvas.width,
    height: ctx.canvas.height,
    size: h,
  };
  chipCache.set(key, chip);
  return chip;
}

/** Un badge del mapa: un lugar, o un cluster de varios (geocercas, trayectos). */
export type BadgeMapa = { item: ItemNombre; miembros: ItemNombre[] };

const esCluster = (b: BadgeMapa) => b.miembros.length > 1;

function chipDe(b: BadgeMapa, tema: TemaChip): Chip {
  return esCluster(b)
    ? chipCluster(contarCluster(b.miembros), tema)
    : chipEtiqueta(b.item, tema);
}

/** Ancho y alto del badge en pantalla (el ancho sale de la imagen). */
function medidaChip(item: ItemNombre, tema: TemaChip) {
  const chip = chipEtiqueta(item, tema);
  return {
    w: (chip.width / chip.height) * chip.size,
    h: chip.size,
    dy: dyBadge(item),
  };
}

/** Padres antes que interiores; entre iguales, el lugar más grande. */
const prioridadChip = (item: ItemNombre) =>
  (item.inner ? 0 : 1e9) + (item.radio_m ?? 0);

/** Sobre el ancla, como el badge de un lugar padre. */
/** Badge de un padre sobre el ancla; interior, en ella; "abajo", debajo. */
function dyBadge(item: ItemNombre): number {
  if (item.abajo) return 22;
  return item.inner ? 0 : -18;
}

function offsetBadge(b: BadgeMapa): [number, number] {
  if (esCluster(b)) {
    // más alto en columna: crece hacia afuera, el borde cercano no se mueve
    const filas = partesCluster(contarCluster(b.miembros)).length;
    const extra = (altoCluster(filas) - CHIP_H) / 2;
    return [0, b.item.abajo ? 22 + extra : -18 - extra];
  }
  return [0, dyBadge(b.item)];
}

type EntradaAtlas = {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  mask: false;
};
type Atlas = {
  canvas: HTMLCanvasElement;
  mapping: Record<string, EntradaAtlas>;
};

/** Últimos atlas dibujados: el mismo conjunto de badges no se redibuja. */
const atlasCache = new Map<string, Atlas>();
const MAX_ATLAS_CACHE = 12;

function dibujarAtlas(pagina: Pagina, chips: Map<string, Chip>): Atlas {
  const firma = Object.keys(pagina.posiciones)
    .sort((a, b) => a.localeCompare(b))
    .join("\u0000");
  const hit = atlasCache.get(firma);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = pagina.ancho;
  canvas.height = pagina.alto;
  const ctx = canvas.getContext("2d");
  const mapping: Record<string, EntradaAtlas> = {};
  for (const [key, p] of Object.entries(pagina.posiciones)) {
    const chip = chips.get(key);
    if (chip?.canvas) ctx?.drawImage(chip.canvas, p.x, p.y);
    mapping[key] = {
      ...p,
      anchorX: p.width / 2,
      anchorY: p.height / 2,
      mask: false,
    };
  }
  const atlas = { canvas, mapping };
  atlasCache.set(firma, atlas);
  if (atlasCache.size > MAX_ATLAS_CACHE) {
    const masViejo = atlasCache.keys().next().value;
    if (masViejo !== undefined) atlasCache.delete(masViejo);
  }
  return atlas;
}

/** Atlas con sus badges: cada página va en su propia capa. */
function paginasDeBadges(badges: BadgeMapa[], tema: TemaChip) {
  const chips = new Map<string, Chip>();
  for (const b of badges) {
    const chip = chipDe(b, tema);
    chips.set(chip.key, chip);
  }
  return empaquetarChips([...chips.values()]).map((pagina) => ({
    atlas: dibujarAtlas(pagina, chips),
    badges: badges.filter((b) => chipDe(b, tema).key in pagina.posiciones),
  }));
}

/**
 * deck.gl sube a una textura cualquier imagen del navegador (también un
 * canvas) que reciba en `iconAtlas`, aunque su tipo solo declare
 * string | Texture. Pasar el canvas evita convertirlo a URL y cargarlo de
 * nuevo de forma asíncrona.
 */
const atlasDeck = (canvas: HTMLCanvasElement) =>
  canvas as unknown as IconLayerProps["iconAtlas"];

const PROPS_COMUNES = {
  pickable: true,
  billboard: true,
  sizeUnits: "pixels" as const,
  textureParameters: {
    minFilter: "linear" as const,
    magFilter: "linear" as const,
  },
  parameters: { depthCompare: "always" as const },
};

/** Sin lugar resaltado desde la lista. */
const SIN_RESALTADO: { id: string | null; t: number } = { id: null, t: 0 };

export type OpcionesNombres = {
  /** Cambia al reabrir Lugares (deck.gl vuelve a crear la capa). */
  layerId?: string;
  mapStyle?: string;
  zoom?: number;
  onNombre?: (item: ItemNombre) => void;
  /** Badge bajo el mouse (null al salir): el clic derecho abre su menú. */
  onHoverNombre?: (item: ItemNombre | null) => void;
  /**
   * Lugar con hover en la lista y avance de su animación (0 → 1): el badge
   * resaltado aparece encima del normal, creciendo y con fundido.
   */
  resaltadoAnim?: { id: string | null; t: number };
  /** Badge (o cluster) bajo el mouse y dónde, para su tooltip; null al salir. */
  onHoverBadge?: (
    badge: BadgeMapa | null,
    pos: { x: number; y: number }
  ) => void;
  /**
   * Clic en un cluster: acercar solo lo justo para que se abra (no ir a una
   * de sus geocercas). Recibe el centro de sus miembros y ese zoom.
   */
  onAcercar?: (centro: LatLon, zoom: number) => void;
};

/**
 * Badges de nombres (icono dentro). Los que quedarían juntos se muestran en
 * un cluster "N geocercas"; más una capa para el resaltado.
 */
export function capasNombresGeocercas(
  items: ItemNombre[],
  {
    layerId = "place-names",
    mapStyle = "dark",
    zoom = 22,
    onNombre,
    onHoverNombre,
    resaltadoAnim = SIN_RESALTADO,
    onHoverBadge,
    onAcercar,
  }: OpcionesNombres = {}
): LayersList {
  const tema = temaChipMapa(mapStyle);
  const separar = (miembros: ItemNombre[]) =>
    onAcercar?.(
      centroDeAnclas(miembros),
      zoomParaSeparar(miembros, zoom, (d) => medidaChip(d, tema), prioridadChip)
    );
  // los que se pisarían, juntos en un cluster que dice cuántos son
  const badges: BadgeMapa[] = agruparSolapes(
    items,
    zoom,
    (d) => medidaChip(d, tema),
    prioridadChip
  ).map((miembros) => ({ item: miembros[0]!, miembros }));

  const capas: LayersList = paginasDeBadges(badges, tema).map(
    ({ atlas, badges: data }, i) =>
      new IconLayer<BadgeMapa>({
        ...PROPS_COMUNES,
        id: `${layerId}-${i}`,
        data,
        iconAtlas: atlasDeck(atlas.canvas),
        iconMapping: atlas.mapping,
        getIcon: (b) => chipDe(b, tema).key,
        getPosition: (b) => [b.item.ancla[1], b.item.ancla[0]],
        getSize: (b) => chipDe(b, tema).size,
        getPixelOffset: (b) => offsetBadge(b),
        // clic en un cluster: se acerca hasta que se abre; en un lugar, va a él
        onClick: ({ object }) => {
          if (!object) return;
          if (esCluster(object) && onAcercar) separar(object.miembros);
          else onNombre?.(object.item);
        },
        // un cluster no abre el menú de un lugar: no se sabe cuál
        onHover: ({ object, x, y }) => {
          onHoverNombre?.(object && !esCluster(object) ? object.item : null);
          onHoverBadge?.(object ?? null, { x, y });
        },
        updateTriggers: {
          getIcon: [data, tema],
          getPosition: data,
          getSize: data,
          getPixelOffset: data,
        },
      })
  );

  // el resaltado, encima de todo (aunque su nombre esté en un cluster)
  const { id: resaltadoId, t } = resaltadoAnim;
  const resaltado =
    resaltadoId && t > 0 ? items.find((i) => i.id === resaltadoId) : undefined;
  if (resaltado) {
    const chip = chipEtiqueta(resaltado, tema, true);
    const [pagina] = empaquetarChips([chip]);
    const atlas = pagina
      ? dibujarAtlas(pagina, new Map([[chip.key, chip]]))
      : null;
    if (atlas) {
      capas.push(
        new IconLayer<ItemNombre>({
          ...PROPS_COMUNES,
          id: `${layerId}-resaltado`,
          data: [resaltado],
          iconAtlas: atlasDeck(atlas.canvas),
          iconMapping: atlas.mapping,
          getIcon: () => chip.key,
          getPosition: (d) => [d.ancla[1], d.ancla[0]],
          // crece desde el tamaño normal mientras se funde
          getSize: () => chip.size * (1 + (ESCALA_RESALTADO - 1) * t),
          opacity: t,
          getPixelOffset: (d) => [0, dyBadge(d)],
          onClick: ({ object }) => {
            if (object) onNombre?.(object);
          },
          onHover: ({ object, x, y }) => {
            onHoverNombre?.(object ?? null);
            onHoverBadge?.(
              object ? { item: object, miembros: [object] } : null,
              {
                x,
                y,
              }
            );
          },
          updateTriggers: { getIcon: [resaltado, tema], getSize: t },
        })
      );
    }
  }
  return capas;
}
