export type GetEntityInfoResponse = {
  entity: string;
  source: string;
  ultimo_name: string | null;
  ultimo_fclass: string;
  ultimo_velavg: number;
  ultimo_clasreg: string;
  ultimo_trip_id: string;
  ultimo_duration_seg: string;
  ultimo_last_ptofinal: {
    type: string;
    coordinates: [number, number];
  };
  avg_delay_gps_mbl_det: string;
  avg_delay_gps_mbl_mov: string;
  avg_every_signals_det: string;
  avg_every_signals_mov: string;
  ultimo_last_timestamp: string;
  avg_signals_per_minute_det: number;
  avg_signals_per_minute_mov: number;
};
