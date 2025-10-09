export interface LoadSearchResponse {
  expe_codigo_: number | null;
  viaj_codigo_: number | null;
  oferta_producto_: string | null;
  dele_codigo_ori_: string | null;
  nombre_etapa_: string;
  start_time__: string | null;
  end_time__: string | null;
  duration__: number | null;
  base_start_time_: string | null;
  estimated_start_time_: string | null;
  estimated_end_time_: string | null;
  extradata: {
    Tipo_carga?: string;
    "Numero de cargas"?: number;
    Proveedor?: string;
    Terminal?: string;
    Patente?: string;
    Conductor?: string;
    Estado?: string;
    Horario?: string;
    Validacion?: string;
    Origen?: string;
    Destino?: string;
    "Tiempo Estimado"?: string;
    ETA?: string;
  };
  icon?: string | null;
  visible: boolean;
  enabled: boolean;
}
