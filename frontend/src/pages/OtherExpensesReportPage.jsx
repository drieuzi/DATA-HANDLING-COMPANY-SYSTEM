import { useMemo, useState } from "react";
import TrackRecordHeader from "../components/TrackRecordHeader.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import TablePagination from "../components/TablePagination.jsx";
import useTablePagination from "../hooks/useTablePagination.js";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { createFileReport, exportFileReportToPdf, reportTotal } from "../utils/reportExport.js";

export default function OtherExpensesReportPage({ user, rows, dateRange, onBack, onRecordExport }) {
  const [template, setTemplate] = useState("bir");
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const report = useMemo(() => createFileReport({
    source: "other_expenses",
    template,
    status: "All",
    from: "",
    to: "",
    clients: [],
    suppliers: [],
    outsideServices: rows
  }), [template, rows]);
  const pagination = useTablePagination(report.rows, [template, rows]);

  async function downloadReport() {
    if (!report.rows.length) return setMessage("There are no filtered records to export.");
    setDownloading(true);
    setMessage("");
    try {
      await onRecordExport?.({
        reportType: "other_expenses",
        format: "pdf",
        template,
        filterStatus: "All",
        from: dateRange.from || null,
        to: dateRange.to || null,
        recordCount: report.rows.length
      });
      await exportFileReportToPdf(report, {
        ...dateRange,
        source: "other_expenses",
        template,
        status: "All",
        generatedBy: user.fullName || user.username
      });
      setMessage(`${report.templateTitle} downloaded successfully.`);
    } catch (error) {
      setMessage(error.message || "The report could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="app-page outside-services-page outside-services-report-page">
      <TrackRecordHeader title="Other Expenses File Report" variant="light" />
      <main className="financial-records-main outside-services-main">
        <PageBackButton label="Back to Other Expenses" onClick={onBack} />

        <section className="report-export-card outside-services-report-card" aria-labelledby="otherExpensesReportTitle">
          <div className="report-export-heading">
            <div><p>Other expense records</p><h2 id="otherExpensesReportTitle">Report Preview</h2></div>
            <span>{report.rows.length} record(s) in preview</span>
          </div>

          <div className="report-template-picker" aria-label="Other Expenses report format">
            <button className={template === "bir" ? "is-selected" : ""} type="button" onClick={() => setTemplate("bir")}>BIR Report</button>
            <button className={template === "office" ? "is-selected" : ""} type="button" onClick={() => setTemplate("office")}>Office Report</button>
          </div>

          <div className="report-export-summary outside-services-report-summary">
            <div><span>Preview format</span><strong>{report.templateTitle}</strong></div>
            <div><span>Report</span><strong>Other Expenses Report</strong></div>
            <div><span>Report total</span><strong>{formatCurrency(reportTotal(report))}</strong></div>
          </div>

          <div className="report-preview-sheet">
            <div className="report-preview-company">
              <strong>ILLUMINUX GENERAL MERCH CO.</strong>
              <span>Blk. 4, Queenstown 1 Heights, Brgy. San Luis, Antipolo City</span>
              <h2>{report.templateTitle} — Other Expenses Report</h2>
            </div>
            <div className="financial-table-wrapper">
              <table className="financial-record-table report-preview-table outside-services-report-table">
                <thead><tr>{report.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
                <tbody>{report.rows.length ? pagination.pageItems.map((row, index) => (
                  <tr key={`${template}-${index}`}>{report.columns.map((column) => <td key={column.key}>{column.type === "money" ? formatCurrency(row[column.key]) : row[column.key]}</td>)}</tr>
                )) : <tr><td className="financial-records-empty" colSpan={report.columns.length}>No filtered records are available.</td></tr>}</tbody>
                {report.rows.length > 0 && <tfoot><tr><th colSpan={report.columns.length - 1}>Total</th><th>{formatCurrency(reportTotal(report))}</th></tr></tfoot>}
              </table>
            </div>
            <TablePagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalRecords={report.rows.length} onPageChange={pagination.setCurrentPage} />
          </div>

          <div className="report-export-actions">
            <button className="primary-action" type="button" disabled={downloading || !report.rows.length} onClick={downloadReport}>{downloading ? "Creating PDF…" : "Download PDF"}</button>
          </div>
          {message && <p className="outside-services-report-message" role="status">{message}</p>}
        </section>
      </main>
    </div>
  );
}
