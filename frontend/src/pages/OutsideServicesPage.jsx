import { useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import OutsideServiceEditorDialog from "../components/OutsideServiceEditorDialog.jsx";
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

export default function OutsideServicesPage({ user, services, onBack, onSave, onDelete }) {
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState("");

  const months = useMemo(() => [...new Set(services.map((item) => monthKey(item.date)).filter(Boolean))]
    .sort().reverse(), [services]);

  const rows = useMemo(() => services.filter((service) => {
    const matchesMonth = !selectedMonth || monthKey(service.date) === selectedMonth;
    const matchesSearch = service.item.toLowerCase().includes(query.trim().toLowerCase());
    return matchesMonth && matchesSearch;
  }), [query, selectedMonth, services]);

  const total = rows.reduce((sum, service) => sum + Number(service.amount || 0), 0);
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
    if (!window.confirm(`Delete outside service "${service.item}"? This will remove it from monthly analytics.`)) return;
    setMessage("");
    try { await onDelete(service.id); }
    catch (error) { setMessage(error.message); }
  }

  return (
    <div className="app-page outside-services-page">
      <TrackRecordHeader title="Outside Services" variant="light" />
      <main className="financial-records-main outside-services-main">
        <PageBackButton label="Back to Dashboard" onClick={onBack} />

        <section className="management-toolbar outside-services-controls">
          <span>{user.role === "admin" ? "Admin can add and delete records" : "User can add and edit records"}</span>
          <button className="primary-action" type="button" onClick={openCreate}>+ Add Outside Service</button>
        </section>

        <section className="financial-records-card outside-services-card" aria-labelledby="outsideServicesTitle">
          <div className="financial-records-heading">
            <div><p>Monthly expense records</p><h2 id="outsideServicesTitle">Outside Services</h2></div>
            <span>{rows.length} record(s) · {formatCurrency(total)}</span>
          </div>

          <div className="records-toolbar outside-services-toolbar">
            <label>
              <span>Search item</span>
              <input type="search" placeholder="Search outside service item" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label>
              <span>Service month</span>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                <option value="">All months</option>
                {months.map((month) => <option key={month} value={month}>{formatMonth(month)}</option>)}
              </select>
            </label>
          </div>

          {message && <p className="outside-services-message" role="alert">{message}</p>}

          <div className="financial-table-wrapper">
            <table className="financial-record-table outside-services-table">
              <thead><tr><th>Item</th><th>Amount</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.length ? rows.map((service) => (
                  <tr key={service.id}>
                    <td>{service.item}</td>
                    <td>{formatCurrency(service.amount)}</td>
                    <td>{formatRecordDate(service.date)}</td>
                    <td>
                      <div className="row-actions">
                        {canEdit && <button type="button" onClick={() => openEdit(service)}>Edit</button>}
                        {canDelete && <button className="danger-action" type="button" onClick={() => remove(service)}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td className="financial-records-empty" colSpan="4">No outside service records found.</td></tr>}
              </tbody>
              <tfoot><tr><th>Filtered Total</th><td>{formatCurrency(total)}</td><td colSpan="2" /></tr></tfoot>
            </table>
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
