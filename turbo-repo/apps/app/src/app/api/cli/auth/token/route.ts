import { consumeCliAuthHandoff } from "@/app/cli/auth/handoff-store";
import { NextResponse } from "next/server";

interface TokenExchangeBody {
  code?: string;
  state?: string;
}

export async function POST(request: Request) {
  let body: TokenExchangeBody;
  try {
    body = (await request.json()) as TokenExchangeBody;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const code = body.code?.trim();
  if (!code) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "code is required." },
      { status: 400 },
    );
  }

  const state = body.state?.trim();
  if (!state) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "state is required." },
      { status: 400 },
    );
  }

  const handoff = consumeCliAuthHandoff(code, state);
  if (!handoff) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "The CLI login code is invalid or expired.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    access_token: handoff.token,
    token_type: "Bearer",
    organization_id: handoff.organizationId,
  });
}
