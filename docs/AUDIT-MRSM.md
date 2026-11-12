# Audit dan naik taraf GuruKit untuk MRSM

Tarikh: 12 November 2026 (Malaysia). Sasaran: semua guru MRSM, KSSM/DSKP sebagai asas lalai.

Pakej Word, templat RPH dan bank soalan/JSU ditambah selepas audit asas ini. Lihat [panduan pakej pengajaran](TEACHING-PACK.md) untuk ciri dan batasan terkini.

## Penemuan sebelum pembaikan

| Tahap     | Penemuan yang disahkan                                                                                                         | Pembaikan                                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kritikal  | Polisi profil membenarkan UPDATE lajur `plan` dan `daily_quota` oleh pemilik akaun. RLS baris tidak melindungi lajur tersebut. | Hak UPDATE dihadkan kepada `full_name` dan `teaching_context`. Pelan dan kuota hanya boleh diurus pentadbir.                                                                                              |
| Tinggi    | API menerima `systemPrompt` dan `prompt` daripada browser serta tidak menguatkuasakan pelan Pro.                               | Pelayan membina prompt daripada alat yang dikenali, nilai borang yang disahkan dan konteks MRSM. Pelan Pro disahkan di pelayan sebelum kuota ditempah.                                                    |
| Tinggi    | Input disahkan selepas kuota ditolak; permintaan salah dan kegagalan model menggunakan kuota.                                  | Pengesahan dahulu; tempahan atomik, pemuktamadan kejayaan dan pemulangan idempoten untuk kegagalan terkawal.                                                                                              |
| Tinggi    | Aliran terputus, kosong atau tamat had token boleh kelihatan seperti kejayaan.                                                 | SSE berstruktur (`meta`, `delta`, `done`, `error`), had masa, pembatalan, pengesanan `STOP`/`MAX_TOKENS` dan status hasil separa. Hasil separa tidak boleh disimpan sebagai dokumen lengkap.              |
| Sederhana | Paparan kuota menggunakan tarikh UTC dan menyembunyikan ralat sebagai nilai lalai.                                             | RPC mengembalikan tarikh/kuota waktu Malaysia dan UI memaparkan ralat serta pilihan cuba semula.                                                                                                          |
| Sederhana | Supabase Auth `site_url` ialah localhost dan senarai redirect kosong. Pengesahan e-mel diperlakukan seperti pendaftaran gagal. | Domain production dan redirect khusus disediakan; UI pendaftaran mengarahkan pengguna menyemak e-mel. Laluan pemulihan kata laluan ditambah.                                                              |
| Sederhana | Jadual dokumen tersedia tetapi tiada aliran simpan/buka/cetak dalam aplikasi.                                                  | Pustaka dokumen per pengguna, carian tajuk, simpan, baca semula, cetak/PDF, Markdown dan pemadaman dengan pengesahan. RLS sedia ada dikekalkan.                                                           |
| Sederhana | Analisis markah meminta nama dan menyarankan band/gred generik.                                                                | Input ID samaran, pengiraan deterministik, larangan menukar markah kepada gred/TP rasmi tanpa rubrik.                                                                                                     |
| Sederhana | Kandungan generik merujuk LINUS/MASTIS dan tidak membezakan kelas, prep atau Homeroom.                                         | Konteks MRSM pada semua alat, pembezaan menengah, DLP, STEM, standard rujukan guru dan dua alat khusus.                                                                                                   |
| Pelbagai  | `npm audit` melaporkan 15 isu (5 tinggi, 9 sederhana, 1 rendah).                                                               | Vite/React plugin dan React Router dikemas kini; `@vercel/node` yang hanya digunakan untuk jenis TypeScript dibuang. API menggunakan runtime Vercel sedia ada. Audit selepas pemasangan melaporkan 0 isu. |

Semakan production selepas deployment turut mengesan `PROFILE_UNAVAILABLE` pada klien pelayan, walaupun JWT pengguna sah. Binding `SUPABASE_SERVICE_ROLE_KEY` production diselaraskan menggunakan kunci service-role yang disahkan daripada projek Supabase berkenaan, kemudian digunakan pada deployment baharu. Kunci tidak disimpan dalam kod atau laporan.

## Fungsi MRSM

- 13 alat asal dikekalkan; Rancangan Prep MRSM dan Aktiviti Homeroom MRSM ditambah (15 keseluruhan).
- Profil pengajaran disimpan dalam Supabase: maktab, program, tingkatan 1–5, subjek, bahasa, bilangan pelajar, suasana, keperluan sokongan serta standard/rujukan dan kemudahan.
- KSSM ialah lalai. Pilihan Premier, Ulul Albab, IGCSE, Teknikal dan program lain hanya konteks; bukan pensijilan pematuhan silibus. Guru mesti membekalkan rujukan program/DSKP sebenar.
- DLP menghasilkan bahan berbahasa Inggeris apabila dipilih. Jangan anggap semua MRSM menggunakan DLP atau program yang sama.
- RPH dan aktiviti mengutamakan objektif terukur, pengayaan/KBAT, kemudahan sebenar, keselamatan makmal serta semakan guru.
- Homeroom tidak membuat diagnosis atau meminta pendedahan maklumat sulit pelajar.
- Analisis markah menerima `P001, 78` hingga 100 baris, markah 0–100. Pengiraan min, median, minimum dan maksimum dilakukan oleh kod.

