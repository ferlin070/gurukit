# Operasi production GuruKit

Pemilik operasi/sokongan: **ghazwahgroup@gmail.com**. Penghantar transaksi yang disasarkan: **noreply@ghazwahgroup.com**. Dokumen ini membezakan fungsi yang tersedia daripada prasyarat luaran; ia bukan pengesahan kesiapsiagaan institusi atau SLA.

## Kawalan trafik dan kos

Migrasi `20261112090000_production_controls.sql` menambah kawalan service-role sahaja:

- 1 janaan aktif bagi setiap akaun; 10 aktif seluruh aplikasi.
- 6 permintaan sah bagi setiap akaun dalam satu bucket minit. Permintaan Pro tanpa kelayakan turut melalui had ini.
- 500 percubaan model sehari seluruh aplikasi, mengikut Malaysia. Setiap fallback turut menggunakan budget. Permintaan gagal tidak memulangkan budget percubaan, supaya kegagalan tidak boleh digunakan untuk panggilan AI tanpa had.
- Kuota pelan pengguna sedia ada dikekalkan. Kegagalan terkawal memulangkan tempahan kuota pengguna sekali sahaja.
- Had percubaan ialah kawalan penggunaan, **bukan had perbelanjaan RM/USD atau pengganti budget Google Cloud**. Harga/tokens sebenar bergantung pada model dan bil penyedia.
- `generation_enabled=false` menghentikan penjanaan baharu dan fallback dengan segera. Bacaan dokumen kekal tersedia.

Ubah had melalui SQL Editor pentadbir sahaja, contohnya:

```sql
select * from public.production_limits;
-- Hentikan penjanaan ketika insiden:
update public.production_limits set generation_enabled=false where id=true;
-- Pulihkan selepas semakan:
update public.production_limits set generation_enabled=true where id=true;
```

Jangan beri pengguna hak menulis jadual operasi. Kawalan ini bukan perlindungan DDoS lengkap atau pengganti rate limit/CAPTCHA pada Supabase Auth. CAPTCHA memerlukan site key/secret dan semakan UX sebelum diaktifkan.

## Pemantauan

- `GET /api/health`: status minimum dan versi; memeriksa database serta ketersediaan budget/penjanaan. Ia **tidak membuat panggilan Gemini berbayar**, dan tidak membuktikan Google AI tersedia. Respons sihat boleh dicache selama 30 saat.
- `GET /api/ops-status`: ringkasan pentadbir, dilindungi `Authorization: Bearer $CRON_SECRET`. Gunakan `node scripts/ops/status.mjs` setelah binding tersedia secara selamat; jangan tampal secret ke dalam command/log/chat.
- Log Vercel dan `operational_events` merekodkan kod, alat, request ID dan tempoh; bukan prompt, hasil, e-mel, password atau token. Ralat UI berautentikasi menerima maksimum 6 laporan sejam; badan mesej/stack tidak diterima.
- GitHub workflow `uptime.yml` disediakan untuk semakan setiap 5 minit dan semasa push. GitHub schedules adalah best-effort dan boleh dilewatkan/dinyahaktifkan apabila repo lama tidak aktif. Ini bukan monitor bebas dengan SLA. Notifikasi GitHub bergantung pada tetapan akaun GitHub.
- Workflow `ci.yml` menjalankan ujian, build, audit dan drill PostgreSQL terasing. Build Vercel sendiri juga menjalankan ujian supaya ujian gagal tidak menerbitkan deployment baharu. Perlindungan branch/semakan PR belum dikuatkuasakan kerana aliran semasa menggunakan push ke main.
- Endpoint operasi dan laporan UI menggunakan kod tetap untuk mengelakkan kebocoran data. Jangan menambah `console.log(req.body)` atau log keseluruhan environment.

Amaran e-mel melalui Resend hanya berfungsi apabila domain disahkan dan `RESEND_API_KEY`, `MAIL_FROM`, `ALERT_EMAIL` wujud pada Vercel deployment aktif. Job harian boleh memberi amaran kegagalan backup atau lonjakan ralat; ia bukan paging segera 24 jam. Tiada amaran e-mel didakwa aktif tanpa binding tersebut.

## Backup aplikasi terenkripsi

`/api/operations` dijadualkan **20:00 UTC / 4:00 pagi MYT** setiap hari oleh Vercel Cron. Ia dilindungi `CRON_SECRET`; Vercel menyediakan header tersebut apabila secret dikonfigurasi. Trigger manual: `node scripts/ops/run-daily.mjs` dengan secret dalam environment selamat. Job idempoten bagi tarikh Malaysia; job yang telah selesai tidak ditindih oleh panggilan berulang.

Snapshot satu database statement merangkumi lima jadual aplikasi: `profiles`, `quota_usage`, `saved_documents`, `rph_templates`, `question_banks`. Had saiz ialah sekitar 8 MiB. Data dimampatkan dan dienkripsi **AES-256-GCM** menggunakan `BACKUP_ENCRYPTION_KEY`, kemudian disimpan dalam bucket **private** `gurukit-backups`. Fail dibaca semula, didekripsi dan hash dibandingkan sebelum ditandakan berjaya. Maksimum 7 hari fail harian diputar; kegagalan job boleh melengahkan pemadaman.

