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
    const expeditionCode = searchParams.get("expeditionCode");
    const expeditionNumber = searchParams.get("expeditionNumber");

    if (!expeditionCode && !expeditionNumber) {
      return NextResponse.json([]);
    }

    if (expeditionCode && /[a-zA-Z]/.test(expeditionCode)) {
      return NextResponse.json([]);
    }

    if (expeditionNumber && /[a-zA-Z]/.test(expeditionNumber)) {
      return NextResponse.json([]);
    }

    // Only include parameters that have values
    const requestBody: { p_expedition_id?: string; p_expe_num?: string } = {};
    if (expeditionCode) {
      requestBody.p_expedition_id = expeditionCode;
    }
    if (expeditionNumber) {
      requestBody.p_expe_num = expeditionNumber;
    }

    const response = await fetch(SYMPTOMS_API_URL, {
      method: "POST",
      body: JSON.stringify(requestBody),
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

    // console.log(await response.json());

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
