import ThemeToggle from "./ThemeToggle.jsx";

export default function TrackRecordHeader({ title, variant = "orange" }) {
  return (
    <header className={`track-record-header track-record-header--${variant}`}>
      <h1>{title}</h1>
      <ThemeToggle className="track-theme-toggle" />
    </header>
  );
}
