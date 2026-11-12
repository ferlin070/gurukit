import {
  PROGRAMS,
  LEVELS,
  LANGUAGES,
  SETTINGS,
  SUPPORT,
} from "../data/mrsm.js";
export default function TeachingFields({
  value,
  onChange,
  compact = false,
  disabled = false,
}) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  const select = (key, label, items) => (
    <label key={key}>
      {label}
      <select
        aria-label={label}
        value={value[key]}
        onChange={(e) => set(key, e.target.value)}
        disabled={disabled}
      >
        {items.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="teaching-fields">
      {!compact && (
        <>
          <label>
            Nama MRSM
            <input
              value={value.maktab}
              onChange={(e) => set("maktab", e.target.value)}
              maxLength={200}
              placeholder="Contoh: MRSM Kuala Kubu Bharu"
              disabled={disabled}
            />
          </label>
          <label>
            Subjek utama
            <input
              value={value.subjek}
              onChange={(e) => set("subjek", e.target.value)}
              maxLength={200}
              placeholder="Contoh: Fizik"
              disabled={disabled}
            />
          </label>
        </>
      )}
      {select("program", "Program MRSM", PROGRAMS)}
      {select("tingkatan", "Tingkatan", LEVELS)}
      {select("bahasa", "Bahasa bahan", LANGUAGES)}
      {select("suasana", "Konteks pembelajaran", SETTINGS)}
      {select("sokongan", "Keperluan pelajar", SUPPORT)}
      <label>
        Bilangan pelajar
        <input
          type="number"
          min="1"
          max="100"
          value={value.bilanganMurid}
          onChange={(e) => set("bilanganMurid", e.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="field-wide">
        Rujukan DSKP / SK / SP
        <textarea
          value={value.standard}
          onChange={(e) => set("standard", e.target.value)}
          maxLength={4000}
          rows={3}
          placeholder="Tampal standard atau petikan rujukan yang telah disahkan. Jika kosong, standard dalam hasil ditandakan sebagai cadangan."
          disabled={disabled}
        />
      </label>
      <label className="field-wide">
        Catatan kemudahan / keperluan
        <textarea
          value={value.catatan}
          onChange={(e) => set("catatan", e.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="Contoh: Prep 30 minit, tanpa telefon; latihan pengayaan algebra."
          disabled={disabled}
        />
      </label>
    </div>
  );
}
