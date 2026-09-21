import { useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import TransactionEditorDialog from "../components/TransactionEditorDialog.jsx";
import ClientPaymentDialog from "../components/ClientPaymentDialog.jsx";
import ClientEditorDialog from "../components/ClientEditorDialog.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

export default function ClientDetailsPage({ client, user, onBack, onSaveTransaction, onDeleteTransaction, onRestoreTransaction, onReceivePayment, onSaveClient, onDeleteClient }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [paymentTransaction, setPaymentTransaction] = useState(null);
  const [companyEditorOpen, setCompanyEditorOpen] = useState(false);
  const isAdmin = user?.role === "admin";
  const activeTransactions = client.transactions.filter((transaction) => !transaction.deletedAt);
  return (
    <div className="app-page client-details-page">
      <TrackRecordHeader
        title={`${client.name} Track Record`}
        backLabel="Back to client list"
        onBack={onBack}
      />

      <main className="client-details-main">
        <div className="management-toolbar"><span>Company controls</span><div className="row-actions">{!isAdmin && <button type="button" onClick={() => setCompanyEditorOpen(true)}>Edit Client</button>}<button className="danger-action" type="button" onClick={async () => { if (!window.confirm(`Delete ${client.name}? This is only allowed after its transactions are deleted.`)) return; try { await onDeleteClient(client.id, "Deleted from client track record"); onBack(); } catch (error) { window.alert(error.message); } }}>Delete Client</button></div></div>
        <section className="client-information" aria-label={`${client.name} information`}>
          <div>
            <span>Company Name</span>
            <strong>{client.name}</strong>
          </div>
          <div>
            <span>Business Address</span>
            <strong>{client.businessAddress}</strong>
          </div>
          <div>
            <span>Payment Date</span>
            <strong>{formatRecordDate(client.paymentDate)}</strong>
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
            <div className="heading-actions"><span>{activeTransactions.length} active record(s)</span><button className="primary-action" type="button" onClick={() => { setEditingTransaction(null); setEditorOpen(true); }}>+ Add Transaction</button></div>
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
                {client.transactions.map((transaction) => (
                  <tr className={transaction.deletedAt ? "is-deleted" : ""} key={transaction.id}>
                    <td>{transaction.purchaseOrder}</td>
                    <td>{transaction.salesInvoice}</td>
                    <td>{transaction.collectionReceipt}</td>
                    <td>{formatRecordDate(transaction.date)}</td>
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
                      {!transaction.deletedAt && Number(transaction.balance) > 0 && <button type="button" onClick={() => setPaymentTransaction(transaction)}>Receive Payment</button>}
                      {!transaction.deletedAt && <button className="danger-action" type="button" onClick={async () => { const reason = window.prompt("Reason for deleting this client transaction:"); if (!reason?.trim()) return; try { await onDeleteTransaction(transaction.id, reason.trim()); } catch (error) { window.alert(error.message); } }}>Delete</button>}
                      {isAdmin && transaction.deletedAt && <button type="button" onClick={async () => { try { await onRestoreTransaction(transaction.id); } catch (error) { window.alert(error.message); } }}>Restore</button>}
                    </div></td>
                  </tr>
                ))}
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
