export default function PageBackButton({ label, onClick }) {
  return (
    <nav className="page-back-navigation" aria-label="Page navigation">
      <button className="page-back-button" type="button" onClick={onClick}>
        <span aria-hidden="true">←</span>
        <span>{label}</span>
      </button>
    </nav>
  );
}
