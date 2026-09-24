import { useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

function getMonthKey(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date.slice(0, 7) : "";
}

function formatMonth(monthKey) {
  if (!monthKey) return "No Month Selected";
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

export default function TotalPurchasesPage({ suppliers, vouchers, onBack }) {
  const paidPurchases = useMemo(() => suppliers
    .filter((supplier) => !supplier.deletedAt)
    .flatMap((supplier) => supplier.transactions
      .filter((transaction) => !transaction.deletedAt && (transaction.billingStatus === "Paid" || Number(transaction.balance) === 0))
      .map((transaction) => {
        const voucher = vouchers.find((item) => !item.deletedAt
          && String(item.transactionId) === String(transaction.id)
          && item.status === "Issued");
        const paymentDate = voucher?.paymentDate || transaction.paymentDate || "";
        return {
          ...transaction,
          companyId: supplier.id,
          companyName: supplier.name,
          voucherNumber: voucher?.voucherNumber || transaction.voucherNumber || "—",
          paymentDate,
          withholdingTax: Number(voucher?.withholdingTaxAmount || 0),
          grossAmount: Number(transaction.amount || voucher?.amountApplied || 0),
          monthKey: getMonthKey(paymentDate)
        };
      })), [suppliers, vouchers]);

  const availableMonths = useMemo(() => [...new Set(
    paidPurchases.map((transaction) => transaction.monthKey).filter(Boolean)
  )].sort().reverse(), [paidPurchases]);
  const [selectedMonth, setSelectedMonth] = useState(() => availableMonths[0] || "");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => paidPurchases.filter((transaction) => {
    const matchesMonth = transaction.monthKey === selectedMonth;
    const searchable = `${transaction.companyName} ${transaction.voucherNumber} ${transaction.purchaseOrder}`.toLowerCase();
    return matchesMonth && searchable.includes(query.trim().toLowerCase());
  }), [paidPurchases, query, selectedMonth]);

  const monthlyGrossTotal = rows.reduce((sum, transaction) => sum + transaction.grossAmount, 0);
  const monthlyWithholdingTotal = rows.reduce((sum, transaction) => sum + transaction.withholdingTax, 0);

  return (
    <div className="app-page total-purchases-page">
      <TrackRecordHeader title="Total Purchases of the Company" variant="light" />
      <main className="financial-records-main total-purchases-main">
        <PageBackButton label="Back to Dashboard" onClick={onBack} />
        <section className="financial-records-card" aria-labelledby="purchaseRecordsTitle">
          <div className="financial-records-heading">
            <div><p>Paid supplier transactions</p><h2 id="purchaseRecordsTitle">Monthly Purchases</h2></div>
            <span>{rows.length} paid record(s)</span>
          </div>
          <div className="records-toolbar purchase-records-toolbar">
            <label>
              <span>Report month</span>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {availableMonths.length ? availableMonths.map((month) => (
                  <option key={month} value={month}>{formatMonth(month)}</option>
                )) : <option value="">No paid purchases</option>}
              </select>
            </label>
            <label>
              <span>Search records</span>
              <input type="search" placeholder="Supplier, voucher, or P.O. number" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          <div className="purchase-month-banner">Month of {formatMonth(selectedMonth)}</div>
          <div className="financial-table-wrapper">
            <table className="financial-record-table purchase-record-table">
              <thead><tr><th>Supplier</th><th>Voucher #</th><th>P.O. #</th><th>Payment Date</th><th>Withholding Tax</th><th>Tax-Inclusive Purchase</th></tr></thead>
              <tbody>{rows.length ? rows.map((transaction) => (
                <tr key={`${transaction.companyId}-${transaction.id}`}>
                  <td>{transaction.companyName}</td>
                  <td>{transaction.voucherNumber}</td>
                  <td>{transaction.purchaseOrder}</td>
                  <td>{formatRecordDate(transaction.paymentDate)}</td>
                  <td>{formatCurrency(transaction.withholdingTax)}</td>
                  <td>{formatCurrency(transaction.grossAmount)}</td>
                </tr>
              )) : <tr><td className="financial-records-empty" colSpan="6">No paid supplier transactions found for this month.</td></tr>}</tbody>
              <tfoot>
                <tr><th colSpan="4">Monthly Total</th><td>{formatCurrency(monthlyWithholdingTotal)}</td><td>{formatCurrency(monthlyGrossTotal)}</td></tr>
              </tfoot>
            </table>
          </div>
          <p className="purchase-total-note">The purchase total uses the full paid supplier amount. The 1% withholding tax is shown separately and is not deducted from the company’s total purchase cost.</p>
        </section>
      </main>
    </div>
  );
}
