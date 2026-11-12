# Word, templat RPH dan bank soalan/JSU

## Eksport Word

Butang **Word (.docx)** tersedia pada hasil janaan lengkap dan dokumen tersimpan. Fail ialah arkib Office Open XML sebenar, dengan perenggan, tajuk, jadual, senarai, format tebal/condong dan nombor halaman yang boleh disunting. Jadual JSU lebar menggunakan A4 landskap secara automatik. Penukaran dilakukan dalam browser; kandungan tidak dihantar ke perkhidmatan penukaran pihak ketiga. Pakej Word dimuat turun oleh browser apabila eksport diperlukan.

Imej jauh, HTML mentah dan pautan aktif tidak dimasukkan ke dalam fail. Formula LaTeX, gambar rajah dan templat Word yang dimuat naik belum disokong. Fail diuji pada struktur ZIP/OOXML dan muat turun browser; pengujian visual dalam Microsoft Word/LibreOffice belum dilakukan.

## Templat RPH maktab

Buka **Templat RPH** melalui navigasi. Ubah tajuk, subtajuk, label, susunan seksyen serta catatan tandatangan. Pilih naratif berstruktur atau jadual ringkasan. Semua lapan seksyen teras dikekalkan: standard, objektif, kriteria, aktiviti, pentaksiran, bahan, pembezaan dan refleksi.

Tekan **Simpan templat** untuk menggunakannya dalam janaan baharu. **Templat Word kosong** menghasilkan borang boleh sunting tanpa menggunakan kuota AI. **Pulihkan lalai** hanya menukar draf sehingga disimpan.

Pada penjana RPH, isi tarikh, masa dan kelas khusus. Templat disahkan sebelum penjanaan. Tujuh seksyen kandungan dijana dan diperiksa pelayan; ruang refleksi sentiasa ditambah sistem untuk diisi guru selepas PdPc, bukan fakta yang direka AI. Nama guru, maktab, tarikh dan kelas dimasukkan oleh kod. Hasil yang disimpan ialah salinan teks pada ketika janaan; perubahan templat kemudian tidak mengubah dokumen lama.

Templat boleh suai ini bukan pengesahan format rasmi mana-mana maktab. Guru perlu menyemak kehendak pentadbiran serta rujukan SK/SP sebenar.

## Bank soalan & JSU

Alat khusus baharu menjadikan katalog 16 alat. Penjana Soalan Ujian asal dikekalkan.

1. Buka **Bank soalan & JSU**, isi tajuk, subjek, tingkatan, tempoh dan arahan kertas.
2. Setiap baris JSU menentukan topik, jenis soalan, markah setiap item dan bilangan pada C1–C6. Topik sama boleh menggunakan beberapa baris untuk jenis berlainan.
3. Sistem mengira nombor soalan, jumlah item, jumlah markah dan taburan Bloom. Had: 8 baris, 20 soalan. Objektif menggunakan 1 markah dan empat pilihan A–D. C6 memerlukan soalan subjektif. Bloom bukan pengesahan aras kesukaran atau format peperiksaan rasmi.
4. **Word JSU tanpa janaan AI** mengeksport pelan guru tanpa menggunakan kuota. Untuk isi soalan, tekan **Jana soalan mengikut JSU**. Cadangan: 4–8 item setiap janaan supaya skema mencukupi dalam had model asal.
5. Pelayan memeriksa jumlah/nombor soalan, pilihan objektif dan pecahan markah subjektif. Hasil tidak sepadan tidak dimuktamadkan dan kuota dipulangkan melalui mekanisme sedia ada. Ini pengesahan struktur dan aritmetik, bukan jaminan kebenaran pedagogi.
6. Semak **Sunting soalan** untuk membetulkan teks, pilihan, jawapan dan poin skema. Jumlah rubrik subjektif mesti tepat. Perubahan topik, aras, markah, subjek atau tingkatan menghalang simpan/eksport sehingga dijana semula atau pelan asal dipulihkan. Tajuk, tempoh dan arahan boleh disunting.
7. **Simpan bank** menyimpan dalam akaun. Pustaka memaparkan 100 bank terkini. Buka, sunting dan simpan semula untuk mengemas kini bank itu; janaan baharu menghasilkan bank baharu. Pemadaman memerlukan pengesahan.
8. Eksport setiap bahagian secara berasingan: **Kertas soalan**, **Skema jawapan** atau **JSU**. Kertas pelajar tidak membaca medan jawapan/rubrik; skema untuk guru sahaja. Semak teks soalan dan arahan sendiri untuk memastikan tiada jawapan terselit oleh penulis/AI sebelum mengedarkan kertas.

Bahan boleh dieksport sebagai Word, Markdown atau melalui cetakan/PDF browser. Tiada perkongsian antara guru, import bank lama atau muat naik soalan sulit ditambah dalam fasa ini. Jangan masukkan data sensitif pelajar atau soalan yang tidak dibenarkan dihantar kepada AI.

## Pemasangan dan keselamatan

Migrasi tambahan: `supabase/migrations/20261112060000_teaching_pack.sql`. Jalankan selepas migrasi keselamatan MRSM. Migrasi idempoten menambah `rph_templates` dan `question_banks`, dengan RLS pemilik, serta tidak mengubah `supabase/schema.sql`, pelan atau had kuota sedia ada. Migrasi ini telah digunakan pada projek live semasa pembangunan ciri.

Endpoint, model dan had asal dikekalkan. Klien lama yang tidak meminta templat boleh suai masih menerima RPH teks biasa. Metadata bank dan JSU dibina daripada pelan yang disahkan, bukan nombor yang dipilih AI.

Pengesahan merangkumi ujian regresi, ZIP/OOXML, perkiraan JSU, pemisahan skema/kertas, pemulangan kuota untuk output tidak sah, RLS silang pengguna dan aliran browser. Ujian penjanaan serta browser menggunakan akaun sementara yang dipadam bersama data ujian; kuota akaun guru sedia ada tidak digunakan untuk ujian ciri ini.
