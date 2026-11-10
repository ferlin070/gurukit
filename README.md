# GuruKit 🎓 — Suite AI untuk Guru Malaysia

Sistem penuh ala "AI Asisten Guru" tetapi untuk pasaran Malaysia: Bahasa Melayu,
KSSM/DSKP, kuota harian, plan Free/Pro, AI Gemini dipanggil server-side.

## Struktur

```
gurukit/
├── api/generate.ts        # Vercel function: JWT + kuota atomik + Gemini (key server)
├── supabase/schema.sql    # profil, kuota harian, dokumen, RLS, trigger auto-profil
├── src/
│   ├── data/tools.js      # 13 modul alat: systemPrompt master + buildPrompt
│   ├── lib/               # supabase client + api.js (generate, kuota)
│   ├── context/AuthContext.jsx  # auth sebenar Supabase
│   └── pages/             # Landing, Login, Signup, Dashboard, ToolRunner
├── docs/DEPLOY.md         # panduan deploy langkah demi langkah
└── .env.example
```

## 13 Alat

Free (7): RPH KSSM · Soalan Peperiksaan · e-Pembetulan Karangan · Nota Ringkas ·
i-Think · Surat Rasmi · Teks Ucapan
Pro (6): Rubrik PBD · Aktiviti PdPc Digital · Kerja Kursus · Analisis Prestasi ·
Bahan Diferensiasi · Latihan HOTS

## Jalankan

```bash
npm install
cp .env.example .env.local   # isi nilai sebenar
npm run dev                  # http://localhost:5173
```

Deploy: ikut `docs/DEPLOY.md` (Supabase → Vercel → env vars). Build sudah disahkan:
`npm run build` ✓

## Aliran janaan

Pengguna isi borang → `tool.buildPrompt(values)` + `tool.systemPrompt` →
`POST /api/generate` (Bearer JWT) → Supabase sahkan token → RPC `consume_daily_quota`
(atomik, tolak 429 bila habis) → Gemini `gemini-2.5-flash` → teks pulang ke ToolRunner.
