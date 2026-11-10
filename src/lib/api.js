// file: src/lib/api.js — panggilan ke API proxy /api/generate dengan token sesi
import { supabase } from './supabase.js';

export async function generateDocument(toolId, prompt, systemPrompt, onChunk) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sila log masuk terlebih dahulu.');

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ toolId, prompt, systemPrompt }),
  });

  // Ralat: pelayan balas JSON
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 429 || data.error === 'QUOTA_EXCEEDED')
      throw new Error('Kuota harian anda telah habis. Cuba lagi esok atau naik taraf ke Pro.');
    if (res.status === 503)
      throw new Error('Model AI sedang sibuk. Cuba semula sebentar lagi.');
    throw new Error(data.error || `Ralat pelayan (${res.status}).`);
  }

  // Berjaya: baca stream token demi token
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    text += chunk;
    if (onChunk) onChunk(text);
  }
  return { text };
}

// Kuota semasa: jumlah penggunaan hari ini daripada jadual quota_usage
export async function getQuotaToday() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('plan, daily_quota').eq('id', user.id).single();
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await supabase
    .from('quota_usage').select('used').eq('user_id', user.id).eq('usage_date', today).maybeSingle();
  return {
    plan: profile?.plan ?? 'free',
    dailyQuota: profile?.daily_quota ?? 5,
    used: usage?.used ?? 0,
  };
}
