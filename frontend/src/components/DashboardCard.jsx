export default function DashboardCard({ label, value, onClick, className = "" }) {
  return (
    <button
      className={`dashboard-card ${className}`.trim()}
      type="button"
      onClick={onClick}
    >
      <span>{label}</span>
      {value !== undefined && <strong>{value}</strong>}
    </button>
  );
}
