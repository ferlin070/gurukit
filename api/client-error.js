import { operationalClient } from "../server/operational.js";
const CODES = ["UI_RENDER_ERROR", "UNHANDLED_ERROR", "UNHANDLED_REJECTION"];
export default async function clientError(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }
  const token =
    typeof req.headers.authorization === "string" &&
    req.headers.authorization.match(/^Bearer (\S{1,8192})$/)?.[1];
  if (!token) return res.status(401).json({ error: "UNAUTHORIZED" });
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "INVALID_EVENT" });
  }
  if (
    !body ||
    Object.keys(body).length !== 1 ||
    !CODES.includes(body.code) ||
    JSON.stringify(body).length > 200
  )
    return res.status(400).json({ error: "INVALID_EVENT" });
  try {
    const admin = operationalClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user)
      return res.status(401).json({ error: "UNAUTHORIZED" });
    const result = await admin.rpc("record_client_error", {
      p_user_id: data.user.id,
      p_code: body.code,
    });
    if (result.error) throw new Error("UNAVAILABLE");
    if (!result.data) {
      res.setHeader("Retry-After", "3600");
      return res.status(429).json({ error: "RATE_LIMITED" });
    }
    return res.status(202).json({ accepted: true });
  } catch {
    return res.status(503).json({ error: "UNAVAILABLE" });
  }
}
