import { recordEvent, rateResponse } from "./operational.js";
import { parseGeneratedBank } from "../src/lib/question-bank.js";
import { parseGeneratedRph } from "../src/lib/rph-template.js";
import { randomUUID } from "node:crypto";
import {
  prepareGeneration,
  InputError,
  readSSE,
  geminiEvent,
} from "./generation.js";
const MODELS = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.1-flash-lite",
];
const MESSAGES = {
  MODEL_BUDGET_UNAVAILABLE:
    "Kawalan perkhidmatan AI tidak dapat disahkan. Cuba lagi sebentar.",
  INVALID_BANK_OUTPUT:
    "Struktur soalan atau skema tidak sepadan dengan JSU. Cuba kurangkan bilangan soalan dan jana semula.",
  INVALID_RPH_OUTPUT: "Struktur templat RPH tidak lengkap. Sila jana semula.",
  OUTPUT_TRUNCATED:
    "Hasil belum lengkap kerana mencapai had panjang. Kecilkan skop dan jana semula.",
  EMPTY_OUTPUT:
    "AI tidak memberikan hasil. Cuba tajuk atau arahan yang lebih khusus.",
  CONTENT_BLOCKED:
    "Permintaan tidak dapat diproses oleh AI. Semak kandungan dan cuba semula.",
  GENERATION_TIMEOUT: "Masa penjanaan tamat. Kecilkan skop dan cuba semula.",
  GENERATION_FAILED: "Janaan terputus. Sila cuba semula.",
};

