import { TableItemType } from "../components/table-item.type";

export interface SymptomDashboard {
  codeBlack: number;
  critic: number;
  treatment: number;
  observation: number;
  stable: number;
  compromised: number;
  remission: number;
}

/* export interface SymptomTableItem {
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
} */

export interface SymptomTableResponse {
  data: TableItemType[];
  pagination: SymptomTablePagination;
  symptoms_list: string[];
}

export interface SymptomTablePagination {
  total_rows: number;
  total_pages: number;
  currentPage: number;
  page_size: number;
}
