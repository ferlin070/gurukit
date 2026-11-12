import { encryptSnapshot, decryptSnapshot, snapshotDigest } from "./backup.js";
import { recordEvent } from "./operational.js";
import { driveConfigured, mirrorDriveBackup } from "./drive-backup.js";
import { malaysiaDate } from "../src/data/mrsm.js";
export const BACKUP_BUCKET = "gurukit-backups";
export async function sendAlert(code, env = process.env) {
  if (!env.RESEND_API_KEY || !env.ALERT_EMAIL || !env.MAIL_FROM) return false;
  if (!/^[A-Z_]{1,64}$/.test(code)) throw new Error("INVALID_ALERT");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: {
      Authorization: "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `GuruKit <${env.MAIL_FROM}>`,
      to: [env.ALERT_EMAIL],
      subject: `GuruKit: ${code}`,
      text: `Semakan operasi GuruKit memerlukan perhatian. Kod: ${code}. Semak dashboard Vercel/Supabase dan runbook production. Tiada kandungan dokumen atau maklumat login disertakan.`,
    }),
  });
  return response.ok;
}
export async function runOperations(
  admin,
  env = process.env,
  mirrorImpl = mirrorDriveBackup,
) {
  async function offsite(encrypted) {
    try {
      const result = await mirrorImpl(encrypted, day, env);
      if (result.status === "verified")
        await recordEvent(admin, {
          event: "backup_ok",
          code: "DRIVE_VERIFIED",
        });
      return result;
    } catch {
      await recordEvent(admin, {
        event: "backup_error",
        code: "DRIVE_BACKUP_FAILED",
      });
      await sendAlert("DRIVE_BACKUP_FAILED", env).catch(() => false);
      return { status: "failed", code: "DRIVE_BACKUP_FAILED" };
    }
  }
  if (!env.BACKUP_ENCRYPTION_KEY) throw new Error("BACKUP_KEY_REQUIRED");
  const day = malaysiaDate();
  const claim = await admin.rpc("claim_operations_run", { p_date: day });
  if (claim.error) throw new Error("OPERATIONS_UNAVAILABLE");
  if (!claim.data) {
    if (!driveConfigured(env)) return { status: "already_claimed", day };
    const existing = await admin.storage
      .from(BACKUP_BUCKET)
      .download(`app-${day}.enc`);
    if (existing.error)
      return {
        status: "already_claimed",
        day,
        offsite: { status: "primary_not_available" },
      };
    return {
      status: "already_claimed",
      day,
      offsite: await offsite(Buffer.from(await existing.data.arrayBuffer())),
    };
  }
  try {
    const snapshot = await admin.rpc("application_backup_snapshot");
    if (snapshot.error || !snapshot.data) throw new Error("SNAPSHOT_FAILED");
    const payload = {
      ...snapshot.data,
      release: env.VERCEL_GIT_COMMIT_SHA || "development",
    };
    const encrypted = encryptSnapshot(payload, env.BACKUP_ENCRYPTION_KEY),
      object = `app-${day}.enc`;
    const bucket = admin.storage.from(BACKUP_BUCKET);
    const uploaded = await bucket.upload(object, encrypted, {
      contentType: "application/octet-stream",
      upsert: true,
    });
    if (uploaded.error) throw new Error("BACKUP_UPLOAD_FAILED");
    const download = await bucket.download(object);
    if (download.error) throw new Error("BACKUP_READBACK_FAILED");
    const restored = decryptSnapshot(
      Buffer.from(await download.data.arrayBuffer()),
      env.BACKUP_ENCRYPTION_KEY,
    );
    if (snapshotDigest(payload) !== snapshotDigest(restored))
      throw new Error("BACKUP_VERIFY_FAILED");
    const saved = await admin
      .from("operations_runs")
      .update({
        state: "completed",
        object_name: object,
        completed_at: new Date().toISOString(),
      })
      .eq("usage_date", day);
    if (saved.error) throw new Error("BACKUP_RECORD_FAILED");
    await recordEvent(admin, { event: "backup_ok", code: "VERIFIED" });
    const list = await bucket.list("", {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });
    if (!list.error) {
      const cutoff = Date.now() - 7 * 86400000;
      const expired = list.data
        .filter(
          (item) =>
            /^app-\d{4}-\d{2}-\d{2}\.enc$/.test(item.name) &&
            Date.parse(item.name.slice(4, 14) + "T00:00:00+08:00") < cutoff,
        )
        .map((item) => item.name);
      if (expired.length) {
        const removed = await bucket.remove(expired);
        if (removed.error)
          console.error("GuruKit: backup retention cleanup unavailable");
      }
    }
    const cleanup = await admin.rpc("prune_operational_metadata");
    if (cleanup.error)
      console.error("GuruKit: metadata retention cleanup unavailable");
    const health = await admin.rpc("operational_health");
    if (health.data?.recentGenerationErrors >= 5)
      await sendAlert("GENERATION_ERRORS", env).catch(() => false);
    return {
      status: "completed",
      day,
      verified: true,
      encryptedBytes: encrypted.length,
      offsite: await offsite(encrypted),
      scope: "application-data-only",
    };
  } catch (error) {
    const allowed = [
      "SNAPSHOT_FAILED",
      "BACKUP_UPLOAD_FAILED",
      "BACKUP_READBACK_FAILED",
      "BACKUP_VERIFY_FAILED",
      "BACKUP_RECORD_FAILED",
    ];
    const code = allowed.includes(error.message)
      ? error.message
      : "BACKUP_FAILED";
    await admin
      .from("operations_runs")
      .update({ state: "failed" })
      .eq("usage_date", day);
    await recordEvent(admin, { event: "backup_error", code });
    await sendAlert(code, env).catch(() => false);
    throw new Error(code);
  }
}
