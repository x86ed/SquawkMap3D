import { NextResponse } from "next/server";

/**
 * Backend health-check endpoint.
 *
 * GET /api/health
 *
 * @returns {NextResponse} JSON payload describing service status.
 */
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "SquawkMap3D",
    timestamp: new Date().toISOString(),
  });
}
