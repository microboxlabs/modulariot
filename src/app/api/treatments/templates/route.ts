import { auth } from "@/auth";
import { NextResponse } from "next/server";
import speedLimit from "./speedLimit.json";
import badSign from "./badSign.json";
import outsideSchedule from "./outsideSchedule.json";
import panicButton from "./panicButton.json";
import riskZoneSleep from "./riskZoneSleep.json";
import riskZoneStop from "./riskZoneStop.json";
import minRest from "./minRest.json";
import continuousDriveCheck from "./continuousDriveCheck.json";
/* const SYMPTOMS_API_URL = "TODO:DEFINE";

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";
 */
/* const config: AuthTokenConfig = {
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
};

const authToken = new AuthToken(config); */

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  const templates: Record<
    string,
    Record<string, { name: string; message: string }>
  > = {
    "Bad Sign": badSign,
    "Speed Limit Custom": speedLimit,
    "Speed Limit Standard": speedLimit,
    "Outside Schedule": outsideSchedule,
    "Panic Button": panicButton,
    "Risk Zone Sleep": riskZoneSleep,
    "Risk Zone Stop": riskZoneStop,
    "Min Rest": minRest,
    "Continuous drive check": continuousDriveCheck,
  };
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const name = searchParams.get("name");
  try {
    //const token = await authToken.getToken();
    /* const response = await fetch(SYMPTOMS_API_URL + "?p_symptom_id=" + id, {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    } */

    //const apiData = (await  .json()) as TreatmentsGeneralResponse;
    // Transform API data into our desired structure
    //const formattedResponse: TreatmentsGeneralResponseItem = apiData.data;
    const template =
      name &&
      id &&
      (templates[name as keyof typeof templates]?.[
        id as keyof (typeof templates)[keyof typeof templates]
      ] as { name: string; message: string } | undefined);

    if (!template) {
      return NextResponse.json(
        { name: "Not found", message: "" },
        {
          status: 200,
        },
      );
    }

    return NextResponse.json(template, {
      status: 200,
    });
  } catch (error) {
    return NextResponse.json(
      {
        data: [],
        status: 500,
        message: "Failed to fetch symptoms data",
      },
      { status: 500 },
    );
  }
}
