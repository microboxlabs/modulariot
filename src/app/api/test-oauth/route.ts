import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const testData = {
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      baseUrl: process.env.NEXTAUTH_URL,
      authUrl: `${process.env.NEXTAUTH_URL}/app/api/auth`,
      microsoftConfig: {
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID
          ? "✓ Present"
          : "✗ Missing",
        secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
          ? "✓ Present"
          : "✗ Missing",
        issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      },
      expectedRedirectUri: `${process.env.NEXTAUTH_URL}/app/api/auth/callback/microsoft-entra-id`,
    };

    console.log("OAuth test endpoint called:", testData);

    return NextResponse.json({
      status: "OK",
      message: "OAuth test endpoint working",
      data: testData,
    });
  } catch (error) {
    console.error("Error in test OAuth endpoint:", error);
    return NextResponse.json(
      {
        status: "ERROR",
        message: "Test endpoint failed",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
