import { useId, useState } from "react";

export default function PasswordField({
  value,
  onChange,
  autoComplete = "current-password",
  minLength,
}) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  return (
    <div className="password-control">
      <label htmlFor={inputId}>Kata laluan</label>
      <div className="password-field">
        <input
          id={inputId}
          name="password"
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder="Masukkan kata laluan"
        />
        <button
          type="button"
          aria-label={
            visible ? "Sembunyikan kata laluan" : "Tunjukkan kata laluan"
          }
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? "Sembunyi" : "Lihat"}
        </button>
      </div>
    </div>
  );
}
