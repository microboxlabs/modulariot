export interface SymptomDashboard {
  codeBlack: number;
  critic: number;
  treatment: number;
  observation: number;
  stable: number;
  compromised: number;
  remission: number;
}

export interface SymptomTableItem {
  id: number;
  condition: string;
  licensePlate: string;
  time: string;
  trip: string;
  driver: string;
  date: string;
  service: string;
  alertType: string;
  status: string;
}

export interface SymptomTableResponse {
  data: SymptomTableItem[];
  total: number;
  page: number;
  pageSize: number;
  pagination: SymptomTablePagination;
}

export interface SymptomTablePagination {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
}
