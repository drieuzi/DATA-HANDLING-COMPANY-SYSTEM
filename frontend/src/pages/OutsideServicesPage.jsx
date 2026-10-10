import { useMemo, useState } from "react";
import TablePagination from "../components/TablePagination.jsx";
import useTablePagination from "../hooks/useTablePagination.js";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import OutsideServiceEditorDialog from "../components/OutsideServiceEditorDialog.jsx";
import OtherExpensesReportPage from "./OtherExpensesReportPage.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

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
  const [reportOpen, setReportOpen] = useState(false);

  const months = useMemo(() => [...new Set(services.map((item) => monthKey(item.date)).filter(Boolean))]
    .sort().reverse(), [services]);

  const rows = useMemo(() => services.filter((service) => {
    if (service.deletedAt) return false;
    const matchesMonth = !selectedMonth || monthKey(service.date) === selectedMonth;
    const searchText = [service.payee, service.item, service.receiptInvoiceNumber,
      service.tinNumber].filter(Boolean).join(" ").toLowerCase();
    const matchesSearch = searchText.includes(query.trim().toLowerCase());
    return matchesMonth && matchesSearch;
  }), [query, selectedMonth, services]);
  const pagination = useTablePagination(rows, [query, selectedMonth]);

  const total = rows.reduce((sum, service) => sum + Number(service.amount || 0), 0);
  const dateRange = selectedMonthRange(selectedMonth);
  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(service) {
    setEditing(service);
    setDialogOpen(true);
  }

  async function remove(service) {
    const reason = window.prompt(`Reason for deleting the Other Expense "${service.item}":`);
    if (!reason?.trim()) return;
    if (!window.confirm(`Delete other expense "${service.item}"? It will disappear from active records and an Admin can restore or permanently delete it.`)) return;
    setMessage("");
    try { await onDelete(service.id, reason.trim()); }
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

  if (reportOpen) return (
    <OtherExpensesReportPage
      user={user}
      rows={rows}
      dateRange={dateRange}
      onBack={() => setReportOpen(false)}
      onRecordExport={onRecordExport}
    />
  );

  return (
    <div className="app-page outside-services-page">
      <TrackRecordHeader title="Other Expenses" variant="light" />
      <main className="financial-records-main outside-services-main">
        <PageBackButton label="Back to Dashboard" onClick={onBack} />

        <section className="management-toolbar outside-services-controls">
          <span>Company staff can add, edit, delete, attach files, and export reports</span>
          <div className="outside-services-control-actions">
            <button className="primary-action" type="button" onClick={openCreate}>+ Add Other Expense</button>
          </div>
        </section>

        <section className="financial-records-card outside-services-card" aria-labelledby="outsideServicesTitle">
          <div className="financial-records-heading">
            <div><p>Monthly expense records</p><h2 id="outsideServicesTitle">Other Expenses</h2></div>
            <button className="secondary-action outside-services-report-link" type="button" onClick={() => setReportOpen(true)}>Preview &amp; Download</button>
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
                {rows.length ? pagination.pageItems.map((service) => (
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
                        <button type="button" onClick={() => openEdit(service)}>Edit</button>
                        <button className="danger-action" type="button" onClick={() => remove(service)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td className="financial-records-empty" colSpan="8">No other expense records found.</td></tr>}
              </tbody>
              <tfoot><tr><th colSpan="4">Filtered Total</th><td>{formatCurrency(total)}</td><td colSpan="3" /></tr></tfoot>
            </table>
          </div>
          <TablePagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalRecords={rows.length} onPageChange={pagination.setCurrentPage} />
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
