import { useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import OutsideServiceEditorDialog from "../components/OutsideServiceEditorDialog.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";
import { createFileReport, exportFileReportToPdf, reportTotal } from "../utils/reportExport.js";

function monthKey(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date.slice(0, 7) : "";
}

function formatMonth(value) {
  if (!value) return "All months";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

function selectedMonthRange(value) {
  if (!value) return { from: "", to: "" };
  const [year, month] = value.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${value}-01`, to: `${value}-${String(lastDay).padStart(2, "0")}` };
}

export default function OutsideServicesPage({
  user, services, onBack, onSave, onDelete, onViewAttachment,
  onDownloadAttachment, onReplaceAttachment, onRemoveAttachment, onRecordExport
}) {
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState("bir");
  const [downloadingReport, setDownloadingReport] = useState(false);

  const months = useMemo(() => [...new Set(services.map((item) => monthKey(item.date)).filter(Boolean))]
    .sort().reverse(), [services]);

  const rows = useMemo(() => services.filter((service) => {
    const matchesMonth = !selectedMonth || monthKey(service.date) === selectedMonth;
    const searchText = [service.payee, service.item, service.receiptInvoiceNumber,
      service.tinNumber].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = searchText.includes(query.trim().toLowerCase());
    return matchesMonth && matchesSearch;
  }), [query, selectedMonth, services]);

  const total = rows.reduce((sum, service) => sum + Number(service.amount || 0), 0);
  const dateRange = selectedMonthRange(selectedMonth);
  const previewReport = useMemo(() => createFileReport({
    source: "other_expenses", template: previewTemplate, status: "All",
    from: "", to: "", clients: [], suppliers: [], outsideServices: rows
  }), [previewTemplate, rows]);
  const canEdit = user.role === "user";
  const canDelete = user.role === "admin";

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(service) {
    setEditing(service);
    setDialogOpen(true);
  }

  async function remove(service) {
    if (!window.confirm(`Delete other expense "${service.item}"? This will remove it from monthly analytics.`)) return;
    setMessage("");
    try { await onDelete(service.id); }
    catch (error) { setMessage(error.message); }
  }

  async function replaceAttachment(service, event) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
      return setMessage("Only PDF, JPG, and PNG attachments are allowed.");
    }
    if (file.size > 5 * 1024 * 1024) return setMessage("The attachment must not exceed 5 MB.");
    setMessage("");
    try {
      await onReplaceAttachment(service.id, file);
      setMessage(service.hasAttachment ? "Attachment replaced." : "Attachment added.");
    } catch (error) { setMessage(error.message); }
  }

  async function removeAttachment(service) {
    if (!window.confirm(`Remove "${service.attachmentName}" from this record? The Other Expense record will remain.`)) return;
    setMessage("");
    try {
      await onRemoveAttachment(service.id);
      setMessage("Attachment removed. The Other Expense record was kept.");
    } catch (error) { setMessage(error.message); }
  }

  async function runAttachmentAction(action) {
    setMessage("");
    try { await action(); }
    catch (error) { setMessage(error.message); }
  }

  async function downloadReport() {
    if (!previewReport?.rows.length) return setMessage("There are no filtered records to export.");
    setDownloadingReport(true);
    setMessage("");
    try {
      await onRecordExport?.({
        reportType: "other_expenses", format: "pdf", template: previewTemplate,
        filterStatus: "All", from: dateRange.from || null, to: dateRange.to || null,
        recordCount: previewReport.rows.length
      });
      await exportFileReportToPdf(previewReport, {
        ...dateRange, source: "other_expenses", template: previewTemplate,
        status: "All", generatedBy: user.fullName || user.username
      });
      setMessage(`${previewReport.templateTitle} downloaded successfully.`);
    } catch (error) {
      setMessage(error.message || "The report could not be downloaded.");
    } finally {
      setDownloadingReport(false);
    }
  }

  return (
    <div className="app-page outside-services-page">
      <TrackRecordHeader title="Other Expenses" variant="light" />
      <main className="financial-records-main outside-services-main">
        <PageBackButton label="Back to Dashboard" onClick={onBack} />

        <section className="management-toolbar outside-services-controls">
          <span>{user.role === "admin" ? "Admin can add and delete records" : "User can add and edit records"}</span>
          <div className="outside-services-control-actions">
            <button className="primary-action" type="button" onClick={openCreate}>+ Add Other Expense</button>
          </div>
        </section>

        <section className="financial-records-card outside-services-card" aria-labelledby="outsideServicesTitle">
          <div className="financial-records-heading">
            <div><p>Monthly expense records</p><h2 id="outsideServicesTitle">Other Expenses</h2></div>
            <span>{rows.length} record(s) · {formatCurrency(total)}</span>
          </div>

          <div className="records-toolbar outside-services-toolbar">
            <label>
              <span>Search item</span>
              <input type="search" placeholder="Search payee, item, receipt, or TIN" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label>
              <span>Expense month</span>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                <option value="">All months</option>
                {months.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}
              </select>
            </label>
          </div>

          {message && <p className="outside-services-message" role="alert">{message}</p>}

          <div className="financial-table-wrapper">
            <table className="financial-record-table outside-services-table">
              <thead><tr><th>Payee</th><th>Item</th><th>OR/S.I.</th><th>TIN</th><th>Amount</th><th>Date</th><th>Attachment</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.length ? rows.map((service) => (
                  <tr key={service.id}>
                    <td>{service.payee || "—"}</td>
                    <td>{service.item}</td>
                    <td>{service.receiptInvoiceNumber || "—"}</td>
                    <td>{service.tinNumber || "—"}</td>
                    <td>{formatCurrency(service.amount)}</td>
                    <td>{formatRecordDate(service.date)}</td>
                    <td>
                      <div className="outside-service-attachment-cell">
                        {service.hasAttachment ? <>
                          <span title={service.attachmentName}>{service.attachmentName}</span>
                          <div className="row-actions">
                            <button type="button" onClick={() => runAttachmentAction(() => onViewAttachment(service.id))}>View</button>
                            <button type="button" onClick={() => runAttachmentAction(() => onDownloadAttachment(service.id, service.attachmentName))}>Download</button>
                            <label className="table-file-action">
                              Replace
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => replaceAttachment(service, event)} />
                            </label>
                            <button className="danger-action" type="button" onClick={() => removeAttachment(service)}>Remove</button>
                          </div>
                        </> : <>
                          <span>No attachment</span>
                          <label className="table-file-action">
                            Add file
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => replaceAttachment(service, event)} />
                          </label>
                        </>}
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        {canEdit && <button type="button" onClick={() => openEdit(service)}>Edit</button>}
                        {canDelete && <button className="danger-action" type="button" onClick={() => remove(service)}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td className="financial-records-empty" colSpan="8">No other expense records found.</td></tr>}
              </tbody>
              <tfoot><tr><th colSpan="4">Filtered Total</th><td>{formatCurrency(total)}</td><td colSpan="3" /></tr></tfoot>
            </table>
          </div>
        </section>

        <section className="report-export-card outside-services-report-card" aria-labelledby="otherExpensesReportTitle">
          <div className="report-export-heading">
            <div><p>Other expense records</p><h2 id="otherExpensesReportTitle">Report Preview</h2></div>
            <span>{previewReport.rows.length} record(s) in preview</span>
          </div>

          <div className="report-template-picker" aria-label="Other Expenses report format">
            <button className={previewTemplate === "bir" ? "is-selected" : ""} type="button" onClick={() => setPreviewTemplate("bir")}>BIR Report</button>
            <button className={previewTemplate === "office" ? "is-selected" : ""} type="button" onClick={() => setPreviewTemplate("office")}>Office Report</button>
          </div>

          <div className="report-export-summary outside-services-report-summary">
            <div><span>Preview format</span><strong>{previewReport.templateTitle}</strong></div>
            <div><span>Report</span><strong>Other Expenses Report</strong></div>
            <div><span>Report total</span><strong>{formatCurrency(reportTotal(previewReport))}</strong></div>
          </div>

          <div className="report-preview-sheet">
            <div className="report-preview-company">
              <strong>ILLUMINUX GENERAL MERCH CO.</strong>
              <span>Blk. 4, Queenstown 1 Heights, Brgy. San Luis, Antipolo City</span>
              <h2>{previewReport.templateTitle} — Other Expenses Report</h2>
            </div>
            <div className="financial-table-wrapper">
              <table className="financial-record-table report-preview-table outside-services-report-table">
                <thead><tr>{previewReport.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
                <tbody>{previewReport.rows.length ? previewReport.rows.map((row, index) => (
                  <tr key={`${previewTemplate}-${index}`}>{previewReport.columns.map((column) => <td key={column.key}>{column.type === "money" ? formatCurrency(row[column.key]) : row[column.key]}</td>)}</tr>
                )) : <tr><td className="financial-records-empty" colSpan={previewReport.columns.length}>No filtered records are available.</td></tr>}</tbody>
                {previewReport.rows.length > 0 && <tfoot><tr><th colSpan={previewReport.columns.length - 1}>Total</th><th>{formatCurrency(reportTotal(previewReport))}</th></tr></tfoot>}
              </table>
            </div>
          </div>

          <div className="report-export-actions">
            <button className="primary-action" type="button" disabled={downloadingReport || !previewReport.rows.length} onClick={downloadReport}>{downloadingReport ? "Creating PDF…" : "Download PDF"}</button>
          </div>
        </section>
      </main>

      <OutsideServiceEditorDialog
        isOpen={dialogOpen}
        service={editing}
        onSave={(values) => onSave(editing?.id || null, values)}
        onClose={() => setDialogOpen(false)}
      />

    </div>
  );
}
