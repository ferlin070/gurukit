import { supabase } from "./supabase.js";
let lastReport = 0;
const allowed = new Set([
  "UI_RENDER_ERROR",
  "UNHANDLED_ERROR",
  "UNHANDLED_REJECTION",
]);
export async function reportClientError(code) {
  if (!allowed.has(code) || Date.now() - lastReport < 60000) return;
  lastReport = Date.now();
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await fetch("/api/client-error", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* Reporting must never interrupt the teacher. */
  }
}
export function installErrorReporting() {
  const error = () => reportClientError("UNHANDLED_ERROR"),
    rejection = () => reportClientError("UNHANDLED_REJECTION");
  window.addEventListener("error", error);
  window.addEventListener("unhandledrejection", rejection);
  return () => {
    window.removeEventListener("error", error);
    window.removeEventListener("unhandledrejection", rejection);
  };
}
