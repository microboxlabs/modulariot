import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest, _params: never) {
  // const { lang } = request.;
  return NextResponse.json({
    status: "ok",
  });
}
