import { useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import TransactionEditorDialog from "../components/TransactionEditorDialog.jsx";
import SupplierEditorDialog from "../components/SupplierEditorDialog.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

export default function SupplierDetailsPage({ supplier, user, onBack, onSaveTransaction, onDeleteTransaction, onRestoreTransaction, onSaveSupplier, onDeleteSupplier }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [companyEditorOpen, setCompanyEditorOpen] = useState(false);
  const isAdmin = user?.role === "admin";
  const activeTransactions = supplier.transactions.filter((transaction) => !transaction.deletedAt);
  const summary = activeTransactions.reduce(
    (totals, transaction) => ({
      amount: totals.amount + transaction.amount,
      balance: totals.balance + transaction.balance
    }),
    { amount: 0, balance: 0 }
  );

  return (
    <div className="app-page supplier-page supplier-details-page">
      <TrackRecordHeader
        title={`${supplier.name} Track Record`}
        backLabel="Back to supplier list"
        onBack={onBack}
      />

      <main className="supplier-details-main">
        <div className="management-toolbar"><span>Company controls</span><div className="row-actions">{!isAdmin && <button type="button" onClick={() => setCompanyEditorOpen(true)}>Edit Supplier</button>}<button className="danger-action" type="button" onClick={async () => { if (!window.confirm(`Delete ${supplier.name}? This is only allowed after its transactions are deleted.`)) return; try { await onDeleteSupplier(supplier.id, "Deleted from supplier track record"); onBack(); } catch (error) { window.alert(error.message); } }}>Delete Supplier</button></div></div>
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
            <div className="heading-actions"><span>{activeTransactions.length} active record(s)</span><button className="primary-action" type="button" onClick={() => { setEditingTransaction(null); setEditorOpen(true); }}>+ Add Transaction</button></div>
          </div>

          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Voucher #</th>
                  <th>Voucher Date</th>
                  <th>S.I. #</th>
                  <th>P.O. #</th>
                  <th>C.R. #</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Billing Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {supplier.transactions.map((transaction) => (
                  <tr className={transaction.deletedAt ? "is-deleted" : ""} key={transaction.id}>
                    <td>{transaction.voucherNumber || "—"}</td>
                    <td>{formatRecordDate(transaction.voucherDate)}</td>
                    <td>{transaction.salesInvoice}</td>
                    <td>{transaction.purchaseOrder}</td>
                    <td>{transaction.collectionReceipt}</td>
                    <td>{formatCurrency(transaction.amount)}</td>
                    <td>{formatCurrency(transaction.balance)}</td>
                    <td>
                      <span
                        className={`table-status table-status--${transaction.billingStatus
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                      >
                        {transaction.billingStatus}
                      </span>
                    </td>
                    <td><div className="row-actions">
                      {!isAdmin && !transaction.deletedAt && <button className="table-action" type="button" onClick={() => { setEditingTransaction(transaction); setEditorOpen(true); }}>Edit</button>}
                      {!transaction.deletedAt && <button className="danger-action" type="button" onClick={async () => { const reason = window.prompt("Reason for deleting this transaction:"); if (!reason?.trim()) return; try { await onDeleteTransaction(transaction.id, reason.trim()); } catch (error) { window.alert(error.message); } }}>Delete</button>}
                      {isAdmin && transaction.deletedAt && <button type="button" onClick={async () => { try { await onRestoreTransaction(transaction.id); } catch (error) { window.alert(error.message); } }}>Restore</button>}
                    </div></td>
                  </tr>
                ))}
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
