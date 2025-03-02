export interface SymptomsDashboardResponse {
  data: {
    [key: string]: number; // Allow any string as a key
  };
  status: number;
  message: string;
}

export interface SymptomsDashboard {
  critic: number;
  stable: number;
  codeBlack: number;
  remission: number;
  treatment: number;
  compromised: number;
  observation: number;
}
