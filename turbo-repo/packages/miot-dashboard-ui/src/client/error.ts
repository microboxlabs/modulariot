export class DashboardApiError extends Error {
  constructor(readonly status: number) {
    super(`Dashboard request failed (${status})`);
    this.name = "DashboardApiError";
  }
}
