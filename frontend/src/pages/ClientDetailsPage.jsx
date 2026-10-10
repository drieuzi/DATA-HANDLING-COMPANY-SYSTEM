import { useEffect, useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import TransactionEditorDialog from "../components/TransactionEditorDialog.jsx";
import ClientPaymentDialog from "../components/ClientPaymentDialog.jsx";
import ClientEditorDialog from "../components/ClientEditorDialog.jsx";
import ClientDepositDialog from "../components/ClientDepositDialog.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";
import TablePagination from "../components/TablePagination.jsx";
import useTablePagination, { TABLE_PAGE_SIZE } from "../hooks/useTablePagination.js";

export default function ClientDetailsPage({ client, user, focusTransactionId, onFocusHandled, onBack, onSaveTransaction, onDeleteTransaction, onRestoreTransaction, onReceivePayment, onConfirmDeposit, onRescheduleCheque, onSaveClient, onDeleteClient, onRestoreClient }) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [paymentTransaction, setPaymentTransaction] = useState(null);
  const [companyEditorOpen, setCompanyEditorOpen] = useState(false);
  const [depositTransaction, setDepositTransaction] = useState(null);
  const [highlightedTransactionId, setHighlightedTransactionId] = useState(null);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionStatus, setTransactionStatus] = useState("All");
  const isAdmin = user?.role === "admin";
  const activeTransactions = client.transactions.filter((transaction) => !transaction.deletedAt);
  const totalUnpaidAmount = activeTransactions.reduce(
    (total, transaction) => total + Number(transaction.balance || 0),
    0
  );
  const dueCheques = activeTransactions.filter((transaction) => transaction.depositDue);

  useEffect(() => {
    if (!focusTransactionId) return undefined;
    setHighlightedTransactionId(String(focusTransactionId));
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`client-transaction-${focusTransactionId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
    const timer = window.setTimeout(() => setHighlightedTransactionId(null), 4500);
    onFocusHandled?.();
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusTransactionId, onFocusHandled]);
  const filteredTransactions = useMemo(() => client.transactions.filter((transaction) => {
    if (transaction.deletedAt) return false;
    const effectiveStatus = transaction.billingStatus;
    const matchesStatus = transactionStatus === "All" || effectiveStatus === transactionStatus;
    const searchableDetails = [
      client.name,
      transaction.purchaseOrder,
      transaction.salesInvoice,
      transaction.collectionReceipt,
      transaction.tinNumber,
      transaction.date,
      transaction.amount,
      transaction.balance,
      effectiveStatus
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesStatus && searchableDetails.includes(transactionSearch.trim().toLowerCase());
  }), [client.transactions, transactionSearch, transactionStatus]);
  const pagination = useTablePagination(filteredTransactions, [transactionSearch, transactionStatus, client.id]);

  useEffect(() => {
    if (!focusTransactionId) return;
    const index = filteredTransactions.findIndex((transaction) => String(transaction.id) === String(focusTransactionId));
    if (index >= 0) pagination.setCurrentPage(Math.floor(index / TABLE_PAGE_SIZE) + 1);
  }, [focusTransactionId, filteredTransactions]);

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
          </> : <>
            <button type="button" onClick={() => setCompanyEditorOpen(true)}>Edit Client</button>
            <button className="danger-action" type="button" onClick={async () => { const reason = window.prompt(`Reason for deleting ${client.name}:`); if (!reason?.trim()) return; if (!window.confirm(`Delete ${client.name} and its linked transactions? An Admin can restore them later.`)) return; try { await onDeleteClient(client.id, reason.trim()); onBack(); } catch (error) { window.alert(error.message); } }}>Delete Client</button>
          </>}
        </div></div>
        <section className="client-information" aria-label={`${client.name} information`}>
          <div className="company-address-card">
            <span>Business Address</span>
            <strong>{client.businessAddress || "—"}</strong>
          </div>
          <div>
            <span>Company Name</span>
            <strong>{client.name}</strong>
          </div>
          <div>
            <span>Contact Person</span>
            <strong>{client.contactPerson || "—"}</strong>
          </div>
          <div>
            <span>Total Unpaid Amount</span>
            <strong>{formatCurrency(totalUnpaidAmount)}</strong>
          </div>
          <div>
            <span>Billing Status</span>
            <strong>{client.billingStatus}</strong>
          </div>
        </section>

        {dueCheques.length > 0 && <section className="deposit-notification" role="alert">
          <strong>{dueCheques.length} cheque deposit{dueCheques.length === 1 ? " is" : "s are"} due today or overdue.</strong>
          <span>Confirm each successful deposit or adjust its cheque date.</span>
        </section>}

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
                placeholder="Search P.O., S.I., C.R., or TIN"
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
                  <th>TIN #</th>
                  <th>Date</th>
                  <th>Collection Date</th>
                  <th>Cheque Date</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Billing Status</th>
                  <th>Deposit Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length ? pagination.pageItems.map((transaction) => (
                  <tr
                    id={`client-transaction-${transaction.id}`}
                    className={`${transaction.deletedAt ? "is-deleted" : ""}${String(transaction.id) === highlightedTransactionId ? " is-notification-target" : ""}`}
                    key={transaction.id}
                  >
                    <td>{transaction.purchaseOrder}</td>
                    <td>{transaction.salesInvoice}</td>
                    <td>{transaction.collectionReceipt}</td>
                    <td>{transaction.tinNumber || "—"}</td>
                    <td>{formatRecordDate(transaction.date)}</td>
                    <td>{formatRecordDate(transaction.collectionDate)}</td>
                    <td>{formatRecordDate(transaction.chequeDate)}</td>
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
                    <td><span className={`deposit-status${transaction.depositDue ? " deposit-status--due" : ""}`}>{transaction.depositDue ? "Due for Confirmation" : transaction.depositStatus}</span></td>
                    <td><div className="row-actions">
                      {!transaction.deletedAt && <button className="table-action" type="button" onClick={() => { setEditingTransaction(transaction); setEditorOpen(true); }}>Edit</button>}
                      {!transaction.deletedAt && Number(transaction.balance) > 0 && transaction.depositStatus !== "Pending Deposit" && <button type="button" onClick={() => setPaymentTransaction(transaction)}>Receive Cheque</button>}
                      {!transaction.deletedAt && transaction.depositStatus === "Pending Deposit" && <button type="button" title={transaction.depositDue ? "Confirm deposit or adjust its date" : "Adjust the scheduled cheque date"} onClick={() => setDepositTransaction(transaction)}>{transaction.depositDue ? "Review Deposit" : "Adjust Date"}</button>}
                      {!transaction.deletedAt && <button className="danger-action" type="button" onClick={async () => { const reason = window.prompt("Reason for deleting this client transaction:"); if (!reason?.trim()) return; if (!window.confirm("Delete this client transaction? It will be removed from the User transaction list and can be restored by an Admin.")) return; try { await onDeleteTransaction(transaction.id, reason.trim()); } catch (error) { window.alert(error.message); } }}>Delete</button>}
                      {isAdmin && !client.deletedAt && transaction.deletedAt && transaction.restoreAllowed !== false && <button type="button" onClick={async () => { try { await onRestoreTransaction(transaction.id); } catch (error) { window.alert(error.message); } }}>Restore</button>}
                    </div></td>
                  </tr>
                )) : <tr><td className="detail-records-empty" colSpan="12">No client transactions match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <TablePagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalRecords={filteredTransactions.length} onPageChange={pagination.setCurrentPage} />
        </section>
      </main>
      <ClientEditorDialog isOpen={companyEditorOpen} client={client} onSave={(values) => onSaveClient(client.id, values)} onClose={() => setCompanyEditorOpen(false)} />
      <TransactionEditorDialog isOpen={editorOpen} type="client" companyName={client.name} transaction={editingTransaction} onSave={async (values) => { await onSaveTransaction(client.id, values); setEditorOpen(false); }} onClose={() => setEditorOpen(false)} />
      <ClientPaymentDialog isOpen={Boolean(paymentTransaction)} transaction={paymentTransaction} clientName={client.name} onSave={(values) => onReceivePayment(paymentTransaction.id, values)} onClose={() => setPaymentTransaction(null)} />
      <ClientDepositDialog transaction={depositTransaction} clientName={client.name} onConfirm={onConfirmDeposit} onReschedule={onRescheduleCheque} onClose={() => setDepositTransaction(null)} />
    </div>
  );
}
