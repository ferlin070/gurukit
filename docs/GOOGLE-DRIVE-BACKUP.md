# Backup GuruKit ke Google Drive Gmail biasa

Integrasi sudah disediakan dalam job operasi harian tetapi **tidak aktif sehingga OAuth disambungkan**. Ia tidak memerlukan Google Workspace atau service account. Google Drive API menggunakan kuota akaun Google anda; pastikan ruang mencukupi. OAuth ini ialah sambungan operator backup, bukan perubahan kaedah login guru.

## Sambungan pertama oleh pemilik Gmail

1. Buka [Google Cloud Console](https://console.cloud.google.com/), cipta/pilih projek **GuruKit Backup**, kemudian **APIs & Services → Library → Google Drive API → Enable**.
2. Buka **Google Auth Platform** (atau **OAuth consent screen**). Lengkapkan Branding menggunakan nama **GuruKit Backup** dan e-mel operator. Audience ialah **External** untuk Gmail biasa. Tambah akaun Gmail operator sebagai test user jika masih dalam Testing.
3. Pada **Data Access**, tambah satu scope sahaja: `https://www.googleapis.com/auth/drive.file`. Ia membenarkan fail yang dicipta/dibenarkan untuk aplikasi; jangan pilih scope seluruh Drive (`drive`). Folder backup akan dicipta oleh integrasi, jadi Google Picker/folder sedia ada tidak diperlukan.
4. Cipta OAuth client pada **Clients → Create client → Web application**. Authorized redirect URI mesti tepat: `https://developers.google.com/oauthplayground`. Simpan Client ID dan Client secret secara selamat.
5. Untuk operasi berterusan, ubah publishing status kepada **In production** sebelum mendapatkan token akhir. Aplikasi External dalam **Testing** dengan akses Drive lazimnya menghasilkan refresh token yang tamat selepas 7 hari. Scope `drive.file` ialah non-sensitive; ikut apa-apa keperluan tambahan yang Google paparkan. Ini tidak memerlukan aplikasi dibuka kepada semua guru.
6. Buka [Google OAuth Playground](https://developers.google.com/oauthplayground/). Klik ikon tetapan, aktifkan **Use your own OAuth credentials**, masukkan Client ID/secret tadi dan pastikan access type **Offline**. Menggunakan credentials sendiri penting supaya token tidak bergantung pada client kongsi Playground yang tokennya boleh ditarik semula secara automatik.
7. Dalam Step 1, masukkan scope tepat `https://www.googleapis.com/auth/drive.file`, klik **Authorize APIs** dan log masuk menggunakan Gmail yang akan menyimpan backup. Semak nama aplikasi dan skop kebenaran sebelum membenarkan.
8. Dalam Step 2, klik **Exchange authorization code for tokens**. Salin **Refresh token** ke pengurusan secrets. Jika tiada refresh token, buat consent semula dengan offline access; jangan guna access token jangka pendek sebagai pengganti.
9. Dalam **Vercel → GuruKit → Settings → Environment Variables**, tambah tiga entri untuk **Production**:

| Nama                         | Nilai                                        |
| ---------------------------- | -------------------------------------------- |
| `GOOGLE_DRIVE_CLIENT_ID`     | OAuth Client ID sendiri                      |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Client secret sendiri                        |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Refresh token daripada consent Gmail sendiri |

Client secret dan refresh token boleh/sangat sesuai ditandakan **Sensitive**. Backend Vercel membacanya sendiri; operator tidak perlu membenarkan assistant membaca nilainya. Jangan gunakan awalan `VITE_`, masukkan dalam repo atau tampal dalam chat. OAuth client/secret mesti pasangan yang sama ketika token diperoleh dan semasa refresh.

10. Redeploy production. Operator boleh jalankan `node scripts/ops/run-daily.mjs` dengan `CRON_SECRET` daripada secret manager. Jika backup Supabase hari itu sudah selesai, job mencuba salinan Drive menggunakan ciphertext sedia ada; ia tidak menghasilkan semula snapshot utama. Status `offsite.status=verified` membuktikan muat naik dan readback terdekripsi disemak. `googleDriveConfigured=true` di ops-status hanya membuktikan binding lengkap, bukan upload berjaya.

## Kelakuan backup

- Job sedia ada berjalan 4 pagi MYT. Folder **GuruKit Backups** dicipta dalam My Drive akaun yang memberikan consent; nama folder bukan rahsia. Jangan kongsi folder secara public.
- Fail `gurukit-daily-YYYY-MM-DD.enc` mengandungi ciphertext AES-256-GCM sahaja. Kunci `BACKUP_ENCRYPTION_KEY` tidak dihantar ke Google Drive. Data didekripsi hanya dalam memori untuk semakan.
- Setiap Ahad, satu fail `gurukit-weekly-YYYY-MM-DD.enc` turut disimpan. Retention mengekalkan 7 tarikh harian dan 4 tarikh mingguan terbaru yang berjaya dihasilkan; archive mingguan memerlukan beberapa minggu untuk mencapai empat salinan.
- Integriti diperiksa melalui checksum ciphertext, kemudian muat turun semula dan pengesahan AES-GCM serta digest snapshot sebelum retention. Cubaan semula sehari menggunakan fail sedia ada jika kandungannya sama; konflik kandungan tidak ditindih.
- Hanya archive bertag aplikasi, dengan nama dikenali, dalam folder aplikasi ini ditandakan `trashed`. Fail lain tidak diubah. Fail di Trash masih boleh mengambil ruang sehingga dikosongkan/mengikut polisi Google. Tiada pemadaman kekal automatik.
- Kegagalan Drive tidak menukar backup Supabase yang berjaya kepada gagal. Job melaporkan `offsite.status=failed` dan cuba amaran Resend dengan kod `DRIVE_BACKUP_FAILED`; tiada token atau data guru dalam amaran. Cubaan semula tersedia melalui job manual pada hari sama. Gangguan beberapa hari masih boleh menyebabkan jurang salinan offsite.
- Menarik balik consent, memadam OAuth client, menukar ke Testing atau kehilangan ruang Drive boleh menghentikan automasi. Semak status job/amaran dan buat drill berkala.

## Skop dan pemulihan

Salinan ini merangkumi **lima jadual aplikasi sahaja**, sama seperti backup utama: profil, kuota, dokumen, templat RPH dan bank soalan. Ia masih tidak merangkumi password/sesi Supabase Auth, schema lengkap, fail Storage lain atau tetapan penyedia. Backup penuh Supabase masih perlu disediakan.

Untuk drill offsite, muat turun satu `.enc` terus daripada folder Drive ke lokasi private di luar checkout. Dengan `BACKUP_ENCRYPTION_KEY` daripada vault bebas:

```sh
node scripts/ops/restore-drill.mjs /laluan/private/gurukit-daily-YYYY-MM-DD.enc
```

Drill memulihkan ke PostgreSQL Docker sementara sahaja. Kehilangan kunci menyebabkan fail Drive tidak boleh dipulihkan. Simpan salinan kunci dalam vault bebas yang diluluskan; jangan muat naik kunci ke folder backup.
