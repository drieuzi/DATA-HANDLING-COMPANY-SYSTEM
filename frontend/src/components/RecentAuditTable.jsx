function formatAction(action) {
  return String(action || "Activity")
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDetails(details) {
  if (!details) return "—";
  if (typeof details === "string") return details;
  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, " $1").replaceAll("_", " ").trim();
      const formattedLabel = label.charAt(0).toUpperCase() + label.slice(1);
      const formattedValue = typeof value === "object" ? JSON.stringify(value) : String(value);
      return `${formattedLabel}: ${formattedValue}`;
    })
    .join(" · ") || "—";
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function RecentAuditTable({ logs = [], title = "Recent Audit Activity", renderActions }) {
  return (
    <section className="recent-audit-card" aria-label={title}>
      <div className="recent-audit-heading">
        <div>
          <p>Admin monitoring</p>
          <h2>{title}</h2>
        </div>
        <span>{logs.length} event(s)</span>
      </div>

      <div className="recent-audit-table-wrap">
        <table className="recent-audit-table">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Record Details</th>
              <th>Performed By</th>
              <th>Date and Time</th>
              {renderActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {logs.length ? logs.map((log) => {
              const actions = renderActions?.(log);
              return (
                <tr key={log.id}>
                  <td><strong>{formatAction(log.action)}</strong><small>{log.entityType || "system"}{log.entityId ? ` #${log.entityId}` : ""}</small></td>
                  <td>{formatDetails(log.details)}</td>
                  <td>{log.actorFullName || log.actorUsername || "Unknown account"}</td>
                  <td><time dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time></td>
                  {renderActions && <td><div className="row-actions">{actions || "—"}</div></td>}
                </tr>
              );
            }) : (
              <tr><td className="recent-audit-empty" colSpan={renderActions ? 5 : 4}>No activity recorded for this category yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
