export default function TrackRecordHeader({ title, backLabel, onBack }) {
  return (
    <header className="track-record-header">
      <button
        className="triangle-back-button"
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        title={backLabel}
      >
        <span aria-hidden="true" />
      </button>
      <h1>{title}</h1>
    </header>
  );
}
