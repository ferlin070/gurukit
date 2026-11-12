import { Link } from "react-router-dom";
export default function Support() {
  return (
    <article className="page card policy-page">
      <span className="eyebrow">BANTUAN GURU</span>
      <h1>Sokongan GuruKit</h1>
      <p>
        Hubungi{" "}
        <a href="mailto:ghazwahgroup@gmail.com">ghazwahgroup@gmail.com</a> untuk
        bantuan akaun, bahan tersimpan atau masalah aplikasi. Tiada jaminan masa
        respons ditetapkan pada peringkat rintis ini.
      </p>
      <h2>Jika janaan gagal</h2>
      <ol>
        <li>
          Semak sambungan dan tunggu jika terdapat janaan lain yang masih
          berjalan.
        </li>
        <li>
          Kecilkan skop input atau bilangan soalan. Hasil separa tidak patut
          digunakan sebagai bahan lengkap.
        </li>
        <li>
          Semak baki kuota. Kegagalan yang dikesan pelayan memulangkan kuota;
          tempahan yang tergendala dipulihkan selepas lima minit pada semakan
          seterusnya.
        </li>
        <li>
          Jika had perkhidmatan bersama dicapai atau penyelenggaraan aktif,
          dokumen tersimpan masih boleh dibuka.
        </li>
      </ol>
      <h2>Ketika meminta bantuan</h2>
      <p>
        Nyatakan masa kejadian (waktu Malaysia), nama alat dan kod ralat yang
        dipaparkan. Jangan hantar kata laluan, token, API key atau data peribadi
        pelajar. Padam maklumat sensitif sebelum melampirkan tangkap layar.
      </p>
      <h2>Akaun dan e-mel</h2>
      <p>
        Semak folder spam jika pengesahan belum diterima. Gunakan{" "}
        <Link to="/forgot-password">pemulihan kata laluan</Link> jika terlupa
        akses. Jangan kongsi satu akaun antara ramai guru.
      </p>
      <p>
        <Link to="/privacy">Baca notis privasi</Link> ·{" "}
        <Link to="/">Kembali ke GuruKit</Link>
      </p>
    </article>
  );
}
