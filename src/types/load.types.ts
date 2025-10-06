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
    Tipo_carga: string;
    "Numero de cargas": number;
  };
  icon?: string | null;
}
