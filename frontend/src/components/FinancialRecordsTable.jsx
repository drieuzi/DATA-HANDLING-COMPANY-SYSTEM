import { useId, useMemo, useState } from "react";
import TrackRecordHeader from "./TrackRecordHeader.jsx";
import OfficeReportDialog from "./OfficeReportDialog.jsx";
import TablePagination from "./TablePagination.jsx";
import useTablePagination from "../hooks/useTablePagination.js";

export default function FinancialRecordsTable({
  title, columns, rows, onBack, onEdit, onDelete,
  canEdit = () => true, canDelete = () => false, renderActions, embedded = false,
  searchPlaceholder = "Search company, P.O., S.I., voucher…",
  searchKeys = [],
  dateField = "",
  officeReportTitle,
  generatedBy
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const suggestionListId = `record-suggestions-${useId().replaceAll(":", "")}`;
  const sectionTitle = title.replace(/ Track Records$/i, "");
  const suggestions = useMemo(() => [...new Set(rows.flatMap((row) =>
    searchKeys.map((key) => String(row[key] || "").trim()).filter(Boolean)
  ))].sort((first, second) => first.localeCompare(second)).slice(0, 100), [rows, searchKeys]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesStatus = status === "All" || row.billingStatus === status;
    const searchableValues = searchKeys.length
      ? searchKeys.map((key) => row[key])
      : Object.values(row);
    const text = searchableValues
      .filter((value) => ["string", "number"].includes(typeof value))
      .join(" ")
      .toLowerCase();
    const rowDate = dateField ? String(row[dateField] || "").slice(0, 10) : "";
    const matchesFrom = !fromDate || (rowDate && rowDate >= fromDate);
    const matchesTo = !toDate || (rowDate && rowDate <= toDate);
    return matchesStatus && matchesFrom && matchesTo && text.includes(query.trim().toLowerCase());
  }), [rows, query, status, searchKeys, dateField, fromDate, toDate]);
  const pagination = useTablePagination(filteredRows, [query, status, fromDate, toDate]);

  const recordsCard = (
    <section className="financial-records-card" aria-label={title}>
          <div className="financial-records-heading">
            <div><p>Company records</p><h2>{sectionTitle} Transactions</h2></div>
            <div className="financial-records-heading__actions">
              <span>{filteredRows.length} record(s)</span>
              {officeReportTitle && <button className="secondary-action" type="button" disabled={!filteredRows.length} onClick={() => setReportOpen(true)}>Preview Office Report</button>}
            </div>
          </div>
          <div className={`records-toolbar${dateField ? " records-toolbar--date-range" : ""}`}>
            <label className="records-filter-field records-search-field">
              <span>Search records</span>
              <input type="search" list={suggestionListId} placeholder={searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} />
              <datalist id={suggestionListId}>{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
            </label>
            {dateField && <label className="records-filter-field"><span>From</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>}
            {dateField && <label className="records-filter-field"><span>To</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>}
            <label className="records-filter-field">
              <span>Billing status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Paid</option><option>Not Paid</option></select>
            </label>
          </div>
          <div className="financial-table-wrapper">
            <table className="financial-record-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}{(onEdit || onDelete || renderActions) && <th>Actions</th>}</tr></thead>
              <tbody>{filteredRows.length ? pagination.pageItems.map((row) => <tr key={`${row.companyId}-${row.id}`}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}{(onEdit || onDelete || renderActions) && <td><div className="row-actions">{onEdit && <button className="table-action" type="button" disabled={!canEdit(row)} onClick={() => onEdit(row)}>{canEdit(row) ? "Edit" : "Locked"}</button>}{renderActions?.(row)}{onDelete && canDelete(row) && <button className="danger-action" type="button" onClick={() => onDelete(row)}>Delete</button>}</div></td>}</tr>) : <tr><td className="financial-records-empty" colSpan={columns.length + (onEdit || onDelete || renderActions ? 1 : 0)}>No records found.</td></tr>}</tbody>
            </table>
          </div>
          <TablePagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalRecords={filteredRows.length} onPageChange={pagination.setCurrentPage} />
    </section>
  );

  const reportDialog = officeReportTitle ? (
    <OfficeReportDialog
      isOpen={reportOpen}
      title={officeReportTitle}
      columns={columns}
      rows={filteredRows}
      generatedBy={generatedBy}
      onClose={() => setReportOpen(false)}
    />
  ) : null;

  if (embedded) return <>{recordsCard}{reportDialog}</>;

  return (
    <div className="app-page financial-records-page">
      <TrackRecordHeader title={title} backLabel="Back to dashboard" onBack={onBack} />
      <main className="financial-records-main">
        {recordsCard}
      </main>
      {reportDialog}
    </div>
  );
}
