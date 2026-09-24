import { useEffect, useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

function getMonthKey(date) {
  const match = String(date || "").match(/^(\d{4}-\d{2})-\d{2}/);
  return match?.[1] || "";
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

  useEffect(() => {
    if (availableMonths.length && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const monthlyRows = useMemo(
    () => transactions.filter((transaction) => transaction.monthKey === selectedMonth),
    [transactions, selectedMonth]
  );

  const rows = useMemo(() => monthlyRows.filter((transaction) => {
    const searchText = `${transaction.companyName} ${transaction.purchaseOrder} ${transaction.voucherNumber || ""} ${transaction.date || ""}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }), [monthlyRows, query]);

  const monthlyTotal = monthlyRows.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  return (
    <div className="app-page total-sales-page">
      <TrackRecordHeader
        title="Total Sales of the Company"
        variant="light"
      />

      <main className="financial-records-main total-sales-main">
        <PageBackButton label="Back to Dashboard" onClick={onBack} />
        <section className="financial-records-card sales-report-card" aria-labelledby="salesMonthTitle">
          <div className="financial-records-heading">
            <div><p>Client transaction records</p><h2 id="salesMonthTitle">Monthly Sales</h2></div>
            <span>{rows.length} record(s)</span>
          </div>
          <div className="records-toolbar sales-report-toolbar">
            <label>
              <span>Report Month</span>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {availableMonths.length ? availableMonths.map((month) => (
                  <option key={month} value={month}>{formatMonth(month)}</option>
                )) : <option value="">No dated transactions</option>}
              </select>
            </label>

            <label>
              <span>Search Records</span>
              <input
                type="search"
                placeholder="Company, P.O., or voucher number"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          <div className="sales-month-title">
            Month of {formatMonth(selectedMonth)}
          </div>

          <div className="financial-table-wrapper sales-table-wrapper">
            <table className="financial-record-table sales-report-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Voucher #</th>
                  <th>P.O. #</th>
                  <th>Transaction Date</th>
                  <th>Exact Payment Date</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((transaction) => (
                  <tr key={`${transaction.companyId}-${transaction.id}`}>
                    <td>{transaction.companyName}</td>
                    <td>{transaction.voucherNumber || "—"}</td>
                    <td>{transaction.purchaseOrder}</td>
                    <td>{formatRecordDate(transaction.date)}</td>
                    <td>{formatPaymentDate(transaction.paymentDate)}</td>
                    <td>{formatCurrency(transaction.amount)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="sales-empty" colSpan="6">No sales records found for this month.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan="5">Monthly Total</th>
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
