import { SymptomTableResponse } from "../types/symptoms";

interface GetTableParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export class SymptomsTableService {
  static async getTable({
    page = 1,
    pageSize = 10,
    search = "",
  }: GetTableParams = {}): Promise<SymptomTableResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: pageSize.toString(),
    });

    if (search) {
      params.set("search", search.trim());
    }

    const response = await fetch(`/app/api/symptoms/table?${params}`);

    if (!response.ok) {
      throw new Error("Failed to fetch symptoms table");
    }

    return response.json() as Promise<SymptomTableResponse>;
  }
}
