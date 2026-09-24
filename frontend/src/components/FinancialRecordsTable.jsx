import { useMemo, useState } from "react";
import TrackRecordHeader from "./TrackRecordHeader.jsx";

export default function FinancialRecordsTable({
  title, columns, rows, onBack, onEdit, onDelete,
  canEdit = () => true, canDelete = () => false, renderActions, embedded = false
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const sectionTitle = title.replace(/ Track Records$/i, "");
  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesStatus = status === "All" || row.billingStatus === status;
    const text = Object.values(row).filter((value) => ["string", "number"].includes(typeof value)).join(" ").toLowerCase();
    return matchesStatus && text.includes(query.toLowerCase());
  }), [rows, query, status]);

  const recordsCard = (
    <section className="financial-records-card" aria-label={title}>
          <div className="financial-records-heading"><div><p>Company records</p><h2>{sectionTitle} Transactions</h2></div><span>{filteredRows.length} record(s)</span></div>
          <div className="records-toolbar">
            <input type="search" placeholder="Search company, P.O., S.I., voucher…" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Paid</option><option>Not Paid</option></select>
          </div>
          <div className="financial-table-wrapper">
            <table className="financial-record-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}{(onEdit || onDelete || renderActions) && <th>Actions</th>}</tr></thead>
              <tbody>{filteredRows.length ? filteredRows.map((row) => <tr key={`${row.companyId}-${row.id}`}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}{(onEdit || onDelete || renderActions) && <td><div className="row-actions">{onEdit && <button className="table-action" type="button" disabled={!canEdit(row)} onClick={() => onEdit(row)}>{canEdit(row) ? "Edit" : "Locked"}</button>}{renderActions?.(row)}{onDelete && canDelete(row) && <button className="danger-action" type="button" onClick={() => onDelete(row)}>Delete</button>}</div></td>}</tr>) : <tr><td className="financial-records-empty" colSpan={columns.length + (onEdit || onDelete || renderActions ? 1 : 0)}>No records found.</td></tr>}</tbody>
            </table>
          </div>
    </section>
  );

  if (embedded) return recordsCard;

  return (
    <div className="app-page financial-records-page">
      <TrackRecordHeader title={title} backLabel="Back to dashboard" onBack={onBack} />
      <main className="financial-records-main">
        {recordsCard}
      </main>
    </div>
  );
}
