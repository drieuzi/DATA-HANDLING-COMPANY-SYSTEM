import { useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import VoucherEditorDialog from "../components/VoucherEditorDialog.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";
import { downloadVoucherForPrint } from "../utils/voucherDocument.js";
import { getNextVoucherNumber } from "../services/voucherApi.js";

function voucherStatus(voucher) {
  return voucher?.deletedAt ? "Deleted" : (voucher?.status || "Draft");
}

export default function VouchersPage({
  user, suppliers, vouchers, onBack, onCreate,
  onEdit, onIssue, onDelete
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
      </main>
      <VoucherEditorDialog isOpen={dialogOpen} voucherNumber={nextVoucherNumber} suppliers={suppliers} allowCancellation={!isAdmin} onSave={async (values) => { await onCreate(values); setDialogOpen(false); }} onClose={() => setDialogOpen(false)} />
      <VoucherEditorDialog isOpen={Boolean(editingVoucher)} voucher={editingVoucher} suppliers={suppliers} allowCancellation={!isAdmin} onSave={async (values) => { await onEdit(editingVoucher.id, values); setEditingVoucher(null); }} onClose={() => setEditingVoucher(null)} />
    </div>
  );
}
