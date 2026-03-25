export type GetEntityInfoResponse = {
  tipo_gps: string;
  estado: string;
  servicio: string;
  is_active: boolean;
  lng: number;
  dispositivo_gps: string;
  source: string;
  speed: number;
  nombre_oficial_gps: string;
  avg_signals_per_minute_mov: number | null;
  createdat: string;
  avg_signals_per_minute_det: number | null;
  ultimo_last_timestamp: string;
  codigo_servicio: string | null;
  tipo_servicio: string | null;
  entity: string;
  lat: number;
};
