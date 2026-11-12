import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
export const VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "development";
export function operationalClient(env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("SERVER_CONFIG");
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options) =>
        fetch(url, {
          ...options,
          signal: AbortSignal.any(
            [options?.signal, AbortSignal.timeout(5000)].filter(Boolean),
          ),
        }),
    },
  });
}
export function secretMatches(header, secret) {
  if (
    typeof secret !== "string" ||
    secret.length < 32 ||
    typeof header !== "string"
  )
    return false;
  const actual = Buffer.from(header),
    expected = Buffer.from("Bearer " + secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function safeOperationalEvent(event) {
  const known = new Set([
    "generation_ok",
    "generation_error",
    "request_rejected",
    "client_error",
    "backup_ok",
    "backup_error",
    "health_ok",
    "health_error",
  ]);
  if (!known.has(event.event) || !/^[A-Z0-9_]{1,64}$/.test(event.code))
    throw new Error("INVALID_EVENT");
  const uuid = (value) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
      ? value
      : null;
  return {
    event: event.event,
    code: event.code,
    request_id: uuid(event.requestId),
    actor_id: uuid(event.actorId),
    tool_id:
      typeof event.toolId === "string" && /^[a-z0-9-]{1,80}$/.test(event.toolId)
        ? event.toolId
        : null,
    duration_ms: Math.max(
      0,
      Math.min(120000, Math.round(Number(event.durationMs) || 0)),
    ),
  };
}
export async function recordEvent(admin, event) {
  const row = safeOperationalEvent(event);
  console.info(
    JSON.stringify({
      event: row.event,
      code: row.code,
      requestId: row.request_id,
      toolId: row.tool_id,
      durationMs: row.duration_ms,
    }),
  );
  if (row.event === "request_rejected") return;
  try {
    const { error } = await admin
      .from("operational_events")
      .insert(row)
      .abortSignal(AbortSignal.timeout(1500));
    if (error)
      console.error("GuruKit: operational event persistence unavailable");
  } catch {
    console.error("GuruKit: operational event persistence unavailable");
  }
}
export function rateResponse(code) {
  return (
    {
      GURUR: {
        status: 429,
        retry: 60,
        code: "RATE_LIMITED",
        message:
          "Terlalu banyak percubaan. Tunggu satu minit sebelum mencuba semula.",
      },
      GURUC: {
        status: 429,
        retry: 15,
        code: "CONCURRENCY_LIMIT",
        message:
          "Janaan lain masih berjalan. Tunggu sehingga selesai sebelum mencuba lagi.",
      },
      GURUB: {
        status: 503,
        retry: 3600,
        code: "DAILY_SERVICE_LIMIT",
        message:
          "Had perkhidmatan AI hari ini telah dicapai. Cuba lagi selepas kuota perkhidmatan diperbaharui atau hubungi sokongan.",
      },
      GURUM: {
        status: 503,
        retry: 300,
        code: "MAINTENANCE",
        message:
          "Penjanaan dihentikan sementara untuk penyelenggaraan. Dokumen tersimpan masih boleh dibuka.",
      },
    }[code] || null
  );
}
