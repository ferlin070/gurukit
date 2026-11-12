import { supabase } from "./supabase.js";
import { readSSE } from "./sse.js";

export async function generateDocument(
  toolId,
  values,
  context,
  { onChunk, onMeta, signal } = {},
) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session) throw new Error("Sila log masuk terlebih dahulu.");
  const response = await fetch("/api/generate", {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ toolId, values, context }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Ralat pelayan (${response.status}).`);
  }
  if (
    !response.body ||
    !response.headers.get("content-type")?.includes("text/event-stream")
  )
    throw new Error(
      "Respons penjanaan tidak sah. Muat semula halaman dan cuba lagi.",
    );
  let text = "",
    complete = false,
    quotaRemaining;
  for await (const data of readSSE(response.body)) {
    const event = JSON.parse(data);
    if (event.type === "meta") {
      quotaRemaining = event.quotaRemaining;
      onMeta?.(event);
    }
    if (event.type === "delta") {
      text += event.text;
      onChunk?.(text);
    }
    if (event.type === "error") throw new Error(event.error || "Janaan gagal.");
    if (event.type === "done") {
      complete = true;
      quotaRemaining = event.quotaRemaining;
    }
  }
  if (!complete || !text.trim())
    throw new Error(
      "Janaan terputus atau kosong. Hasil belum lengkap. Sila cuba lagi.",
    );
  return { text, quotaRemaining };
}
export async function getQuotaToday() {
  const { data, error } = await supabase.rpc("get_daily_quota");
  if (error || !data)
    throw new Error("Kuota tidak dapat dimuatkan. Sila cuba semula.");
  return data;
}
export async function currentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sesi tamat. Sila log masuk semula.");
  return user;
}
export async function getTeachingProfile() {
  const user = await currentUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name,teaching_context")
    .eq("id", user.id)
    .single();
  if (error) throw new Error("Profil pengajaran tidak dapat dimuatkan.");
  return data;
}
export async function saveTeachingProfile(fullName, context) {
  const user = await currentUser();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, teaching_context: context })
    .eq("id", user.id);
  if (error) throw new Error("Profil tidak dapat disimpan. Sila cuba semula.");
}
export async function listDocuments() {
  const { data, error } = await supabase
    .from("saved_documents")
    .select("id,tool_id,title,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Dokumen tidak dapat dimuatkan.");
  return data;
}
export async function getDocument(id) {
  const { data, error } = await supabase
    .from("saved_documents")
    .select("id,tool_id,title,content,created_at")
    .eq("id", id)
    .single();
  if (error) throw new Error("Dokumen tidak ditemukan atau tiada akses.");
  return data;
}
export async function saveDocument(toolId, title, content) {
  const user = await currentUser();
  if (
    !title.trim() ||
    title.length > 160 ||
    !content.trim() ||
    content.length > 150000
  )
    throw new Error("Tajuk atau kandungan dokumen tidak sah.");
  const { data, error } = await supabase
    .from("saved_documents")
    .insert({ user_id: user.id, tool_id: toolId, title: title.trim(), content })
    .select("id")
    .single();
  if (error) throw new Error("Dokumen tidak dapat disimpan. Sila cuba semula.");
  return data;
}
export async function deleteDocument(id) {
  const { error } = await supabase
    .from("saved_documents")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Dokumen tidak dapat dipadam.");
}
