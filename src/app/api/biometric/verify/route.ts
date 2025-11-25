import { getBiometricVerification } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const result = await getBiometricVerification(data);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ data: JSON.parse((error as any)?.info) }, { status: (error as any)?.status || 500 });
  }
}
