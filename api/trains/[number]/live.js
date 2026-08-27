/**
 * Serverless proxy for a real live-train-position provider (RailRadar —
 * see https://railradar.in/docs). Exists so the RailRadar secret key
 * never reaches the browser — see src/services/liveTrainService.ts for
 * the frontend side of this and why that split is mandatory here.
 *
 * Deploy target: Vercel (zero-config — any file under /api becomes a
 * function; [number] in the path is a dynamic route segment). The logic
 * below is plain Node.js (req, res) and should port to Netlify Functions
 * or Cloudflare Pages Functions with a thin adapter if you deploy
 * elsewhere.
 *
 * Required environment variable (set in your hosting provider's
 * dashboard — NEVER as a VITE_-prefixed / client-exposed variable):
 *   RAILRADAR_API_KEY
 *
 * KNOWN OPEN ITEM: RailRadar's own public pages disagree with each other
 * on the exact base URL / auth header — their docs page
 * (railradar.in/docs) states base URL `https://api.railradar.in/v1` with
 * `Authorization: Bearer <key>`, while a separate marketing page shows
 * `https://api.railradar.in/api/v1/...` with an `X-API-Key` header. This
 * file follows the docs page as the more authoritative source. Once you
 * have a real key, hit this endpoint once and check the response —
 * if you get a 404/401 that doesn't match a "wrong train number" error,
 * try swapping BASE_URL to end in `/api/v1` and/or the auth header to
 * `X-API-Key` below.
 */

const BASE_URL = "https://api.railradar.in/v1";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const apiKey = process.env.RAILRADAR_API_KEY;
  if (!apiKey) {
    // Honest "not configured" response — the frontend must surface this
    // as OFFLINE and must never fall back to fabricated data.
    return res.status(503).json({
      error: "not_configured",
      message: "RAILRADAR_API_KEY is not set on this deployment.",
    });
  }

  const { number } = req.query;
  if (!number || Array.isArray(number)) {
    return res.status(400).json({ error: "invalid_request", message: "A single train number is required." });
  }

  try {
    const upstream = await fetch(`${BASE_URL}/trains/${encodeURIComponent(number)}/live`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "upstream_error",
        message: payload?.message ?? `RailRadar returned HTTP ${upstream.status}`,
      });
    }

    // Cache briefly at the edge — live position doesn't need re-fetching
    // from RailRadar on every single browser poll.
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
    // Deliberately passed through RAW, unnormalized — see
    // src/services/liveTrainService.ts for where field-name mapping
    // happens, kept client-side so it's easy to iterate on once a real
    // response is visible.
    return res.status(200).json(payload);
  } catch {
    return res.status(502).json({ error: "network_error", message: "Could not reach RailRadar." });
  }
}
