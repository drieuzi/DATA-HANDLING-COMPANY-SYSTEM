import { useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

function getMonthKey(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date.slice(0, 7) : "";
}

function formatMonth(monthKey) {
  if (!monthKey) return "No Month Selected";
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function formatPaymentDate(value) {
  if (!value || value === "—") return "Not paid yet";
  return formatRecordDate(value);
}

export default function TotalSalesPage({ clients, onBack }) {
  const transactions = useMemo(() => clients.filter((client) => !client.deletedAt).flatMap((client) =>
    client.transactions.filter((transaction) => !transaction.deletedAt).map((transaction) => ({
      ...transaction,
      companyId: client.id,
      companyName: client.name,
      paymentDate: transaction.paymentDate || client.paymentDate || "—",
      monthKey: getMonthKey(transaction.date)
    }))
  ), [clients]);

  const availableMonths = useMemo(() => [...new Set(
    transactions.map((transaction) => transaction.monthKey).filter(Boolean)
  )].sort().reverse(), [transactions]);

  const [selectedMonth, setSelectedMonth] = useState(() => availableMonths[0] || "");
  const [query, setQuery] = useState("");

  const monthlyRows = useMemo(
    () => transactions.filter((transaction) => transaction.monthKey === selectedMonth),
    [transactions, selectedMonth]
  );

  const rows = useMemo(() => monthlyRows.filter((transaction) => {
    const searchText = `${transaction.companyName} ${transaction.purchaseOrder} ${transaction.salesInvoice}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }), [monthlyRows, query]);

  const monthlyTotal = monthlyRows.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  return (
    <div className="app-page total-sales-page">
      <TrackRecordHeader
        title="Total Sales of the Company"
        backLabel="Back to dashboard"
        onBack={onBack}
        variant="light"
      />

      <main className="total-sales-main">
        <section className="sales-report-card" aria-labelledby="salesMonthTitle">
          <div className="sales-report-toolbar">
            <label>
              Report Month
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {availableMonths.length ? availableMonths.map((month) => (
                  <option key={month} value={month}>{formatMonth(month)}</option>
                )) : <option value="">No dated transactions</option>}
              </select>
            </label>

            <label>
              Search Records
              <input
                type="search"
                placeholder="Company, P.O., or S.I. number"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          <h2 className="sales-month-title" id="salesMonthTitle">
            Month of {formatMonth(selectedMonth)}
          </h2>

          <div className="sales-table-wrapper">
            <table className="sales-report-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>P.O. #</th>
                  <th>Exact Payment Date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((transaction) => (
                  <tr key={`${transaction.companyId}-${transaction.id}`}>
                    <td>{transaction.companyName}</td>
                    <td>{transaction.purchaseOrder}</td>
                    <td>{formatPaymentDate(transaction.paymentDate)}</td>
                    <td>{formatCurrency(transaction.amount)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="sales-empty" colSpan="4">No sales records found for this month.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan="3">Monthly Total</th>
                  <td>{formatCurrency(monthlyTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
