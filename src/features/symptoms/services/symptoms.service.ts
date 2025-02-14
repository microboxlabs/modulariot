import { SymptomDashboard } from "../types/symptoms";

export class SymptomsService {
  static async getSymptomsDashboard(): Promise<SymptomDashboard> {
    const response = await fetch("/app/api/symptoms/dashboard");

    if (!response.ok) {
      throw new Error("Failed to fetch symptoms dashboard");
    }

    return response.json() as Promise<SymptomDashboard>;
  }
}
