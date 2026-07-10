export const ORGANIZATION_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "500+",
] as const;
export type OrganizationSize = (typeof ORGANIZATION_SIZES)[number];

export const INDUSTRIES = [
  "Operaciones",
  "Torre de control",
  "TI / Integraciones",
  "Gerencia",
  "Encargado de transporte",
  "Otro",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const MONITORING_INTERESTS = [
  "Flota / GPS",
  "Sensores IoT",
  "Datos de ERP",
  "Activos en terreno",
  "Otros",
] as const;
export type MonitoringInterest = (typeof MONITORING_INTERESTS)[number];
