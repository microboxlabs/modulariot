import { createStreamHubApiHandler } from "../../utils/streamhub-api-client";

const paramMapping = [
  { source: "asset_id", target: "p_asset_id" },
  { source: "p_from", target: "p_start_date_historic" },
  { source: "p_to", target: "p_end_date_historic" },
];

export const GET = createStreamHubApiHandler(
  "/api/v1/pgrest/rpc/api_modular_overview_historic_position",
  paramMapping
);