**Pengecualian penting:** snapshot ini tidak merangkumi password/identiti/sesi Supabase Auth, schema database, fail Storage, tetapan penyedia atau secrets. Ia bukan `pg_dump`, PITR atau backup penuh Supabase. Bucket berada dalam projek Supabase yang sama; ia **bukan salinan offsite** dan tidak bertahan jika projek keseluruhan dipadam. Backup asli yang boleh dipulihkan belum disenaraikan oleh API semasa semakan; PITR tidak aktif. Sediakan native backup/pg_dump serta storan bebas untuk pemulihan bencana penuh sebelum rollout besar.

Kunci enkripsi disimpan dalam Vercel environment, berasingan daripada ciphertext Supabase. Operator perlu menyimpan salinan kunci dalam vault bebas yang diluluskan. Jangan putar kunci tanpa merancang pemulihan arkib lama; kehilangan kunci menyebabkan arkib tidak boleh dibaca.

Muat turun ciphertext ke lokasi private di luar checkout:

```sh
# SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY dan BACKUP_ENCRYPTION_KEY perlu tersedia melalui pengurusan secrets.
node scripts/ops/download-backup.mjs /laluan/private/backup
node scripts/ops/restore-drill.mjs /laluan/private/backup/app-YYYY-MM-DD.enc
```

Drill hanya mencipta PostgreSQL Docker sementara pada loopback, memuatkan schema repo, memulihkan jadual aplikasi dan membandingkan data. Ia tidak mempunyai pilihan target database production. Auth dalam drill ialah stub UUID, bukan pemulihan login Supabase; pemulihan Auth sebenar masih memerlukan backup platform yang sesuai. Container dipadam selepas ujian. Jangan pulihkan terus ke live sebelum semakan versi schema, salinan keselamatan tambahan dan pelan rollback.

Metadata janaan/log sekitar 30 hari, bucket rate 2 hari dan agregat operasi sehingga 90 hari dipangkas selepas backup berjaya. Dokumen, bank dan profil pengguna tidak dipadam berdasarkan umur. Permintaan pemadaman akaun perlu pengesahan pemilik dan semakan polisi backup.

## SMTP Resend percuma — langkah operator yang masih diperlukan

1. Daftar akaun Resend. Tambah **ghazwahgroup.com**, atau benarkan skrip mengadakannya menggunakan key dengan akses setup domain. Free plan mempunyai had penghantaran; semak had semasa sebelum onboarding ramai guru.
2. Masukkan **RESEND_API_KEY** dalam environment settings Codex secara selamat. Keperluan ini sudah ditambah dalam draf. Review, Save, kemudian Publish environment apabila chat setup idle supaya binding tersedia; simpanan draf sahaja tidak menyuntik key ke proses semasa.
3. Jalankan `node scripts/ops/configure-resend.mjs` dengan binding Vercel dan Supabase sedia ada. Skrip hanya menambah rekod Resend untuk `send`, `resend._domainkey` dan CNAME `rsend`, tidak menggantikan A/ALIAS/MX root. Konflik DNS dihentikan untuk semakan. DNS DMARC asas `p=none` sudah disediakan; ini belum polisi penolakan/quarantine.
4. Selepas domain Resend berstatus verified, skrip menetapkan SMTP Supabase (`smtp.resend.com`, port 465, pengguna `resend`, sender `noreply@ghazwahgroup.com`) dan menyimpan key alert ke Vercel. Deploy semula Vercel untuk mengaktifkan alert. Jangan aktifkan SMTP dengan domain belum disahkan.
5. Buat ujian pengesahan/pemulihan dan periksa penerimaan sebenar, bukan sekadar respons API. Tiada e-mel ujian dihantar secara automatik oleh skrip setup. Penerima operator telah ditetapkan kepada `ghazwahgroup@gmail.com`.

Tanpa API key dan pengesahan domain, SPF/DKIM Resend, SMTP dan penghantaran amaran **belum siap**. Tetapan asal e-mel Supabase dikekalkan sehingga prasyarat sah.

## Insiden ringkas

1. Semak `/api/health`, log Vercel, status Supabase dan versi deployment. Catat masa MYT serta kod, jangan salin data pelajar.
2. Jika penyalahgunaan/kos meningkat, matikan penjanaan melalui `production_limits`; semak `daily_model_budget` dan status kuota. Jangan padam data penggunaan untuk menyembunyikan masalah.
3. Jika deployment rosak, pilih deployment sebelumnya yang diketahui baik di Vercel. Migrasi bersifat tambahan; semak keserasian RPC sebelum rollback aplikasi. Jangan mengembalikan hak edit pelan/kuota kepada pengguna.
4. Jika kehilangan data aplikasi, hentikan writes yang berkaitan, semak arkib dan jalankan drill terasing dahulu. Dapatkan keputusan operator sebelum sebarang pemulihan live.
5. Maklumkan guru melalui alamat sokongan yang ditetapkan; jangan dedahkan identiti pelajar atau kandungan dokumen dalam laporan insiden.

## Gerbang rollout MRSM

Rintis 5–10 guru daripada beberapa subjek dan tingkatan. Semak login/e-mel, bahan KSSM/DSKP, DLP, RPH maktab, soalan/JSU, Word dan aliran gagal. Gunakan ID peserta, bukan senarai pelajar sebenar. Rekod maklum balas serta keputusan panel; ujian automatik tidak mengesahkan kandungan pedagogi. Ujian DB serentak dan smoke HTTP ringan bukan ujian kapasiti semua maktab atau SLA institusi.
