import { useEffect, useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import TablePagination from "../components/TablePagination.jsx";
import useTablePagination from "../hooks/useTablePagination.js";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import {
  createMonthlyVoucherRows,
  exportMonthlyVoucherReportPdf,
  formatReportMonth,
  getVoucherReportMonths,
  monthDateRange,
  monthlyVoucherTotal
} from "../utils/monthlyVoucherReport.js";

export default function MonthlyVoucherReportPage({ user, vouchers, onBack, onRecordExport }) {
  const months = useMemo(() => getVoucherReportMonths(vouchers), [vouchers]);
  const [month, setMonth] = useState(() => months[0]);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const rows = useMemo(() => createMonthlyVoucherRows(vouchers, month), [vouchers, month]);
  const pagination = useTablePagination(rows, [month]);
  const total = monthlyVoucherTotal(rows);

  useEffect(() => {
    if (!months.includes(month)) setMonth(months[0]);
  }, [month, months]);

  async function downloadPdf() {
    if (!rows.length) {
      setMessage("There are no voucher records to download for the selected month.");
      return;
    }
    setDownloading(true);
    setMessage("");
    try {
      const { from, to } = monthDateRange(month);
      if (onRecordExport) {
        await onRecordExport({
          reportType: "monthly_vouchers",
          format: "pdf",
          template: "office",
          filterStatus: "All",
          from,
          to,
          recordCount: rows.length
        });
      }
      await exportMonthlyVoucherReportPdf(rows, month, user?.fullName || user?.username);
      setMessage("Monthly voucher PDF downloaded successfully.");
    } catch (error) {
      setMessage(error.message || "The monthly voucher report could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="app-page voucher-page monthly-voucher-report-page">
      <TrackRecordHeader title="Monthly Voucher Report" />
      <main className="voucher-main">
        <PageBackButton label="Back to Voucher Cheque" onClick={onBack} />

        <section className="voucher-card monthly-voucher-report-card">
          <div className="management-heading monthly-voucher-report-heading">
            <div><p>Vouchers made during</p><h2>{formatReportMonth(month)}</h2></div>
            <button className="primary-action" type="button" disabled={downloading || !rows.length} onClick={downloadPdf}>
              {downloading ? "Creating PDF…" : "Download PDF"}
            </button>
          </div>

          <div className="monthly-voucher-report-controls">
            <label className="records-filter-field">
              <span>Report month</span>
              <select value={month} onChange={(event) => { setMonth(event.target.value); setMessage(""); }}>
                {months.map((value) => <option key={value} value={value}>{formatReportMonth(value)}</option>)}
              </select>
            </label>
            <div><span>Voucher records</span><strong>{rows.length}</strong></div>
            <div><span>Monthly total</span><strong>{formatCurrency(total)}</strong></div>
          </div>

          <div className="financial-table-wrapper">
            <table className="financial-record-table monthly-voucher-report-table">
              <thead><tr><th>Voucher #</th><th>Supplier</th><th>P.O. #</th><th>S.I. #</th><th>Voucher Date</th><th>Type of Payment</th><th>Cheque No.</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {rows.length ? pagination.pageItems.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.voucherNumber}</strong></td>
                    <td>{row.supplierName}</td>
                    <td>{row.purchaseOrder}</td>
                    <td>{row.salesInvoice}</td>
                    <td>{row.voucherDate}</td>
                    <td>{row.paymentType}</td>
                    <td>{row.chequeNumber}</td>
                    <td>{formatCurrency(row.amount)}</td>
                    <td><span className={`voucher-status voucher-status--${String(row.status).toLowerCase()}`}>{row.status}</span></td>
                  </tr>
                )) : <tr><td colSpan="9" className="financial-records-empty">No voucher records were made during this month.</td></tr>}
              </tbody>
              {rows.length > 0 && <tfoot><tr><th colSpan="7">Monthly Total</th><th>{formatCurrency(total)}</th><th>{rows.length} voucher(s)</th></tr></tfoot>}
            </table>
          </div>
          <TablePagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalRecords={rows.length} onPageChange={pagination.setCurrentPage} />
          {message && <p className="monthly-voucher-report-message" role="status">{message}</p>}
        </section>
      </main>
    </div>
  );
}
