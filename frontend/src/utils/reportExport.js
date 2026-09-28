const PHP_NUMBER = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const FILE_REPORT_SOURCES = [
  { value: "sales", label: "Client Sales" },
  { value: "purchases", label: "Supplier Purchases" },
  { value: "other_expenses", label: "Other Expenses" }
];
export const FILE_REPORT_TEMPLATES = [
  { value: "bir", label: "BIR Report" },
  { value: "office", label: "Office Report" }
];
export const FILE_REPORT_STATUSES = ["All", "Paid", "Not Paid"];

function normalizeDate(value) {
  if (!value || value === "—") return "";
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function displayDate(value) {
  const normalized = normalizeDate(value);
  if (!normalized) return "-";
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" })
    .format(new Date(`${normalized}T00:00:00`));
}

function withinRange(value, from, to) {
  const date = normalizeDate(value);
  if (!date) return !from && !to;
  return (!from || date >= from) && (!to || date <= to);
}

function statusMatches(transaction, status) {
  if (status === "All") return true;
  const paid = transaction.billingStatus === "Paid" || Number(transaction.balance) === 0;
  return status === "Paid" ? paid : !paid;
}

function column(label, key, width, type = "text") {
  return { label, key, width, type };
}

export function createFileReport({ source, template, status, from, to, clients, suppliers, outsideServices = [] }) {
  if (source === "other_expenses") {
    const columns = [
      column("Date", "date", 14),
      column("Particulars", "particulars", 32),
      column("Amount", "amount", 18, "money"),
      column("OR/S.I.", "salesInvoice", 18),
      column("TIN No.", "tinNumber", 18)
    ];
    if (template === "office") columns.push(column("Attachment", "attachment", 22));
    return {
      title: "Other Expenses Report",
      templateTitle: template === "office" ? "Office Report" : "BIR Report",
      columns,
      rows: outsideServices
        .filter((expense) => withinRange(expense.date, from, to))
        .map((expense) => ({
          date: displayDate(expense.date),
          particulars: [expense.payee, expense.item].filter(Boolean).join(" — ") || "-",
          amount: Number(expense.amount || 0),
          salesInvoice: expense.receiptInvoiceNumber || "-",
          tinNumber: expense.tinNumber || "-",
          attachment: expense.attachmentName || "-"
        })),
      totalKey: "amount"
    };
  }

  const companies = source === "sales" ? clients : suppliers;
  const rows = companies.filter((company) => !company.deletedAt).flatMap((company) =>
    (company.transactions || [])
      .filter((transaction) => !transaction.deletedAt && statusMatches(transaction, status))
      .map((transaction) => ({ transaction, date: source === "sales" ? transaction.date : transaction.paymentDate }))
      .filter(({ date }) => withinRange(date, from, to))
      .map(({ transaction, date }) => ({
        date: displayDate(date),
        particulars: company.name || "-",
        address: company.businessAddress || "-",
        amount: Number(transaction.amount || 0),
        salesInvoice: transaction.salesInvoice || "-",
        tinNumber: transaction.tinNumber || "-",
        billingStatus: transaction.billingStatus || (Number(transaction.balance) === 0 ? "Paid" : "Not Paid"),
        purchaseOrder: transaction.purchaseOrder || "-"
      }))
  );
  const columns = [
    column("Date", "date", 14), column("Particulars", "particulars", 24),
    column("Address", "address", 30), column("Amount", "amount", 16, "money"),
    column("OR/S.I.", "salesInvoice", 16), column("TIN No.", "tinNumber", 18)
  ];
  if (template === "office") {
    columns.push(column("Billing Status", "billingStatus", 16), column("P.O. Number", "purchaseOrder", 18));
  }
  return {
    title: source === "sales" ? "Sales Report" : "Purchases Report",
    templateTitle: template === "office" ? "Office Report" : "BIR Report",
    columns, rows, totalKey: "amount"
  };
}

export function reportTotal(report) {
  return report.rows.reduce((total, row) => total + Number(row.amount || 0), 0);
}

function reportFilename(source, template, from, to) {
  const range = from || to ? `${from || "start"}-to-${to || "present"}` : "all-dates";
  return `illuminux-${template}-${source}-${range}.pdf`;
}

function pdfText(value, type) {
  if (type === "money") return `PHP ${PHP_NUMBER.format(Number(value || 0))}`;
  return String(value ?? "-").replaceAll("—", "-");
}

export async function exportFileReportToPdf(report, { from, to, generatedBy, source, template, status }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const tableWidth = pageWidth - margin * 2;
  const totalWeight = report.columns.reduce((sum, item) => sum + item.width, 0);
  const widths = report.columns.map((item) => tableWidth * item.width / totalWeight);
  const headerHeight = 10;

  function heading() {
    doc.setTextColor(8, 8, 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("ILLUMINUX GENERAL MERCH CO.", pageWidth / 2, 12, { align: "center" });
    doc.setFontSize(8);
    doc.text("Blk. 4, Queenstown 1 Heights, Brgy. San Luis, Antipolo City", pageWidth / 2, 17, { align: "center" });
    doc.setFontSize(11);
    doc.text(`${report.templateTitle} — ${report.title}`, pageWidth / 2, 23, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const range = from || to ? `${from || "Beginning"} to ${to || "Present"}` : "All dates";
    doc.text(`Date range: ${range} | Status: ${status}`, margin, 29);
    doc.text(`Generated by: ${generatedBy || "Administrator"}`, pageWidth - margin, 29, { align: "right" });
  }

  function tableHeader(y) {
    let x = margin;
    doc.setTextColor(8, 8, 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    report.columns.forEach((item, index) => {
      doc.setFillColor(255, 222, 164);
      doc.setDrawColor(8, 8, 8);
      doc.rect(x, y, widths[index], headerHeight, "FD");
      doc.text(doc.splitTextToSize(item.label, widths[index] - 3), x + widths[index] / 2, y + 4, { align: "center" });
      x += widths[index];
    });
    return y + headerHeight;
  }

  heading();
  let y = tableHeader(33);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  report.rows.forEach((row) => {
    const lines = report.columns.map((item, index) => doc.splitTextToSize(pdfText(row[item.key], item.type), widths[index] - 3));
    const rowHeight = Math.max(8, Math.max(...lines.map((line) => line.length)) * 3.4 + 2);
    if (y + rowHeight > pageHeight - 16) {
      doc.addPage();
      heading();
      y = tableHeader(33);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.6);
    }
    let x = margin;
    report.columns.forEach((item, index) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(8, 8, 8);
      doc.rect(x, y, widths[index], rowHeight, "FD");
      doc.text(lines[index], item.type === "money" ? x + widths[index] - 1.5 : x + 1.5, y + 4, {
        align: item.type === "money" ? "right" : "left"
      });
      x += widths[index];
    });
    y += rowHeight;
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`Total: PHP ${PHP_NUMBER.format(reportTotal(report))}`, pageWidth - margin, Math.min(y + 7, pageHeight - 7), { align: "right" });
  doc.save(reportFilename(source, template, from, to));
}
