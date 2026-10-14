import { IconLayer } from "deck.gl";
import type { LayersList } from "@deck.gl/core";
import type { MapStyleName } from "@/features/map-visualization/map-visualization";
import type { ItemNombre } from "./place-labels";
import { nombresVisiblesEnZoom } from "./geofence-lod";
import { trazosDeIcono } from "./place-name-icons";

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
const CHIP_H = 24;
const PAD_L = 4;
const ICON = 16;
const GAP = 4;
const PAD_R = 8;
const MAX_TEXT = 148;

type ChipIcon = {
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  mask: false;
  /** Altura en pantalla; el PNG va a `width`/`height` en píxeles de textura. */
  size: number;
};

function pixelRatio(): number {
  const raw = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return Math.max(2, Math.min(3, Math.round(raw) || 2));
}

const chipCache = new Map<string, ChipIcon>();

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

/** Badge según el estilo del mapa: día claro / noche gray-800. */
export function chipEtiqueta(
  item: ItemNombre,
  tema: TemaChip = "noche"
): ChipIcon {
  const fontSize = item.inner ? 12 : 13;
  const dpr = pixelRatio();
  const paleta = TEMAS[tema];
  const key = `${item.name}|${item.color}|${item.icon}|${fontSize}|${dpr}|${tema}`;
  const hit = chipCache.get(key);
  if (hit) return hit;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const empty: ChipIcon = {
      url: "",
      width: 1,
      height: 1,
      anchorX: 0.5,
      anchorY: 0.5,
      mask: false,
      size: CHIP_H,
    };
    chipCache.set(key, empty);
    return empty;
  }

  const font = `300 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.font = font;
  let text = item.name;
  let tw = ctx.measureText(text).width;
  if (tw > MAX_TEXT) {
    while (text.length > 1 && ctx.measureText(`${text}…`).width > MAX_TEXT) {
      text = text.slice(0, -1);
    }
    text = `${text}…`;
    tw = ctx.measureText(text).width;
  }

  const w = Math.ceil(PAD_L + ICON + GAP + tw + PAD_R);
  const h = CHIP_H;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.font = font;

  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, h / 2);
  ctx.fillStyle = paleta.fondo;
  ctx.fill();
  ctx.strokeStyle = paleta.borde;
  ctx.lineWidth = 1;
  ctx.stroke();

  const iconY = (h - ICON) / 2;
  ctx.save();
  ctx.translate(PAD_L, iconY);
  ctx.scale(ICON / 24, ICON / 24);
  ctx.strokeStyle = colorIcono(item.color);
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (typeof Path2D === "function") {
    for (const d of trazosDeIcono(item.icon)) {
      ctx.stroke(new Path2D(d));
    }
  }
  ctx.restore();

  ctx.fillStyle = paleta.texto;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, PAD_L + ICON + GAP, h / 2 + 0.5);

  const texW = canvas.width;
  const texH = canvas.height;
  const icon: ChipIcon = {
    url: canvas.toDataURL("image/png"),
    width: texW,
    height: texH,
    anchorX: texW / 2,
    anchorY: texH / 2,
    mask: false,
    size: h,
  };
  chipCache.set(key, icon);
  return icon;
}

/** Un solo IconLayer: el badge entero (icono dentro). `layerId` cambia al reabrir. */
export function capasNombresGeocercas(
  items: ItemNombre[],
  layerId = "place-names",
  mapStyle: MapStyleName | string = "dark",
  zoom = 22,
  onNombre?: (item: ItemNombre) => void
): LayersList {
  const tema = temaChipMapa(mapStyle);
  const visibles = nombresVisiblesEnZoom(items, zoom);
  return [
    new IconLayer<ItemNombre>({
      id: layerId,
      data: visibles,
      pickable: true,
      billboard: true,
      getPosition: (d) => [d.ancla[1], d.ancla[0]],
      getIcon: (d) => chipEtiqueta(d, tema),
      getSize: (d) => chipEtiqueta(d, tema).size,
      getPixelOffset: (d) => (d.inner ? [0, 0] : [0, -18]),
      sizeUnits: "pixels",
      textureParameters: {
        minFilter: "linear",
        magFilter: "linear",
      },
      parameters: { depthTest: false },
      onClick: ({ object }) => {
        if (object) onNombre?.(object);
      },
      updateTriggers: {
        getIcon: [visibles, tema],
        getPosition: visibles,
        getSize: visibles,
        getPixelOffset: visibles,
      },
    }),
  ];
}
