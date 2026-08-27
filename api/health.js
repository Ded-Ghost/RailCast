/**
 * Deployment health/configuration check. Deliberately reports only
 * booleans about which secrets are present — never the secrets
 * themselves — so the frontend (or you, curling this manually) can tell
 * whether live data SHOULD work without needing a real train number to
 * test with.
 */
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    liveTrainProviderConfigured: Boolean(process.env.RAILRADAR_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
