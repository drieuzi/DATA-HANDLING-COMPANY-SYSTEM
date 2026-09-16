import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";

function formatDate(value) {
  if (!value || value === "—") return "—";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

export default function SupplierDetailsPage({ supplier, onBack }) {
  const summary = supplier.transactions.reduce(
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
            <span>{supplier.transactions.length} record(s)</span>
          </div>

          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Voucher Date</th>
                  <th>Payment Date</th>
                  <th>S.I. #</th>
                  <th>P.O. #</th>
                  <th>C.R. #</th>
                  <th>Cheque Date</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Billing Status</th>
                </tr>
              </thead>
              <tbody>
                {supplier.transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{formatDate(transaction.voucherDate)}</td>
                    <td>{formatDate(transaction.paymentDate)}</td>
                    <td>{transaction.salesInvoice}</td>
                    <td>{transaction.purchaseOrder}</td>
                    <td>{transaction.collectionReceipt}</td>
                    <td>{formatDate(transaction.chequeDate)}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
