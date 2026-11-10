# GuruKit — Panduan Deploy (Malaysia, BM/KSSM)

Sistem penuh: frontend React + backend Supabase + proxy AI Gemini di Vercel.

## 1. Prasyarat
- Akaun GitHub (untuk deploy Vercel)
- Akaun Supabase (free tier) — https://supabase.com
- Akaun Vercel (free tier) — https://vercel.com
- Gemini API key — https://aistudio.google.com/app/apikey

## 2. Supabase
1. New project → pilih region `Singapore` (paling laju untuk Malaysia).
2. Buka **SQL Editor** → tampal keseluruhan `supabase/schema.sql` → **Run**.
3. Salin dari **Settings → API**:
   - `Project URL` → ini `SUPABASE_URL` & `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (RAHSIA — jangan dedahkan)
4. **Authentication → Providers → Email**: aktifkan. Untuk fasa ujian, matikan
   "Confirm email" supaya pendaftaran terus masuk.

## 3. Vercel
```bash
npm install
npm run dev          # ujian tempatan — wajib isi .env.local dahulu
cp .env.example .env.local   # isi nilai sebenar
```
Deploy:
```bash
npm i -g vercel
vercel
```
Dalam **Vercel → Project → Settings → Environment Variables**, tambah:
| Nama | Nilai |
|---|---|
| VITE_SUPABASE_URL | URL Supabase |
| VITE_SUPABASE_ANON_KEY | anon key |
| SUPABASE_URL | URL Supabase |
| SUPABASE_SERVICE_ROLE_KEY | service role key |
| GEMINI_API_KEY | key Gemini |

Redeploy selepas isi env.

## 4. Kos operasi
- Vercel free: 100k function calls/bulan — cukup untuk ribuan jana/bulan
- Supabase free: 500MB DB, 50k MAU
- Gemini API: anda yang bayar — kawal melalui kuota harian dalam `profiles.daily_quota`.
  Free plan 5 jana/hari × ~10k token ≈ kos sifar hingga beberapa sen per pengguna.

## 5. Naik taraf plan (Pro)
Set `profiles.plan = 'pro'` + `daily_quota = 100` untuk pelanggan bayar.
Integrasi bayaran: Billplz / Stripe / Lynk.id — webhook set plan selepas pembayaran
(nak saya sambung bila anda bersedia).

## 6. Custom domain
Vercel → Domains → tambah domain anda → arahkan CNAME ke Vercel.
