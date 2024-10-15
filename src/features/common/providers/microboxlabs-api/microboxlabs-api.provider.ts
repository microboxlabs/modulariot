import fetcher from "../fetcher";
import { GetEntityInfoResponse } from "./microboxlabs-api.types";

export function getInfoEntity(entity: string): Promise<GetEntityInfoResponse> {
  const url = `${process.env.MICROBOXLABS_API_URL}/rpc/obtener_info_entity`;
  return fetcher(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MICROBOXLABS_API_KEY}`,
    },
    body: JSON.stringify({ parametro: entity }),
  });
}
