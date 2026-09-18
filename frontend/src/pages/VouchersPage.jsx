import { useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import VoucherEditorDialog from "../components/VoucherEditorDialog.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate, getNextVoucherNumber } from "../utils/recordHelpers.js";

export default function VouchersPage({ suppliers, vouchers, auditLog, onBack, onCreate, onIssue, onCancel }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const filtered = useMemo(() => vouchers.filter((voucher) => {
    const matchesStatus = status === "All" || voucher.status === status;
    const haystack = `${voucher.voucherNumber} ${voucher.supplierName} ${voucher.purchaseOrder} ${voucher.salesInvoice}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  }), [vouchers, query, status]);
  const issued = vouchers.filter((item) => item.status === "Issued");

  return (
    <div className="app-page voucher-page">
      <TrackRecordHeader title="Voucher Cheque Records" backLabel="Back to dashboard" onBack={onBack} />
      <main className="voucher-main">
        <section className="voucher-summary">
          <div><span>Total Vouchers</span><strong>{vouchers.length}</strong></div>
          <div><span>Issued</span><strong>{issued.length}</strong></div>
          <div><span>Issued Amount</span><strong>{formatCurrency(issued.reduce((sum, item) => sum + Number(item.amountApplied), 0))}</strong></div>
        </section>
        <section className="voucher-card">
          <div className="management-heading"><div><p>Payment records</p><h2>Voucher Cheques</h2></div><button className="primary-action" type="button" onClick={() => setDialogOpen(true)}>+ Create Voucher</button></div>
          <div className="records-toolbar"><input type="search" placeholder="Search voucher, supplier, P.O., or S.I.…" value={query} onChange={(event) => setQuery(event.target.value)} /><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Draft</option><option>Issued</option><option>Cancelled</option></select></div>
          <div className="financial-table-wrapper"><table className="financial-record-table voucher-table"><thead><tr><th>Voucher #</th><th>Supplier</th><th>P.O. #</th><th>S.I. #</th><th>Voucher Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filtered.length ? filtered.map((voucher) => <tr key={voucher.id}><td><strong>{voucher.voucherNumber}</strong></td><td>{voucher.supplierName}</td><td>{voucher.purchaseOrder}</td><td>{voucher.salesInvoice}</td><td>{formatRecordDate(voucher.voucherDate)}</td><td>{formatCurrency(voucher.amountApplied)}</td><td><span className={`voucher-status voucher-status--${voucher.status.toLowerCase()}`}>{voucher.status}</span></td><td><div className="row-actions">{voucher.status === "Draft" && <button type="button" onClick={() => onIssue(voucher.id)}>Issue</button>}{voucher.status !== "Cancelled" && <button className="danger-action" type="button" onClick={() => onCancel(voucher.id)}>Cancel</button>}</div></td></tr>) : <tr><td colSpan="8" className="financial-records-empty">No voucher records found.</td></tr>}</tbody>
          </table></div>
        </section>
        <section className="activity-card"><h2>Recent Activity</h2>{auditLog.length ? <ul>{auditLog.slice(0, 6).map((item) => <li key={item.id}><div><strong>{item.action}</strong><span>{item.details}</span></div><time>{new Date(item.createdAt).toLocaleString("en-PH")}</time></li>)}</ul> : <p>No activity yet.</p>}</section>
      </main>
      <VoucherEditorDialog isOpen={dialogOpen} voucherNumber={getNextVoucherNumber(vouchers)} suppliers={suppliers} onSave={(values) => { onCreate(values); setDialogOpen(false); }} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
