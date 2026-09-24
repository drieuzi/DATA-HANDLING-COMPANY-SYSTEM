import { useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import VoucherEditorDialog from "../components/VoucherEditorDialog.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";
import { downloadVoucherForPrint } from "../utils/voucherDocument.js";
import { getNextVoucherNumber } from "../services/voucherApi.js";

function activityDetails(details) {
  if (!details) return "";
  if (typeof details === "string") return details;
  return Object.entries(details).map(([key, value]) => `${key}: ${value}`).join(" · ");
}

function voucherStatus(voucher) {
  return voucher?.deletedAt ? "Deleted" : (voucher?.status || "Draft");
}

export default function VouchersPage({
  user, suppliers, vouchers, auditLog, onBack, onCreate,
  onEdit, onIssue, onDelete, onRestore, onPermanentDelete
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [nextVoucherNumber, setNextVoucherNumber] = useState("");
  const [loadingVoucherNumber, setLoadingVoucherNumber] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const isAdmin = user?.role === "admin";
  const filtered = useMemo(() => vouchers.filter((voucher) => {
    const effectiveStatus = voucherStatus(voucher);
    const matchesStatus = status === "All" || effectiveStatus === status;
    const haystack = `${voucher.voucherNumber} ${voucher.supplierName} ${voucher.purchaseOrder} ${voucher.salesInvoice}`.toLowerCase();
    return matchesStatus && haystack.includes(query.toLowerCase());
  }), [vouchers, query, status]);
  const issued = vouchers.filter((item) => voucherStatus(item) === "Issued");
  const cancelled = vouchers.filter((item) => voucherStatus(item) === "Cancelled");
  const totalCount = vouchers.filter((item) => !item.deletedAt).length;
  const latestVoucherDeletionAudit = useMemo(() => {
    const latest = new Map();
    auditLog.forEach((item) => {
      if (item.action === "VOUCHER_DELETED" && item.entityType === "voucher"
        && item.entityId && !latest.has(String(item.entityId))) {
        latest.set(String(item.entityId), item);
      }
    });
    return latest;
  }, [auditLog]);
  const activityRows = useMemo(() => {
    const recent = auditLog.slice(0, 8);
    const included = new Set(recent.map((item) => item.id));
    const requiredDeletionRows = [...latestVoucherDeletionAudit.values()]
      .filter((item) => !included.has(item.id))
      .filter((item) => vouchers.some((voucher) => String(voucher.id) === String(item.entityId)
        && voucher.deletedAt && voucher.restoreAllowed !== false));
    return [...recent, ...requiredDeletionRows];
  }, [auditLog, latestVoucherDeletionAudit, vouchers]);

  async function runAction(action) {
    try { await action(); }
    catch (error) { window.alert(error.message); }
  }

  async function openVoucherForm() {
    setLoadingVoucherNumber(true);
    setNextVoucherNumber("");
    try {
      const seriesNumber = await getNextVoucherNumber();
      if (!seriesNumber) throw new Error("The next voucher number was not returned by the server.");
      setNextVoucherNumber(seriesNumber);
      setDialogOpen(true);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setLoadingVoucherNumber(false);
    }
  }

  function downloadVoucher(voucher) {
    const supplier = suppliers.find((item) => String(item.id) === String(voucher.supplierId));
    const transaction = supplier?.transactions.find((item) => String(item.id) === String(voucher.transactionId));
    try {
      downloadVoucherForPrint({
        voucher,
        supplier,
        transaction,
        preparedBy: user?.fullName || user?.username || ""
      });
    } catch (error) {
      window.alert(error.message);
    }
  }

  return (
    <div className="app-page voucher-page">
      <TrackRecordHeader title="Voucher Cheque Records" />
      <main className="voucher-main">
        <PageBackButton label="Back to Dashboard" onClick={onBack} />
        <section className="voucher-summary">
          <div><span>Total Vouchers</span><strong>{totalCount}</strong><small>Cancelled vouchers remain counted</small></div>
          <div><span>Issued</span><strong>{issued.length}</strong><small>{formatCurrency(issued.reduce((sum, item) => sum + Number(item.amountApplied), 0))} applied</small></div>
          <div><span>Cancelled</span><strong>{cancelled.length}</strong><small>Payments reversed</small></div>
        </section>
        <section className="voucher-card">
          <div className="management-heading">
            <div><p>Payment records</p><h2>Voucher Cheques</h2></div>
            <button className="primary-action" type="button" onClick={openVoucherForm} disabled={loadingVoucherNumber}>
              {loadingVoucherNumber ? "Loading voucher number…" : "+ Create Voucher"}
            </button>
          </div>
          <div className="records-toolbar">
            <input type="search" placeholder="Search voucher, supplier, P.O., or S.I.…" value={query} onChange={(event) => setQuery(event.target.value)} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Draft</option><option>Issued</option><option>Cancelled</option>{isAdmin && <option>Deleted</option>}</select>
          </div>
          <div className="financial-table-wrapper"><table className="financial-record-table voucher-table"><thead><tr><th>Voucher #</th><th>Supplier</th><th>P.O. #</th><th>S.I. #</th><th>Voucher Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filtered.length ? filtered.map((voucher) => {
              const effectiveStatus = voucherStatus(voucher);
              return (
              <tr className={voucher.deletedAt ? "is-deleted" : ""} key={voucher.id}>
                <td><strong>{voucher.voucherNumber}</strong></td><td>{voucher.supplierName}</td><td>{voucher.purchaseOrder}</td><td>{voucher.salesInvoice}</td><td>{formatRecordDate(voucher.voucherDate)}</td><td>{formatCurrency(voucher.amountApplied)}</td>
                <td><span className={`voucher-status voucher-status--${effectiveStatus.toLowerCase()}`}>{effectiveStatus}</span></td>
                <td><div className="row-actions">
                  {!voucher.deletedAt && <button type="button" onClick={() => setEditingVoucher(voucher)}>Edit</button>}
                  {!voucher.deletedAt && <button type="button" onClick={() => downloadVoucher(voucher)}>Download</button>}
                  {!voucher.deletedAt && effectiveStatus === "Draft" && <button type="button" onClick={() => runAction(() => onIssue(voucher.id))}>Issue</button>}
                  {!voucher.deletedAt && (!isAdmin || ["Draft", "Issued"].includes(effectiveStatus)) && <button className="danger-action" type="button" onClick={() => { if (window.confirm(`Delete voucher ${voucher.voucherNumber}? It will remain in Voucher Cheque records with Deleted status${effectiveStatus === "Issued" ? " and its payment will be reversed" : ""}.`)) runAction(() => onDelete(voucher.id, "Deleted from active voucher records")); }}>Delete</button>}
                </div></td>
              </tr>
              );
            }) : <tr><td colSpan="8" className="financial-records-empty">No voucher records found.</td></tr>}</tbody>
          </table></div>
        </section>
        {isAdmin && <section className="activity-card"><h2>Recent Audit Activity</h2>{activityRows.length ? <ul>{activityRows.map((item) => {
          const voucher = vouchers.find((record) => String(record.id) === String(item.entityId));
          const latestDeletion = latestVoucherDeletionAudit.get(String(item.entityId));
          const canManageDeletedVoucher = item.action === "VOUCHER_DELETED"
            && latestDeletion?.id === item.id
            && voucher?.deletedAt
            && voucher.restoreAllowed !== false;
          return <li key={item.id}>
            <div className="activity-entry"><strong>{item.action}</strong><span>{activityDetails(item.details)}</span><span>Performed by: {item.actorFullName || item.actorUsername || "Unknown account"}</span></div>
            <div className="activity-meta"><time>{new Date(item.createdAt).toLocaleString("en-PH")}</time>{canManageDeletedVoucher && <div className="activity-actions"><button type="button" onClick={() => runAction(() => onRestore(voucher.id))}>Restore</button><button className="danger-action" type="button" onClick={() => { if (window.confirm("Are you sure you want to permanently delete this record? This action cannot be undone.")) runAction(() => onPermanentDelete(voucher.id)); }}>Delete</button></div>}</div>
          </li>;
        })}</ul> : <p>No activity yet.</p>}</section>}
      </main>
      <VoucherEditorDialog isOpen={dialogOpen} voucherNumber={nextVoucherNumber} suppliers={suppliers} allowCancellation={!isAdmin} onSave={async (values) => { await onCreate(values); setDialogOpen(false); }} onClose={() => setDialogOpen(false)} />
      <VoucherEditorDialog isOpen={Boolean(editingVoucher)} voucher={editingVoucher} suppliers={suppliers} allowCancellation={!isAdmin} onSave={async (values) => { await onEdit(editingVoucher.id, values); setEditingVoucher(null); }} onClose={() => setEditingVoucher(null)} />
    </div>
  );
}
