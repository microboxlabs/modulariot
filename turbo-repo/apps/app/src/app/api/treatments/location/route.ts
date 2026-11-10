import { auth } from "@/auth";
import { NextResponse } from "next/server";

import { TreatmentsLocationResponseItem } from "./route.type";
import { parseWKBPoint } from "@/utils/map-conversion";
import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";

/** The signals of an evaluator's case (`symptom_id`), from the modulith, with coordinates. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }
  const { searchParams } = new URL(request.url);
  const symptom_id = searchParams.get("symptom_id")?.trim();
  const symptom_name = searchParams.get("symptom_name");

  if (!symptom_id) {
    return NextResponse.json(
      {
        data: {
          type: "FeatureCollection",
          features: [],
          description: {},
        },
        status: 400,
        message: "Missing required parameters",
      },
      { status: 400 }
    );
  }

  const response = await forwardControlTowerMap(
    `symptoms/${encodeURIComponent(symptom_id)}/signals`
  );
  if (!response.ok) return response;
  const data = (await response.json()) as TreatmentsLocationResponseItem;
  return NextResponse.json(withCoordinates(data, symptom_name));
}

// A case without GPS rows answers features: null.
function withCoordinates(
  data: Omit<TreatmentsLocationResponseItem, "features"> & {
    features: TreatmentsLocationResponseItem["features"] | null;
  },
  symptom_name: string | null
): TreatmentsLocationResponseItem {
  return {
    type: "FeatureCollection",
    ...(data.closed === undefined ? {} : { closed: data.closed }),
    features: (data.features ?? []).map((feature) => {
      const [longitude, latitude] = parseWKBPoint(feature.geometry);
      return {
        ...feature,
        longitude,
        latitude,
        symptom_name,
      };
    }),
    description: data.description,
  };
}
