/**
 * The query catalog: approved connections and operations a dashboard author
 * may bind queries to. Types only; the body of `GET …/query-catalog`.
 */

/** A value an operation reads, named as a query binding names it. */
export interface DashboardCatalogParameter {
  name: string;
  required?: boolean;
  description?: string;
}

export interface DashboardCatalogOperation {
  id: string;
  label: string;
  /** Public result column names only, not execution or credential schemas. */
  schema?: string[];
  /** The parameters the operation reads. Absent when the host does not publish them. */
  parameters?: DashboardCatalogParameter[];
}

export interface DashboardCatalogConnection {
  id: string;
  label: string;
  operations: DashboardCatalogOperation[];
}

/** The response body of `GET …/dashboards/{slug}/query-catalog`. */
export interface DashboardQueryCatalogResponse {
  connections: DashboardCatalogConnection[];
}
