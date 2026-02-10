import { NextResponse } from "next/server";

/**
 * Test endpoint for the Indicator Card dashlet.
 * Returns a random or specified numeric value.
 *
 * Usage:
 * - GET /api/test/indicator → random value 0-100
 * - GET /api/test/indicator?value=75 → returns 75
 * - GET /api/test/indicator?min=0&max=50 → random value 0-50
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // If a specific value is provided, use it
  const specificValue = searchParams.get("value");
  if (specificValue !== null) {
    const num = parseFloat(specificValue);
    return NextResponse.json({
      value: isNaN(num) ? 0 : num,
      timestamp: new Date().toISOString(),
      status: "ok",
    });
  }

  // Otherwise, generate a random value within min/max range
  const min = parseFloat(searchParams.get("min") ?? "0");
  const max = parseFloat(searchParams.get("max") ?? "100");
  const randomValue =
    Math.round((Math.random() * (max - min) + min) * 100) / 100;

  // Generate a "previous" value for trend comparisons
  const previousValue =
    Math.round((Math.random() * (max - min) + min) * 100) / 100;

  return NextResponse.json({
    value: randomValue,
    previousValue: previousValue,
    timestamp: new Date().toISOString(),
    status: "ok",
    data: {
      percentage: randomValue,
      previousPercentage: previousValue,
      count: Math.floor(randomValue * 10),
      previousCount: Math.floor(previousValue * 10),
      nested: {
        deep: randomValue * 2,
      },
    },
  });
}
