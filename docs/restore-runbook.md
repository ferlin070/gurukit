# Runbook Pemulihan Backup Supabase GuruKit

Dikemas kini: 2026-11-12. Pemilik: ghazwahgroup / ferlin070.

## Komponen

| Komponen | Lokasi |
|---|---|
| Runner backup berjadual | GitHub Actions `ferlin070/gurukit` → `.github/workflows/supabase-backup.yml` (cron 04:00 MYT) |
| Runner drill pemulihan | `.github/workflows/restore-drill.yml` (`workflow_dispatch`) |
| Backup offsite | Google Drive folder **GuruKit Backups** (akaun ghazwahgroup@gmail.com) |
| Projek production | Supabase `vcgtprwwkxefjfcqfovz` (gurukit, ap-southeast-1, PG 17.11) |
| Projek drill | Supabase `qghoyrhxvceualpjtzzd` (gurukit-restore-drill, ap-southeast-2) — **pause antara drill** |
| Backup Vercel app-level | Job sedia ada (`scripts/ops/run-daily.mjs`), env Vercel Production |

## Secrets (GitHub repo `ferlin070/gurukit`, encrypted)

`SUPABASE_DB_URL`, `BACKUP_ENCRYPTION_KEY`, `GOOGLE_DRIVE_CLIENT_ID`,
`GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`,
`CANARY_EMAIL`, `CANARY_PASSWORD`, `DRILL_DB_URL`, `DRILL_ANON_KEY`, `DRILL_SERVICE_ROLE`.

Secret Vercel TIDAK dikongsi ke runner lain. Nilai connection string / kunci / password
tidak pernah melalui chat atau repo.

## Format enkripsi

- Bekas: `GKBK1` (5 bait) + IV 12 bait + ciphertext + GCM tag 16 bait.
- Kunci: `scrypt(secret BACKUP_ENCRYPTION_KEY, salt 'gurukit-backup-v1', 32 bait)`.
- IV deterministik: HMAC-SHA256(kunci, `'gurukit-iv:' + nama_fail`) → run semula
  menghasilkan ciphertext yang sama (idempoten).

## Kandungan satu set backup harian

| Fail | Kandungan |
|---|---|
| `gurukit-supabase-full-YYYY-MM-DD.enc` | `pg_dump` PG17 custom format — schema `public` + `auth` + `storage` (data penuh, termasuk hash kata laluan & identiti; role password hash dikecualikan) |
| `gurukit-roles-YYYY-MM-DD.enc` | snapshot `CREATE ROLE` (bukan-sistem) |
| `gurukit-authnote-YYYY-MM-DD.enc` | metadata: bilangan users/identities/MFA, buckets, status canary |
| `gurukit-manifest-YYYY-MM-DD.json` | manifest set: nama fail + sha256 ciphertext + bilangan objek TOC. **Set sah = manifest wujud.** |

Fail aplikasi `gurukit-daily-*.enc` (backup Vercel app-level) berasingan — tidak disentuh.

## Verifikasi selepas setiap backup (dalam workflow)

1. Readback setiap .enc dari Drive → sha256 ciphertext sepadan.
2. AES-GCM decrypt → digest plaintext sepadan dengan fail asal.
3. `pg_restore --list` pada dump yang didengripsi berjaya.
4. Retention: 7 set harian + 4 set Ahad (mingguan); hanya set lengkap bertag di atas;
   fail lama ditandakan trashed HANYA selepas set hari ini disahkan.

## Prosedur pemulihan penuh (bencana)

1. Cipta projek Supabase baharu (region sama, PG 17). Dapatkan session pooler URL
   (Connect → Session pooler) + anon/service_role key.
2. Kemas kini secret `DRILL_DB_URL`, `DRILL_ANON_KEY`, `DRILL_SERVICE_ROLE`
   dan `ALLOWED_DRILL_REF` (dalam kedua-dua workflow) kepada ref baharu.
3. Jalankan `restore-drill.yml` (workflow_dispatch). Ia akan:
   - sahkan sasaran bukan production dan hanya ref drill dibenarkan,
   - muat turun dump terkini, sahkan sha256 dengan manifest set,
   - decrypt AES-GCM,
   - `pg_restore` dua laluan (auth.users data dahulu → sessions → baki),
   - selaraskan sequence (serial + identity) mengikut max id,
   - bandingkan jumlah baris semua jadual auth/public/storage dengan manifest
     dump (docker Postgres sementara) — apa-apa beza = gagal,
   - uji login **canary** (`canary-backup@ghazwahgroup.com`) melalui GoTrue
     projek terpulih — HTTP 200 + UUID sepadan, TANPA mencipta/menetapkan semula.
4. Untuk pemulihan production sebenar: ulangi langkah 1-3, kemudian tukar
   `VITE_SUPABASE_URL`/`SUPABASE_URL` + keys di Vercel ke projek baharu dan redeploy.
5. Jalankan migrasi aplikasi (jika perlu) untuk mencipta semula trigger app
   (contoh `handle_new_user` pada auth.users — sengaja dikecualikan dari restore).

## Pengecualian (belum dilindungi pipeline ini)

- Fail Storage S3 sebenar (kandungan bucket `gurukit-backups`).
- Tetapan dashboard Auth: SMTP credentials, OAuth provider client secrets,
  redirect URLs. Eksport manual dari dashboard diperlukan.
- Hash kata laluan roles database.

## Canari

- Akaun `canary-backup@ghazwahgroup.com` wujud kekal di production.
- Password rawak disimpan di secret `CANARY_PASSWORD`.
- Backup metadata step mengesahkan canary ada sebelum dump diambil.

## Nota operasi

- Projek Supabase Free: had 2 projek aktif. Untuk drill: pause projek ketiga
  (kini tvetmara-feedback) → resume projek drill → jalankan drill → pause drill
  → resume semula. Workflow drill menunggu projek dalam talian sehingga ~7 minit.
- Drill berulang pada projek yang sama disokong (pre-clean TRUNCATE cascade +
  drop trigger app), tetapi projek segar adalah lebih bersih.
- Amaran kegagalan: semak tab Actions; summary langkah menyenaraikan sebab.
