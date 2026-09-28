import { useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import {
  createFileReport, exportFileReportToPdf, FILE_REPORT_SOURCES,
  FILE_REPORT_STATUSES, FILE_REPORT_TEMPLATES, reportTotal
} from "../utils/reportExport.js";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2
});

export default function ReportExportPage({ user, clients, suppliers, onBack, onLogout, onRecordExport }) {
  const [source, setSource] = useState("sales");
  const [template, setTemplate] = useState("bir");
  const [status, setStatus] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const report = useMemo(() => createFileReport({
    source, template, status, from, to, clients, suppliers
  }), [source, template, status, from, to, clients, suppliers]);

  async function downloadPdf() {
    if (from && to && from > to) return setMessage("From date must not be later than To date.");
    if (!report.rows.length) return setMessage("There are no records to export for the selected filters.");
    setExporting(true);
    setMessage("");
    try {
      await onRecordExport({
        reportType: source, format: "pdf", template, filterStatus: status,
        from: from || null, to: to || null, recordCount: report.rows.length
      });
      await exportFileReportToPdf(report, {
        from, to, source, template, status, generatedBy: user.fullName || user.username
      });
      setMessage(`${report.templateTitle} PDF downloaded successfully.`);
    } catch (error) {
      setMessage(error.message || "The report could not be exported.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="app-page report-export-page">
      <Header user={user} onLogout={onLogout} />
      <main className="report-export-main">
        <PageBackButton label="Back to Dashboard" onClick={onBack} />
        <section className="report-export-card">
          <div className="report-export-heading">
            <div><p>Administrator tools</p><h1>File Report</h1></div>
            <span>{report.rows.length} record(s) in preview</span>
          </div>

          <div className="report-template-picker" aria-label="Report template">
            {FILE_REPORT_TEMPLATES.map((option) => (
              <button key={option.value} className={template === option.value ? "is-selected" : ""} type="button" onClick={() => setTemplate(option.value)}>
                {option.label}
              </button>
            ))}
          </div>

          <div className="report-export-controls">
            <label><span>Report records</span><select value={source} onChange={(event) => setSource(event.target.value)}>{FILE_REPORT_SOURCES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label><span>Billing status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{FILE_REPORT_STATUSES.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label><span>From date</span><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
            <label><span>To date</span><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
            <button className="secondary-action report-clear-filter" type="button" onClick={() => { setFrom(""); setTo(""); setStatus("All"); }}>Clear filters</button>
          </div>

          <div className="report-export-summary">
            <div><span>Preview format</span><strong>{report.templateTitle}</strong></div>
            <div><span>Report</span><strong>{report.title}</strong></div>
            <div><span>Report total</span><strong>{money.format(reportTotal(report))}</strong></div>
          </div>

          <div className="report-preview-sheet">
            <div className="report-preview-company"><strong>ILLUMINUX GENERAL MERCH CO.</strong><span>Blk. 4, Queenstown 1 Heights, Brgy. San Luis, Antipolo City</span><h2>{report.templateTitle} — {report.title}</h2></div>
            <div className="financial-table-wrapper">
              <table className="financial-record-table report-preview-table">
                <thead><tr>{report.columns.map((item) => <th key={item.key}>{item.label}</th>)}</tr></thead>
                <tbody>
                  {report.rows.length ? report.rows.map((row, rowIndex) => (
                    <tr key={`${source}-${rowIndex}`}>{report.columns.map((item) => <td key={item.key}>{item.type === "money" ? money.format(Number(row[item.key] || 0)) : row[item.key]}</td>)}</tr>
                  )) : <tr><td className="financial-records-empty" colSpan={report.columns.length}>No records match the selected filters.</td></tr>}
                </tbody>
                {report.rows.length > 0 && <tfoot><tr><th colSpan={report.columns.length - 1}>Total</th><th>{money.format(reportTotal(report))}</th></tr></tfoot>}
              </table>
            </div>
          </div>

          <div className="report-export-actions"><button className="primary-action" type="button" disabled={exporting} onClick={downloadPdf}>{exporting ? "Creating PDF…" : "Download PDF"}</button></div>
          {message && <p className="report-export-message" role="status">{message}</p>}
        </section>
      </main>
    </div>
  );
}
