import { NextRequest, NextResponse } from "next/server";

// Temporary debugging endpoint - REMOVE THIS IN PRODUCTION
export async function GET(request: NextRequest) {
  // Only allow in development/staging
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AUTH_SECRET: process.env.AUTH_SECRET ? "✓ Present" : "✗ Missing",
    AUTH_MICROSOFT_ENTRA_ID_ID: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ? 
      `✓ Present (${process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.slice(0, 8)}...)` : "✗ Missing",
    AUTH_MICROSOFT_ENTRA_ID_SECRET: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ? 
      "✓ Present" : "✗ Missing",
    AUTH_MICROSOFT_ENTRA_ID_ISSUER: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "✗ Missing",
  };

  return NextResponse.json({
    message: "Environment Variables Check",
    variables: envVars,
    basePath: "/app",
    fullAuthUrl: `${process.env.NEXTAUTH_URL || 'MISSING'}/app/api/auth`
  });
}
