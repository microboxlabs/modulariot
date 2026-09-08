// GxC v2 — modelo compartido de las tres vistas (N1 visor, N2 población,
// N3 perfil). Contrato: fn_dx_gol_gxc_poblacion / fn_dx_gol_gxc_perfil.
// Regla de la casa: el contraste con/sin exposición se muestra SIEMPRE y
// se lee como contraste observado, nunca como causalidad.

export const TIPOS_GXC = ["carrier", "camion", "conductor", "ruta"] as const;
export type TipoGxc = (typeof TIPOS_GXC)[number];

export const TIPO_META: Record<string, { label: string; singular: string }> = {
  carrier: { label: "Transportistas", singular: "transportista" },
  camion: { label: "Flota", singular: "camión" },
  conductor: { label: "Conductores", singular: "conductor" },
  ruta: { label: "Rutas", singular: "ruta" },
};

// Cuadrante operacional (población): señal (exposición) × resultado (consecuencia)
export const CUADRANTE_META: Record<string, { label: string; color: string; explica: string }> = {
  urgente: { label: "Urgente", color: "#E11D48",
    explica: "señal alta y consecuencia alta — intervenir ahora" },
  punto_ciego: { label: "Punto ciego", color: "#111928",
    explica: "consecuencia alta sin señal — faltan reglas de síntomas" },
  ruido: { label: "Ruido", color: "#F1B300",
    explica: "señal alta sin consecuencia — reglas sobre-sensibles" },
  monitoreo_roto: { label: "Monitoreo roto", color: "#7E3AF2",
    explica: "la señal dominante es de trazabilidad — arreglar el monitoreo antes de leer el resto" },
  sano: { label: "Sano", color: "#0E9F6E", explica: "dentro de la línea base" },
  muestra_insuficiente: { label: "Sin muestra", color: "#9CA3AF",
    explica: "menos viajes que el piso — no se clasifica" },
};

// Mix de consecuencias — MODELO v3 (responsabilidad en cascada, Erick
// 2026-07-22): cada población tiene SU consecuencia exigible y CADA
// CONSECUENCIA TIENE DUEÑO. Conductor responde por lo que pasa en ruta
// (conducción grave, atraso vs plan, cierre/POD tardío); el transportista
// es la consecuencia de sus recursos + señal/integración; el camión
// responde por equipo (trazabilidad); la carga al día es responsabilidad
// de operación (terminales Mintral) y solo se factura por ruta.
export const MIX_META: Record<string, {
  label: string; color: string;
  duenio: "conductor" | "transportista" | "camion" | "operacion";
  nota: string;
}> = {
  conduccion: { label: "Conducción grave", color: "#E11D48", duenio: "conductor",
    nota: "síntomas de conducción ICU≥3 en ruta — responsabilidad directa del conductor" },
  atraso: { label: "Atraso vs plan >1 h", color: "#F1B300", duenio: "conductor",
    nota: "llegada real contra la hora comprometida del plan (no el ETA beta)" },
  cierre: { label: "Cierre / POD tardío", color: "#7E3AF2", duenio: "conductor",
    nota: "más de 24 h entre fin de monitoreo y cierre: subir y validar el POD" },
  senal: { label: "Señal / integración", color: "#111928", duenio: "transportista",
    nota: "viaje sin ventana de monitoreo o señal cortada — estado de integración del transportista" },
  equipo: { label: "Equipo (trazabilidad)", color: "#1C64F2", duenio: "camion",
    nota: "síntomas de trazabilidad ICU≥3 — salud del equipo a bordo" },
  carga: { label: "Carga incumplida", color: "#0E9F6E", duenio: "operacion",
    nota: "compromiso de carga al día en terminal — responsabilidad de operación Mintral" },
};

// Dueño de cada consecuencia → cómo se presenta en badges y narrativa.
export const DUENIO_META: Record<string, { label: string; tono: "rojo" | "negro" | "azul" | "verde" }> = {
  conductor: { label: "responsabilidad del conductor", tono: "rojo" },
  transportista: { label: "responsabilidad del transportista", tono: "negro" },
  camion: { label: "equipo del camión", tono: "azul" },
  operacion: { label: "operación Mintral", tono: "verde" },
};

// Claves de mix por población (mismo orden que devuelve el backend en
// mix_claves — este mapa es solo el fallback si la respuesta no lo trae).
export const TIPO_MIX: Record<string, string[]> = {
  conductor: ["conduccion", "atraso", "cierre"],
  carrier: ["conduccion", "atraso", "cierre", "senal"],
  camion: ["equipo"],
  ruta: ["carga"],
};

export type EntidadGxc = {
  id: string; viajes: number; v_exp: number; v_cons: number; v_exp_cons: number;
  mix: Record<string, number>; peso: number;
  tasa_cons: number | null; tasa_exp: number | null;
  tasa_cons_con_exp: number | null; tasa_cons_sin_exp: number | null;
  monitoreo_comprometido: boolean; rankeable: boolean;
  nivel: string | null; cuadrante: string;
  tasa_cons_prev: number | null; viajes_prev: number | null;
};

export type PoblacionGxc = {
  tipo: string;
  periodo: { dias: number; fin: number; composicion_equivalente: boolean };
  baseline: BaselineGxc | null;
  /** población completa sin filtros — contraste cuando hay p_filtros */
  baseline_global?: BaselineGxc | null;
  filtros?: Record<string, string[]> | null;
  entidades: EntidadGxc[];
  n: number; n_rankeables: number;
};

export type BaselineGxc = {
  ambito?: "global" | "ajustado";
  tasa_consecuencia: number; tasa_exposicion: number;
  contraste: { con_exposicion: number | null; sin_exposicion: number | null };
  mix?: Record<string, number>; viajes?: number;
  umbral_cons_alto: number; umbral_exp_alto: number; piso_viajes: number;
};

export type PerfilGxc = {
  tipo: string; id: string;
  periodo: { dias: number; fin: number; composicion_equivalente: boolean };
  ultimo_viaje: number | null;
  mix_claves?: string[];
  capitulos: {
    viajes: number; con_exposicion: number; con_consecuencia: number; exp_y_cons: number;
    mix: Record<string, number>;
    contraste: { con_exposicion: number | null; sin_exposicion: number | null };
  } | null;
  respuesta: {
    total: number; expirados: number;
    por_responsable: { quien: string; n: number; expirados: number }[];
  };
  tendencia: { tasa_act: number | null; tasa_prev: number | null; viajes_prev: number | null } | null;
  cobertura_monitoreo: number | null;
  timeline: {
    // ini/fin = ventana de MONITOREO (fallback logística); ini_log/fin_log =
    // proceso logístico; mon = true si hubo ventana de monitoreo real
    viajes: { s: string; ini: number; fin: number; ini_log: number; fin_log: number;
              mon: boolean; ruta: string; camion: string; cons: boolean }[];
    sintomas: { t: number; n: number; icu: number; s: string }[];
    consecuencias: { t: number; tipo: string; s: string; detalle: string }[];
    respuesta: { t: number; tipo: string; estado: string; quien: string; s: string }[];
  };
};

export const pct = (x: number | null | undefined) =>
  x == null ? "—" : `${Math.round(Number(x) * 100)}%`;

export const deltaTasa = (act: number | null, prev: number | null) =>
  act == null || prev == null ? null : Number(act) - Number(prev);
