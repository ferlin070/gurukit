export default function StudioArt({ className = "" }) {
  return (
    <img
      className={`studio-art ${className}`}
      src="/guru-studio.webp"
      width="1000"
      height="667"
      alt="Ilustrasi 3D guru berhijab lavender bersama buku dan tumbuhan di meja berwarna pastel"
      decoding="async"
    />
  );
}
