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

    if (!loadId || /[a-zA-Z]/.test(loadId)) {
      return NextResponse.json([]);
    }

    const response = await fetch(SYMPTOMS_API_URL, {
      method: "POST",
      body: JSON.stringify({ p_expedition_id: +(loadId ?? "") }),
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 404) {
      return NextResponse.json({ status: 404 }, { status: 404 });
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    //console.log(await response.json());

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
