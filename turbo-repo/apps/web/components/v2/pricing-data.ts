// Precios públicos por vehículo/mes en USD, derivados de la calculadora del
// portafolio de costos (outputs/portafolio_costos_modular). Solo se publica el
// precio final — la estructura de costos y el margen quedan fuera de este repo.

export type CajaId = "ingesta" | "sintomas" | "integraciones" | "video";

export interface CajaPrecio {
  id: CajaId;
  nombre: string;
  descripcion: string;
  precioVehiculoMes: number; // USD por vehículo/mes
  requerida?: boolean; // ingesta es la base de todo
}

export const CAJAS: CajaPrecio[] = [
  {
    id: "ingesta",
    nombre: "Ingesta GPS Core",
    descripcion: "Pipeline de señales GPS y sensores en tiempo real. Base de la plataforma.",
    precioVehiculoMes: 5.81,
    requerida: true,
  },
  {
    id: "sintomas",
    nombre: "Síntomas / Torre de Control",
    descripcion: "Más de 30 reglas de detección con severidad, asignación y trazabilidad.",
    precioVehiculoMes: 5.13,
  },
  {
    id: "integraciones",
    nombre: "Integraciones",
    descripcion: "Workflows, webhooks, bóveda de evidencia y APIs hacia tus sistemas.",
    precioVehiculoMes: 5.48,
  },
  {
    id: "video",
    nombre: "Video en Vivo / HLS",
    descripcion: "Streaming continuo desde cámaras y dashcams, con contexto por evento.",
    precioVehiculoMes: 3.25,
  },
];

export const FLOTA_DEFAULT = 100;
export const FLOTA_MIN = 10;
export const FLOTA_MAX = 2000;
