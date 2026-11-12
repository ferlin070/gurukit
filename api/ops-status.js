import {
  operationalClient,
  secretMatches,
  VERSION,
} from "../server/operational.js";
export default async function status(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET")
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  if (!secretMatches(req.headers.authorization, process.env.CRON_SECRET))
    return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const { data, error } = await operationalClient().rpc("operational_health");
    if (error) throw error;
    return res.status(200).json({
      version: VERSION,
      ...data,
      notificationsConfigured: Boolean(
        process.env.RESEND_API_KEY &&
        process.env.ALERT_EMAIL &&
        process.env.MAIL_FROM,
      ),
      backupConfigured: Boolean(process.env.BACKUP_ENCRYPTION_KEY),
      backupScope: "application-data-only",
    });
  } catch {
    return res.status(503).json({ error: "UNAVAILABLE" });
  }
}
