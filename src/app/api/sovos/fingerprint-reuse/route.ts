import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSovosFingerprintReuse } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  if (process.env.TOTEM_PILOT_ENABLED !== "true") {
    return NextResponse.json(
      { autoSigned: false, totemPilot: false },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rut = searchParams.get("rut");
  const tripId = searchParams.get("tripId");

  if (!rut || !tripId) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  try {
    const fingerprintReuse = await getSovosFingerprintReuse(session, {
      driverId: rut,
      tripId,
    });
    return NextResponse.json({ fingerprintReuse });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
