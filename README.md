# GuruKit — ruang kreatif guru MRSM

Vite + React, Supabase Auth/Postgres dan Vercel API yang menjana bahan KSSM/DSKP melalui Gemini secara berstreaming. 16 alat termasuk RPH, pentaksiran, nota, prep asrama dan Homeroom. Bahasa Melayu sebagai lalai, pilihan Bahasa Inggeris untuk DLP.

## Pembangunan

Gunakan Node 22.12+ (Node 24 disahkan). Isi nilai penuh dalam `.env.local` yang diabaikan Git; jangan masukkan token atau kunci ke dalam kod. Contoh nama pemboleh ubah dalam `.env.example`.

```sh
npm ci --cache /workspace/.npm-cache # dalam cloud; npm ci biasa pada mesin sendiri
npm run dev:api  # terminal 1: API tempatan pada port 3001
npm run dev      # terminal 2: Vite, proxy /api ke port 3001
npm test
npm run build
```

Di cloud yang memerlukan proxy HTTP, gunakan `NODE_USE_ENV_PROXY=1` pada Node 24 dengan tetapan proxy dan CA sedia ada. Jangan lumpuhkan TLS. `npm run dev` sahaja tidak menyediakan fungsi API; jalankan kedua-dua proses. Pembinaan laman statik memerlukan hanya pemboleh ubah `VITE_`; backend memerlukan `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` dan `GEMINI_API_KEY`.

## Pangkalan data

Untuk projek baharu sahaja, jalankan `supabase/schema.sql`, kemudian migrasi `supabase/migrations/20261112_mrsm_security.sql`. Untuk projek sedia ada, jalankan migrasi sahaja, sekali. Jangan jalankan semula skema asas ke atas data sedia ada.

Tetapkan Site URL Supabase kepada domain production dan benarkan laluan `/dashboard` serta `/reset-password` pada domain itu. Gunakan SMTP produksi sebelum onboarding ramai guru. Nilai sebenar kekal dalam tetapan Supabase/Vercel, bukan README.

## Aliran penjanaan

Browser menghantar `toolId`, `values` dan `context`; pelayan mengesahkan JWT, input dan pelan, membina prompt yang dipercayai, menempah kuota atomik MYT, lalu menstrim acara SSE `meta`, `delta`, `done` atau `error`. Hanya hasil selesai boleh disimpan. Kegagalan terkawal memulangkan kuota sekali; tempahan yang ditinggalkan runtime dipulihkan selepas 5 minit pada semakan/tempahan seterusnya.

Pustaka dokumen menggunakan RLS pemilik. Guru perlu menyemak fakta dan standard sebenar. Jangan masukkan nama penuh atau data sensitif pelajar; alat markah memerlukan ID samaran.

Lihat [audit MRSM](docs/AUDIT-MRSM.md) untuk penemuan, bukti pengujian dan batasan. Deploy melalui push ke `main` → Vercel; sahkan deployment bagi commit tersebut READY sebelum melaporkan selesai.

Pakej Word, templat RPH maktab dan bank soalan/JSU: lihat [panduan penggunaan](docs/TEACHING-PACK.md). Untuk pemasangan baharu, jalankan juga migrasi `supabase/migrations/20261112060000_teaching_pack.sql` selepas migrasi keselamatan MRSM.
