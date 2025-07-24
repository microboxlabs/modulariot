import { NextRequest, NextResponse } from "next/server";
import { logger, apiLogger, logApiCall } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Log the incoming request
    apiLogger.info(
      {
        method: "GET",
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
      },
      "Example API route called",
    );

    // Simulate some processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    const responseTime = Date.now() - startTime;

    // Log the successful response
    logApiCall("GET", request.url, 200, responseTime, {
      example: "logging-demo",
    });

    return NextResponse.json({
      message: "Example logging API route",
      timestamp: new Date().toISOString(),
      responseTime,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Log the error
    logger.error(
      {
        err: error as Error,
        method: "GET",
        url: request.url,
        responseTime,
      },
      "Error in example API route",
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Log the request with body
    apiLogger.info(
      {
        method: "POST",
        url: request.url,
        body,
      },
      "POST request to example API route",
    );

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    const responseTime = Date.now() - startTime;

    // Log successful response
    logApiCall("POST", request.url, 201, responseTime, {
      example: "logging-demo",
      bodySize: JSON.stringify(body).length,
    });

    return NextResponse.json(
      {
        message: "Data received successfully",
        receivedData: body,
        timestamp: new Date().toISOString(),
        responseTime,
      },
      { status: 201 },
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Log the error
    logger.error(
      {
        err: error as Error,
        method: "POST",
        url: request.url,
        responseTime,
      },
      "Error processing POST request",
    );

    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 400 },
    );
  }
}