export function createGenerationHandler({
  createClient,
  fetchImpl = fetch,
  env = process.env,
  uuid = randomUUID,
  timeoutMs = 50000,
  recordEventImpl = recordEvent,
}) {
  return async function handler(req, res) {
    const started = Date.now();
    let admin = null,
      actorId = null,
      logRequestId = null,
      input;
    const observe = async (event, code) => {
      if (admin && actorId)
        await recordEventImpl(admin, {
          event,
          code,
          actorId,
          requestId: logRequestId,
          toolId: input?.tool?.id,
          durationMs: Date.now() - started,
        });
    };
    const bad = async (status, error, code) => {
      res.status(status).json({ error, code });
      if (actorId) await observe("request_rejected", code);
    };
    const rejectLimit = async (code) => {
      const limit = rateResponse(code);
      if (!limit) return false;
      res.setHeader("Retry-After", String(limit.retry));
      await bad(limit.status, limit.message, limit.code);
      return true;
    };
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return bad(405, "Kaedah tidak dibenarkan.", "METHOD_NOT_ALLOWED");
    }
    const authorization = req.headers.authorization;
    const token = (
      typeof authorization === "string" && authorization.length <= 8192
        ? authorization
        : ""
    ).match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token)
      return bad(401, "Sila log masuk terlebih dahulu.", "UNAUTHORIZED");
    try {
      input = prepareGeneration(req.body);
    } catch (error) {
      return bad(
        400,
        error instanceof InputError ? error.message : "Permintaan tidak sah.",
        "INVALID_INPUT",
      );
    }
    if (
      !env.SUPABASE_URL ||
      !env.SUPABASE_SERVICE_ROLE_KEY ||
      !env.GEMINI_API_KEY
    )
      return bad(503, "Konfigurasi pelayan belum lengkap.", "SERVER_CONFIG");
    admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (url, options) =>
          fetchImpl(url, {
            ...options,
            signal: AbortSignal.any(
              [options?.signal, AbortSignal.timeout(5000)].filter(Boolean),
            ),
          }),
      },
    });
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error("GENERATION_TIMEOUT")),
      timeoutMs,
    );
    timer.unref?.();
    const disconnected = () => {
      if (!res.writableEnded)
        controller.abort(new Error("CLIENT_DISCONNECTED"));
    };
    req.on?.("aborted", disconnected);
    res.on?.("close", disconnected);
    let reservation = null,
      settled = false,
      streaming = false;
    const finish = async (success) => {
      if (!reservation || settled) return;
      const { error } = await admin.rpc("finish_generation", {
        p_request_id: reservation,
        p_success: success,
      });
      if (error) throw new Error("QUOTA_SETTLEMENT_FAILED");
      settled = true;
    };
    const event = (name, data) => {
      if (!controller.signal.aborted && !res.writableEnded)
        res.write(
          `event: ${name}\ndata: ${JSON.stringify({ type: name, ...data })}\n\n`,
        );
    };
    try {
      const { data: auth, error: authError } = await admin.auth.getUser(token);
      if (authError?.status >= 500)
        return bad(
          503,
          "Perkhidmatan pengesahan tidak tersedia. Cuba lagi sebentar.",
          "AUTH_UNAVAILABLE",
        );
      if (authError || !auth?.user)
        return bad(
          401,
          "Sesi tamat atau tidak sah. Sila log masuk semula.",
          "UNAUTHORIZED",
        );
      actorId = auth.user.id;
      const rate = await admin.rpc("check_generation_rate", {
        p_user_id: actorId,
      });
      if (rate.error || rate.data !== true) {
        if (rate.error && (await rejectLimit(rate.error.code))) return;
        return bad(
          503,
          "Kawalan trafik tidak tersedia. Cuba lagi sebentar.",
          "RATE_UNAVAILABLE",
        );
      }
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("plan")
        .eq("id", auth.user.id)
        .single();
      if (profileError || !profile)
        return bad(
          503,
          "Profil tidak dapat dimuatkan. Cuba lagi sebentar.",
          "PROFILE_UNAVAILABLE",
        );
      if (input.tool.plan === "pro" && profile.plan !== "pro")
        return bad(
          403,
          "Alat ini memerlukan pelan Pro. Sila gunakan alat Percuma atau hubungi pentadbir.",
          "PRO_REQUIRED",
        );
      if (controller.signal.aborted) throw controller.signal.reason;
      const requestId = uuid();
      logRequestId = requestId;
      const { data: remaining, error: quotaError } = await admin.rpc(
        "reserve_generation",
        { p_request_id: requestId, p_user_id: auth.user.id },
      );
      if (quotaError) {
        if (await rejectLimit(quotaError.code)) return;
        if (quotaError.code === "GURUQ")
          return bad(
            429,
            "Kuota harian anda telah habis. Kuota diperbaharui pada tengah malam waktu Malaysia.",
            "QUOTA_EXCEEDED",
          );
        return bad(
          503,
          "Kuota tidak dapat disahkan. Cuba lagi sebentar.",
          "QUOTA_UNAVAILABLE",
        );
      }
      reservation = requestId;
      let upstream = null;
      for (const model of MODELS) {
        if (controller.signal.aborted) throw controller.signal.reason;
        const budget = await admin.rpc("begin_model_attempt", {
          p_request_id: requestId,
          p_model: model,
        });
        if (budget.error || budget.data !== true) {
          await finish(false);
          if (budget.error && (await rejectLimit(budget.error.code))) return;
          throw new Error("MODEL_BUDGET_UNAVAILABLE");
        }

        const attempt = new AbortController();
        const attemptTimer = setTimeout(
          () =>
            attempt.abort(
              new DOMException("First response timed out", "TimeoutError"),
            ),
          15000,
        );
        try {
          const response = await fetchImpl(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
            {
              method: "POST",
              signal: AbortSignal.any([controller.signal, attempt.signal]),
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": env.GEMINI_API_KEY,
              },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: input.systemPrompt }] },
                contents: [{ role: "user", parts: [{ text: input.prompt }] }],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 4096,
                  thinkingConfig: { thinkingBudget: 0 },
                },
              }),
            },
          );
          if (response.ok && response.body) {
            upstream = response;
            break;
          }
          await response.body?.cancel().catch(() => {});
          if (![429, 503, 404].includes(response.status)) break;
        } catch (error) {
          if (controller.signal.aborted) throw controller.signal.reason;
          if (error?.name !== "TimeoutError") throw error;
        } finally {
          clearTimeout(attemptTimer);
        }
      }
      if (!upstream) {
        await finish(false);
        return bad(
          503,
          "Denyutan perkhidmatan AI terganggu. Cuba lagi sebentar. Kuota tidak digunakan.",
          "AI_UNAVAILABLE",
        );
      }
      if (controller.signal.aborted) {
        await upstream.body.cancel().catch(() => {});
        throw controller.signal.reason;
      }
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Accel-Buffering", "no");
      res.status(200);
      streaming = true;
      event("meta", { requestId, quotaRemaining: remaining });
      let text = "",
        complete = false;
      for await (const data of readSSE(upstream.body)) {
        if (controller.signal.aborted) throw controller.signal.reason;
        const chunk = geminiEvent(data);
        if (chunk.text) {
          text += chunk.text;
          event("delta", { text: chunk.text });
        }
        if (chunk.finish === "MAX_TOKENS") throw new Error("OUTPUT_TRUNCATED");
        if (chunk.finish === "STOP") complete = true;
      }
      if (!text.trim()) throw new Error("EMPTY_OUTPUT");
      if (!complete) throw new Error("GENERATION_FAILED");
      if (input.blueprint) {
        try {
          parseGeneratedBank(text, input.blueprint);
        } catch {
          throw new Error("INVALID_BANK_OUTPUT");
        }
      }
      if (input.rphTemplate) {
        try {
          parseGeneratedRph(text);
        } catch {
          throw new Error("INVALID_RPH_OUTPUT");
        }
      }
      await finish(true);
      await observe("generation_ok", "COMPLETED");
      event("done", { quotaRemaining: remaining });
      res.end();
    } catch (error) {
      let refunded = false;
      try {
        await finish(false);
        refunded = Boolean(reservation);
      } catch {
        console.error("GuruKit: quota settlement unavailable");
      }
      const code =
        controller.signal.reason?.message === "GENERATION_TIMEOUT"
          ? "GENERATION_TIMEOUT"
          : Object.hasOwn(MESSAGES, error?.message)
            ? error.message
            : "GENERATION_FAILED";
      await observe("generation_error", code);
      const message =
        MESSAGES[code] + (refunded ? " Kuota janaan ini dipulangkan." : "");
      if (!res.writableEnded && !res.destroyed) {
        if (streaming) {
          res.write(
            `event: error\ndata: ${JSON.stringify({ type: "error", code, error: message })}\n\n`,
          );
          res.end();
        } else bad(503, message, code);
      }
    } finally {
      clearTimeout(timer);
      req.off?.("aborted", disconnected);
      res.off?.("close", disconnected);
    }
  };
}
