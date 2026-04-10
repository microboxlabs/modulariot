import { NextResponse } from "next/server";

const MAX_PAGE_SIZE = 9999;

export type ParsedPageParams = { page: number; size: number };
export type PageParamsError = { error: NextResponse };

export function parsePageParams(
  searchParams: URLSearchParams
): ParsedPageParams | PageParamsError {
  const pageRaw = searchParams.get("page");
  const sizeRaw = searchParams.get("size");

  const page = pageRaw === null ? 0 : Number(pageRaw);
  const size = sizeRaw === null ? 9999 : Number(sizeRaw);

  if (!Number.isFinite(page) || !Number.isInteger(page) || page < 0) {
    return {
      error: NextResponse.json(
        { error: "Invalid page: must be a non-negative integer" },
        { status: 400 }
      ),
    };
  }

  if (!Number.isFinite(size) || !Number.isInteger(size) || size < 1) {
    return {
      error: NextResponse.json(
        { error: "Invalid size: must be a positive integer" },
        { status: 400 }
      ),
    };
  }

  if (size > MAX_PAGE_SIZE) {
    return {
      error: NextResponse.json(
        { error: `Invalid size: must not exceed ${MAX_PAGE_SIZE}` },
        { status: 400 }
      ),
    };
  }

  return { page, size };
}

export function isPageParamsError(
  result: ParsedPageParams | PageParamsError
): result is PageParamsError {
  return "error" in result;
}
