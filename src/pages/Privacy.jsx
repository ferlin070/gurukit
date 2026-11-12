import { Link } from "react-router-dom";
export default function Privacy() {
  return (
    <article className="page card policy-page">
      <span className="eyebrow">NOTIS PENGGUNAAN DATA</span>
      <h1>Privasi & data GuruKit</h1>
      <p>
        Kemaskini: 12 November 2026. Notis ini menerangkan operasi semasa; ia
        bukan pensijilan pematuhan undang-undang.
      </p>
      <h2>Data yang digunakan</h2>
      <p>
        GuruKit menyimpan maklumat akaun dan profil pengajaran, dokumen yang
        cikgu pilih untuk simpan, templat RPH, bank soalan serta rekod
        penggunaan kuota. Log operasi merekodkan kod ralat, masa, alat dan
        pengecam teknikal, bukan kata laluan, token atau kandungan penuh bahan.
      </p>
      <h2>Penjanaan AI</h2>
      <p>
        Input borang dan konteks pengajaran dihantar kepada Google Gemini untuk
        menjana bahan. Aplikasi menggunakan Vercel untuk pengehosan serta
        Supabase untuk akaun dan storan. Jangan masukkan nama penuh, nombor
        pengenalan, rekod kesihatan, maklumat keluarga atau soalan sulit yang
        tidak dibenarkan dihantar kepada perkhidmatan AI. Gunakan ID samaran
        dalam analisis markah.
      </p>
      <h2>Simpanan dan pemadaman</h2>
      <p>
        Dokumen dan bank soalan boleh dipadam melalui akaun cikgu. Data yang
        disimpan tidak dipadam secara automatik mengikut umur. Metadata operasi
        disimpan sekitar 30 hari dan agregat operasi sehingga 90 hari; backup
        aplikasi terenkripsi disimpan secara berputar sehingga 7 salinan harian.
        Apabila salinan Google Drive disambungkan, sehingga 4 salinan mingguan
        turut disimpan. Data yang dipadam mungkin masih terdapat dalam backup
        sepanjang tempoh itu. Backup ini tidak menggantikan backup penuh
        pangkalan data atau akaun pengesahan.
      </p>
      <h2>Akses</h2>
      <p>
        Bahan tersimpan diasingkan mengikut pemilik akaun. Pentadbir yang diberi
        akses infrastruktur boleh memproses data bagi sokongan, pemulihan dan
        keselamatan. Ciri perkongsian panitia belum disediakan.
      </p>
      <h2>Permintaan data</h2>
      <p>
        Untuk pertanyaan, pembetulan atau permintaan pemadaman akaun, hubungi{" "}
        <a href="mailto:ghazwahgroup@gmail.com">ghazwahgroup@gmail.com</a>.
        Pentadbir perlu mengesahkan pemilik akaun sebelum memproses permintaan.
      </p>
      <Link className="btn btn-ghost" to="/support">
        Bantuan penggunaan →
      </Link>
    </article>
  );
}
