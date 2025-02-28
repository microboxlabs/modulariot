export interface SymptomsDashboardResponse {
  data: SymptomsDashboard;
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
