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

export default function ClientDetailsPage({ client, onBack }) {
  return (
    <div className="app-page client-details-page">
      <TrackRecordHeader
        title={`${client.name} Track Record`}
        backLabel="Back to client list"
        onBack={onBack}
      />

      <main className="client-details-main">
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
            <strong>{formatDate(client.paymentDate)}</strong>
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
            <span>{client.transactions.length} record(s)</span>
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
                </tr>
              </thead>
              <tbody>
                {client.transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.purchaseOrder}</td>
                    <td>{transaction.salesInvoice}</td>
                    <td>{transaction.collectionReceipt}</td>
                    <td>{formatDate(transaction.date)}</td>
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
