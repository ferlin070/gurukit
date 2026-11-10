// file: api/generate.ts — Vercel Serverless Function (Node runtime)
// AI proxy berstreaming: sahkan JWT Supabase → kuota harian atomik →
// stream hasil Gemini terus ke pelayar (token muncul serta-merta).
// Key server (GEMINI_API_KEY) TIDAK PERNAH sampai ke pelayar.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'gemini-3.5-flash';
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.1-flash-lite'];

export const maxDuration = 60; // had plan Hobby Vercel

interface Body {
  toolId: string;
  prompt: string;
  systemPrompt: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const bad = (status: number, error: string) => {
    res.status(status).json({ error });
  };

  if (req.method !== 'POST') return bad(405, 'Method tidak dibenarkan');

  // 1. Sahkan token pengguna
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return bad(401, 'Tidak dibenarkan');

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return bad(401, 'Token tidak sah');

  // 2. Kuota harian atomik
  const { error: quotaErr } = await supabase.rpc('consume_daily_quota');
  if (quotaErr) {
    if (quotaErr.message.includes('habis')) return bad(429, 'QUOTA_EXCEEDED');
    return bad(500, 'Kuota gagal diproses');
  }

  // 3. Badan permintaan
  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Body;
  if (!body?.prompt || !body?.systemPrompt)
    return bad(400, 'prompt dan systemPrompt diperlukan');

  // 4. Streaming dari Gemini — teks dihantar terus ke pelayar sambil terjana
  const models = [MODEL, ...FALLBACK_MODELS];
  let gres: Response | null = null;
  let usedModel = '';
  for (const model of models) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: body.systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: body.prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            thinkingConfig: { thinkingBudget: 0 },  // matikan pemikiran — keluaran pantas
          },
        }),
      }
    );
    if (r.ok && r.body) { gres = r; usedModel = model; break; }
    if (r.status !== 503 && r.status !== 429) {
      return bad(502, `UPSTREAM_ERROR (${r.status}): ${(await r.text()).slice(0, 300)}`);
    }
    // 503/429 — cuba model seterusnya
  }
  if (!gres || !gres.body) return bad(503, 'Semua model AI sedang sibuk. Cuba semula sebentar.');

  // 5. Hantar stream ke pelayar
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'no-cache');
  res.status(200);

  const decoder = new TextDecoder();
  const reader = gres.body.getReader();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Semua baris `data: {...}` dari SSE — ekstrak teks dan hantar
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const payload = JSON.parse(line.slice(6));
          const parts = payload?.candidates?.[0]?.content?.parts ?? [];
          for (const p of parts) {
            if (p.text) res.write(p.text);
          }
        } catch { /* baris separuh — biar */ }
      }
    }
    res.end();
  } catch (e: any) {
    try { res.end('\n[STREAM TERPUTUS]'); } catch { /* abaikan */ }
  }
}
