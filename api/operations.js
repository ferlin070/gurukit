import { operationalClient, secretMatches } from "../server/operational.js";
import { runOperations } from "../server/operations.js";
export const maxDuration = 60;
export default async function operations(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }
  if (!secretMatches(req.headers.authorization, process.env.CRON_SECRET))
    return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    return res.status(200).json(await runOperations(operationalClient()));
  } catch {
    return res.status(503).json({ error: "OPERATIONS_FAILED" });
  }
}
