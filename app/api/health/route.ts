import { NextResponse } from "next/server";

// Required for this route to be included in a static export (`output:
// "export"` in next.config.js) — without it, `next build` fails since a
// dynamic route needs an explicit static mode. Its effect here: `timestamp`
// below is frozen at build time (deploy time) rather than per-request. See
// openspec/changes/deploy-to-feeder/design.md Decision 1.
export const dynamic = "force-static";

/**
 * Backend health-check endpoint.
 *
 * GET /api/health
 *
 * @returns {NextResponse} JSON payload describing service status.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "SquawkMap3D",
    timestamp: new Date().toISOString(),
  });
}
