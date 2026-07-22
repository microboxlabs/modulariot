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

// Mix de consecuencias — colores consistentes en todas las vistas
export const MIX_META: Record<string, { label: string; color: string }> = {
  atraso: { label: "Atraso ETA >1 h", color: "#F1B300" },
  carga: { label: "Carga incumplida", color: "#E11D48" },
  retrabajo: { label: "Retrabajo (regresión)", color: "#1C64F2" },
};

export type EntidadGxc = {
  id: string; viajes: number; v_exp: number; v_cons: number; v_exp_cons: number;
  c_atraso: number; c_retrabajo: number; c_carga: number; peso: number;
  tasa_cons: number | null; tasa_exp: number | null;
  tasa_cons_con_exp: number | null; tasa_cons_sin_exp: number | null;
  monitoreo_comprometido: boolean; rankeable: boolean;
  nivel: string | null; cuadrante: string;
  tasa_cons_prev: number | null; viajes_prev: number | null;
};

export type PoblacionGxc = {
  tipo: string;
  periodo: { dias: number; fin: number; composicion_equivalente: boolean };
  baseline: {
    tasa_consecuencia: number; tasa_exposicion: number;
    contraste: { con_exposicion: number | null; sin_exposicion: number | null };
    umbral_cons_alto: number; umbral_exp_alto: number; piso_viajes: number;
  } | null;
  entidades: EntidadGxc[];
  n: number; n_rankeables: number;
};

export type PerfilGxc = {
  tipo: string; id: string;
  periodo: { dias: number; fin: number; composicion_equivalente: boolean };
  ultimo_viaje: number | null;
  capitulos: {
    viajes: number; con_exposicion: number; con_consecuencia: number; exp_y_cons: number;
    mix: { atraso: number; retrabajo: number; carga: number };
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
    sintomas: { t: number; n: number; icu: number }[];
    consecuencias: { t: number; tipo: string; s: string; detalle: string }[];
    respuesta: { t: number; tipo: string; estado: string; quien: string; s: string }[];
  };
};

export const pct = (x: number | null | undefined) =>
  x == null ? "—" : `${Math.round(Number(x) * 100)}%`;

export const deltaTasa = (act: number | null, prev: number | null) =>
  act == null || prev == null ? null : Number(act) - Number(prev);
