import { GET as getAuth, POST as postAuth } from "@/auth";
import { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  // console.log("GET request", request.nextUrl.pathname);
  request.nextUrl.pathname = `/app${request.nextUrl.pathname}`;
  return getAuth(request);
}

export function POST(request: NextRequest) {
  // console.log("POST request", request.nextUrl.pathname);
  request.nextUrl.pathname = `/app${request.nextUrl.pathname}`;
  return postAuth(request);
}
