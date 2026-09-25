import { useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import TransactionEditorDialog from "../components/TransactionEditorDialog.jsx";
import SupplierEditorDialog from "../components/SupplierEditorDialog.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

export default function SupplierDetailsPage({ supplier, user, onBack, onSaveTransaction, onDeleteTransaction, onRestoreTransaction, onSaveSupplier, onDeleteSupplier, onRestoreSupplier, onPermanentDeleteSupplier }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [companyEditorOpen, setCompanyEditorOpen] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionStatus, setTransactionStatus] = useState("All");
  const isAdmin = user?.role === "admin";
  const activeTransactions = supplier.transactions.filter((transaction) => !transaction.deletedAt);
  const summaryTransactions = supplier.deletedAt && isAdmin ? supplier.transactions : activeTransactions;
  const summary = summaryTransactions.reduce(
    (totals, transaction) => ({
      amount: totals.amount + transaction.amount,
      balance: totals.balance + transaction.balance
    }),
    { amount: 0, balance: 0 }
  );
  const filteredTransactions = useMemo(() => supplier.transactions.filter((transaction) => {
    if (!isAdmin && transaction.deletedAt) return false;
    const effectiveStatus = transaction.deletedAt ? "Deleted" : transaction.billingStatus;
    const matchesStatus = transactionStatus === "All" || effectiveStatus === transactionStatus;
    const searchableDetails = [
      supplier.name,
      transaction.voucherNumber,
      transaction.salesInvoice,
      transaction.purchaseOrder,
      transaction.voucherDate,
      transaction.amount,
      transaction.balance,
      effectiveStatus
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && searchableDetails.includes(transactionSearch.trim().toLowerCase());
  }), [isAdmin, supplier.transactions, transactionSearch, transactionStatus]);

  return (
    <div className="app-page supplier-page supplier-details-page">
      <TrackRecordHeader
        title={`${supplier.name} Track Record`}
      />

      <main className="supplier-details-main">
        <PageBackButton label="Back to Supplier Names and Records" onClick={onBack} />
        <div className="management-toolbar"><span>{supplier.deletedAt ? "Deleted company controls" : "Company controls"}</span><div className="row-actions">
          {supplier.deletedAt ? <>
            <button type="button" onClick={async () => { try { await onRestoreSupplier(supplier.id); } catch (error) { window.alert(error.message); } }}>Restore Supplier</button>
            <button className="danger-action" type="button" onClick={async () => { if (!window.confirm("Are you sure you want to permanently delete this supplier and its linked records? This action cannot be undone.")) return; try { await onPermanentDeleteSupplier(supplier.id); } catch (error) { window.alert(error.message); } }}>Delete Permanently</button>
          </> : <>
            <button type="button" onClick={() => setCompanyEditorOpen(true)}>Edit Supplier</button>
            <button className="danger-action" type="button" onClick={async () => { const reason = window.prompt(`Reason for deleting ${supplier.name}:`); if (!reason?.trim()) return; if (!window.confirm(`Delete ${supplier.name} and its linked transactions? An Admin can restore them later.`)) return; try { await onDeleteSupplier(supplier.id, reason.trim()); onBack(); } catch (error) { window.alert(error.message); } }}>Delete Supplier</button>
          </>}
        </div></div>
        <section className="supplier-summary" aria-label={`${supplier.name} summary`}>
          <div>
            <span>Supplier</span>
            <strong>{supplier.name}</strong>
          </div>
          <div>
            <span>Total Purchases</span>
            <strong>{formatCurrency(summary.amount)}</strong>
          </div>
          <div>
            <span>Remaining Balance</span>
            <strong>{formatCurrency(summary.balance)}</strong>
          </div>
          <div>
            <span>Billing Status</span>
            <strong>{supplier.billingStatus}</strong>
          </div>
        </section>

        <section className="supplier-transactions" aria-labelledby="transactionsTitle">
          <div className="transactions-title-row">
            <div>
              <p>Supplier records</p>
              <h2 id="transactionsTitle">Transactions</h2>
            </div>
            <div className="heading-actions"><span>{activeTransactions.length} active record(s)</span>{!supplier.deletedAt && <button className="primary-action" type="button" onClick={() => { setEditingTransaction(null); setEditorOpen(true); }}>+ Add Transaction</button>}</div>
          </div>

          <div className="detail-record-filters">
            <label>
              <span>Search transactions</span>
              <input
                type="search"
                placeholder="Search voucher, P.O., or S.I."
                value={transactionSearch}
                onChange={(event) => setTransactionSearch(event.target.value)}
              />
            </label>
            <label>
              <span>Billing status</span>
              <select value={transactionStatus} onChange={(event) => setTransactionStatus(event.target.value)}>
                <option>All</option>
                <option>Not Paid</option>
                <option>Paid</option>
                {isAdmin && <option>Deleted</option>}
              </select>
            </label>
          </div>

          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Voucher #</th>
                  <th>Voucher Date</th>
                  <th>S.I. #</th>
                  <th>P.O. #</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Billing Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length ? filteredTransactions.map((transaction) => (
                  <tr className={transaction.deletedAt ? "is-deleted" : ""} key={transaction.id}>
                    <td>{transaction.voucherNumber || "—"}</td>
                    <td>{formatRecordDate(transaction.voucherDate)}</td>
                    <td>{transaction.salesInvoice}</td>
                    <td>{transaction.purchaseOrder}</td>
                    <td>{formatCurrency(transaction.amount)}</td>
                    <td>{formatCurrency(transaction.balance)}</td>
                    <td>
                      <span
                        className={`table-status table-status--${(transaction.deletedAt ? "Deleted" : transaction.billingStatus)
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                      >
                        {transaction.deletedAt ? "Deleted" : transaction.billingStatus}
                      </span>
                    </td>
                    <td><div className="row-actions">
                      {!transaction.deletedAt && <button className="table-action" type="button" onClick={() => { setEditingTransaction(transaction); setEditorOpen(true); }}>Edit</button>}
                      {!transaction.deletedAt && <button className="danger-action" type="button" onClick={async () => { const reason = window.prompt("Reason for deleting this transaction:"); if (!reason?.trim()) return; try { await onDeleteTransaction(transaction.id, reason.trim()); } catch (error) { window.alert(error.message); } }}>Delete</button>}
                      {isAdmin && !supplier.deletedAt && transaction.deletedAt && transaction.restoreAllowed !== false && <button type="button" onClick={async () => { try { await onRestoreTransaction(transaction.id); } catch (error) { window.alert(error.message); } }}>Restore</button>}
                    </div></td>
                  </tr>
                )) : <tr><td className="detail-records-empty" colSpan="8">No supplier transactions match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <SupplierEditorDialog isOpen={companyEditorOpen} supplier={supplier} onSave={(values) => onSaveSupplier(supplier.id, values)} onClose={() => setCompanyEditorOpen(false)} />
      <TransactionEditorDialog isOpen={editorOpen} type="supplier" companyName={supplier.name} transaction={editingTransaction} onSave={async (values) => { await onSaveTransaction(supplier.id, values); setEditorOpen(false); }} onClose={() => setEditorOpen(false)} />
    </div>
  );
}
