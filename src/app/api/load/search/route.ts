import { auth } from "@/auth";
import { NextResponse } from "next/server";

const SYMPTOMS_API_URL = `${process.env.OPENAPI_URL}/api/v1/pgrest/rpc/get_expedition_route`;
const TOKEN = process.env.OPENAPI_TOKEN;
import { LoadSearchResponse } from "@/types/load.types";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const loadId = searchParams.get("loadId");

    const response = await fetch(SYMPTOMS_API_URL, {
      method: "POST",
      body: JSON.stringify({ p_expedition_id: +(loadId ?? "") }),
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("------------------------");
    console.log(response);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const apiData = (await response.json()) as LoadSearchResponse;

    return NextResponse.json(apiData);
  } catch (error) {
    return NextResponse.json(
      {
        data: [],
        status: 500,
        message: error,
      },
      { status: 500 }
    );
  }
}
