import { operationalClient, VERSION } from "../server/operational.js";
export function createHealthHandler(getClient = operationalClient) {
  return async function health(req, res) {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ status: "method_not_allowed" });
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const { data, error } = await getClient().rpc("operational_health");
      if (error || !data?.database) throw new Error("UNAVAILABLE");
      const ready =
        data.generationEnabled && data.attemptsToday < data.attemptLimit;
      res.setHeader(
        "Cache-Control",
        ready ? "public, s-maxage=30" : "no-store",
      );
      return res.status(ready ? 200 : 503).json({
        status: ready ? "ok" : "degraded",
        version: VERSION,
        checkedAt: new Date().toISOString(),
      });
    } catch {
      return res.status(503).json({ status: "unavailable", version: VERSION });
    }
  };
}
export default createHealthHandler();
