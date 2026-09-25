import { useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import TransactionEditorDialog from "../components/TransactionEditorDialog.jsx";
import ClientPaymentDialog from "../components/ClientPaymentDialog.jsx";
import ClientEditorDialog from "../components/ClientEditorDialog.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

export default function ClientDetailsPage({ client, user, onBack, onSaveTransaction, onDeleteTransaction, onRestoreTransaction, onReceivePayment, onSaveClient, onDeleteClient, onRestoreClient, onPermanentDeleteClient }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [paymentTransaction, setPaymentTransaction] = useState(null);
  const [companyEditorOpen, setCompanyEditorOpen] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionStatus, setTransactionStatus] = useState("All");
  const isAdmin = user?.role === "admin";
  const activeTransactions = client.transactions.filter((transaction) => !transaction.deletedAt);
  const summaryTransactions = client.deletedAt && isAdmin ? client.transactions : activeTransactions;
  const summary = summaryTransactions.reduce(
    (totals, transaction) => ({
      amount: totals.amount + Number(transaction.amount || 0),
      balance: totals.balance + Number(transaction.balance || 0)
    }),
    { amount: 0, balance: 0 }
  );
  const filteredTransactions = useMemo(() => client.transactions.filter((transaction) => {
    if (!isAdmin && transaction.deletedAt) return false;
    const effectiveStatus = transaction.deletedAt ? "Deleted" : transaction.billingStatus;
    const matchesStatus = transactionStatus === "All" || effectiveStatus === transactionStatus;
    const searchableDetails = [
      client.name,
      transaction.purchaseOrder,
      transaction.salesInvoice,
      transaction.collectionReceipt,
      transaction.date,
      transaction.amount,
      transaction.balance,
      effectiveStatus
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && searchableDetails.includes(transactionSearch.trim().toLowerCase());
  }), [client.transactions, isAdmin, transactionSearch, transactionStatus]);
  return (
    <div className="app-page client-details-page">
      <TrackRecordHeader
        title={`${client.name} Track Record`}
      />

      <main className="client-details-main">
        <PageBackButton label="Back to Client Names and Records" onClick={onBack} />
        <div className="management-toolbar"><span>{client.deletedAt ? "Deleted company controls" : "Company controls"}</span><div className="row-actions">
          {client.deletedAt ? <>
            <button type="button" onClick={async () => { try { await onRestoreClient(client.id); } catch (error) { window.alert(error.message); } }}>Restore Client</button>
            <button className="danger-action" type="button" onClick={async () => { if (!window.confirm("Are you sure you want to permanently delete this client and its linked records? This action cannot be undone.")) return; try { await onPermanentDeleteClient(client.id); } catch (error) { window.alert(error.message); } }}>Delete Permanently</button>
          </> : <>
            <button type="button" onClick={() => setCompanyEditorOpen(true)}>Edit Client</button>
            <button className="danger-action" type="button" onClick={async () => { const reason = window.prompt(`Reason for deleting ${client.name}:`); if (!reason?.trim()) return; if (!window.confirm(`Delete ${client.name} and its linked transactions? An Admin can restore them later.`)) return; try { await onDeleteClient(client.id, reason.trim()); onBack(); } catch (error) { window.alert(error.message); } }}>Delete Client</button>
          </>}
        </div></div>
        <section className="client-information" aria-label={`${client.name} information`}>
          <div>
            <span>Company Name</span>
            <strong>{client.name}</strong>
          </div>
          <div>
            <span>Total Sales</span>
            <strong>{formatCurrency(summary.amount)}</strong>
          </div>
          <div>
            <span>Remaining Balance</span>
            <strong>{formatCurrency(summary.balance)}</strong>
          </div>
          <div>
            <span>Billing Status</span>
            <strong>{client.billingStatus}</strong>
          </div>
        </section>

        <section className="client-records" aria-label={`${client.name} transaction records`}>
          <div className="client-records-heading">
            <div>
              <p>Client records</p>
              <h2>Transactions</h2>
            </div>
            <div className="heading-actions"><span>{activeTransactions.length} active record(s)</span>{!client.deletedAt && <button className="primary-action" type="button" onClick={() => { setEditingTransaction(null); setEditorOpen(true); }}>+ Add Transaction</button>}</div>
          </div>

          <div className="detail-record-filters">
            <label>
              <span>Search transactions</span>
              <input
                type="search"
                placeholder="Search P.O., S.I., or C.R."
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

          <div className="client-table-wrapper">
            <table className="client-record-table">
              <thead>
                <tr>
                  <th>P.O. #</th>
                  <th>S.I. #</th>
                  <th>C.R. #</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Billing Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length ? filteredTransactions.map((transaction) => (
                  <tr className={transaction.deletedAt ? "is-deleted" : ""} key={transaction.id}>
                    <td>{transaction.purchaseOrder}</td>
                    <td>{transaction.salesInvoice}</td>
                    <td>{transaction.collectionReceipt}</td>
                    <td>{formatRecordDate(transaction.date)}</td>
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
                      {!transaction.deletedAt && Number(transaction.balance) > 0 && <button type="button" onClick={() => setPaymentTransaction(transaction)}>Receive Payment</button>}
                      {!transaction.deletedAt && <button className="danger-action" type="button" onClick={async () => { const reason = window.prompt("Reason for deleting this client transaction:"); if (!reason?.trim()) return; if (!window.confirm("Delete this client transaction? It will be removed from the User transaction list and can be restored by an Admin.")) return; try { await onDeleteTransaction(transaction.id, reason.trim()); } catch (error) { window.alert(error.message); } }}>Delete</button>}
                      {isAdmin && !client.deletedAt && transaction.deletedAt && transaction.restoreAllowed !== false && <button type="button" onClick={async () => { try { await onRestoreTransaction(transaction.id); } catch (error) { window.alert(error.message); } }}>Restore</button>}
                    </div></td>
                  </tr>
                )) : <tr><td className="detail-records-empty" colSpan="8">No client transactions match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <ClientEditorDialog isOpen={companyEditorOpen} client={client} onSave={(values) => onSaveClient(client.id, values)} onClose={() => setCompanyEditorOpen(false)} />
      <TransactionEditorDialog isOpen={editorOpen} type="client" companyName={client.name} transaction={editingTransaction} onSave={async (values) => { await onSaveTransaction(client.id, values); setEditorOpen(false); }} onClose={() => setEditorOpen(false)} />
      <ClientPaymentDialog isOpen={Boolean(paymentTransaction)} transaction={paymentTransaction} clientName={client.name} onSave={(values) => onReceivePayment(paymentTransaction.id, values)} onClose={() => setPaymentTransaction(null)} />
    </div>
  );
}