Rujukan konteks institusi yang diperiksa: [MARA — Program Sistem Pendidikan MRSM](https://www.mara.gov.my/?page_id=5047), termasuk penekanan STEM dan pembangunan Homeroom. Ini bukan pengesahan silibus, rubrik atau format rasmi oleh MARA.

## Reka bentuk kuota dan keselamatan data

`reserve_generation` menserialkan permintaan pada profil pengguna, menggunakan tarikh `Asia/Kuala_Lumpur`, dan menaikkan penggunaan secara atomik. Setiap permintaan mempunyai ID unik; `finish_generation` hanya boleh memuktamad atau memulangkan satu kali. RPC tempahan/pemuktamadan dan jadual permintaan hanya boleh dicapai peranan pelayan. JWT pengguna disahkan secara eksplisit; klien pentadbiran tidak diganti dengan header JWT pengguna.

Permintaan yang terhenti keras sebelum pemulangan dipulihkan selepas 5 minit apabila kuota pengguna disemak atau tempahan baharu dibuat. Ini pemulihan tertunda, bukannya jaminan pemulangan serta-merta apabila runtime dihentikan. Tempahan serentak ditertibkan oleh kunci profil dalam transaksi; ini bukan ujian beban berskala institusi.

Teks input dan hasil dihantar kepada Gemini untuk penjanaan. Jangan masukkan identiti atau maklumat sensitif pelajar. Dokumen tidak dikongsi antara akaun. Markdown tidak membenarkan HTML mentah, imej jauh atau URL skrip; paparan HTML yang dijana tidak dijalankan sebagai kod.

Migrasi idempoten: `supabase/migrations/20261112_mrsm_security.sql`. `supabase/schema.sql` asal tidak diubah. Tiada akaun, markah atau dokumen sedia ada dipadam oleh migrasi. Langkah pelaksanaan mengekalkan RPC lama untuk deployment lama sehingga API baharu READY, kemudian menarik semula kebenaran legasi.

## Bukti pengujian

- `npm test`: 38 ujian regresi untuk semua 15 definisi alat, pengesahan input, prompt dipercayai, akses Pro, JWT, tarikh Malaysia, pengiraan markah, parser SSE, fallback, pemulangan kuota dan pembatalan.
- Ujian SQL dalam transaksi yang di-rollback: pengasingan dua pengguna, larangan menukar pelan/kuota, dokumen silang akaun, had kuota, pemulangan berulang, pemulihan tempahan luput dan tarikh MYT. Pengguna sintetik dalam ujian tidak dikekalkan.
- Ujian browser: login sebenar, 15 alat, profil tersimpan dan dimuat semula, sekatan Pro, Markdown selamat, salin/muat turun, simpan/buka/padam dokumen ujian, paparan hasil separa, cetakan dan laluan telefon/tablet.
- Pendaftaran dan permintaan e-mel pemulihan diuji dengan respons terkawal; tiada e-mel ujian dihantar atau akaun baharu dibuat melalui browser.
- Penjanaan Gemini sebenar bagi Prep dan Homeroom: respons 200 dengan acara selesai dan kandungan bukan kosong. Permintaan JSON rosak, alat tidak dikenali dan akses Pro tanpa kelayakan tidak menggunakan kuota.
- `npm run build`, `npm audit`, semakan diff dan imbasan rahsia pada fail berubah.

## Batasan dan kerja susulan

1. Output AI belum disahkan oleh panel guru MRSM untuk semua 15 alat, semua subjek, semua tingkatan atau program khas. Semakan guru kekal wajib. Tiada RAG dokumen DSKP rasmi dibekalkan; standard yang tidak disertakan mesti ditanda cadangan.
2. Tiada ujian beban serentak berskala semua maktab, audit penembusan bebas atau pensijilan keselamatan/pematuhan. Reka bentuk akses ialah per pengguna, bukan peranan pentadbir maktab/perkongsian panitia berbilang tenant.
3. Penghantaran e-mel sebenar tidak diuji. Supabase semasa menghadkan e-mel kepada 2 sejam; SMTP produksi dan reputasi domain perlu disediakan sebelum pengambilan ramai guru. Tetapan ini tidak dinaikkan atau diganti secara senyap.
4. Enam alat Pro masih memerlukan pelan yang ditetapkan pentadbir. Tiada pembayaran, pembelian pelan atau provisioning institusi automatik ditambah.
5. Pustaka memaparkan 200 dokumen terkini; carian ialah dalam senarai itu. Tiada suntingan kolaboratif, versi, perkongsian, DOCX asli atau muat naik fail.
6. Cetak/PDF menggunakan dialog browser. Model dan had asal dikekalkan: `gemini-3.5-flash`, fallback `gemini-3.6-flash` / `gemini-3.1-flash-lite`, 4096 token, 60 saat. Skop terlalu besar boleh menghasilkan notis hasil separa, bukan kejayaan palsu.
7. Jadual `generation_requests` menyimpan metadata permintaan; dasar retensi institusi dan backup/pemulihan bencana perlu dipersetujui sebelum penggunaan besar. Tiada data murid sebenar digunakan dalam ujian.
