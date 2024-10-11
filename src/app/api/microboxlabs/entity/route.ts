import { auth } from "@/auth";
import { getInfoEntity } from "@/features/common/providers/microboxlabs-api/microboxlabs-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const entity = req.nextUrl.searchParams.get("entity");
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }
  try {
    const response = await getInfoEntity(entity!);
    return NextResponse.json(response);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error fetching entity info" },
      { status: 500 },
    );
  }
}
