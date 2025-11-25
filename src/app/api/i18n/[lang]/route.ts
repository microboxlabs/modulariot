import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  // const { lang } = request.;
  return NextResponse.json({
    status: "ok",
  });
}
