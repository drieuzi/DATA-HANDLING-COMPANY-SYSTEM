import FinancialRecordsTable from "../components/FinancialRecordsTable.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

const columns = [
  { key: "companyName", label: "Company Name", reportWidth: 1.7 },
  { key: "purchaseOrder", label: "P.O. #", reportWidth: 1.1 },
  { key: "voucherNumber", label: "Voucher #", reportWidth: 1.1, render: (row) => row.voucherNumber || "—" },
  { key: "voucherDate", label: "Voucher Date", reportWidth: 1.1, render: (row) => formatRecordDate(row.voucherDate), reportValue: (row) => formatRecordDate(row.voucherDate) },
  { key: "salesInvoiceDate", label: "S.I. Date", reportWidth: 1.1, render: (row) => row.salesInvoiceDate && row.salesInvoiceDate !== "—" ? formatRecordDate(row.salesInvoiceDate) : "Not recorded", reportValue: (row) => row.salesInvoiceDate && row.salesInvoiceDate !== "—" ? formatRecordDate(row.salesInvoiceDate) : "Not recorded" },
  { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
  { key: "balance", label: "Balance", render: (row) => formatCurrency(row.balance) },
  {
    key: "billingStatus",
    label: "Billing Status",
    render: (row) => (
      <span
        className={`table-status table-status--${row.billingStatus
          .toLowerCase()
          .replaceAll(" ", "-")}`}
      >
        {row.billingStatus}
      </span>
    )
  }
];

const birColumns = [
  { key: "voucherDate", label: "Date", reportWidth: 1.1, render: (row) => formatRecordDate(row.voucherDate), reportValue: (row) => formatRecordDate(row.voucherDate) },
  { key: "companyName", label: "Supplier / Particulars", reportWidth: 1.8 },
  { key: "businessAddress", label: "Address", reportWidth: 2.3 },
  { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
  { key: "salesInvoice", label: "OR/S.I." },
  { key: "salesInvoiceDate", label: "S.I. Date", reportWidth: 1.1, render: (row) => row.salesInvoiceDate && row.salesInvoiceDate !== "—" ? formatRecordDate(row.salesInvoiceDate) : "Not recorded", reportValue: (row) => row.salesInvoiceDate && row.salesInvoiceDate !== "—" ? formatRecordDate(row.salesInvoiceDate) : "Not recorded" },
  { key: "tinNumber", label: "TIN No." }
];

export default function PayablesPage({ suppliers, user, onBack, embedded = false }) {
  const rows = suppliers.flatMap((supplier) =>
    supplier.transactions.filter((transaction) => !transaction.deletedAt).map((transaction) => ({
      ...transaction,
      companyId: supplier.id,
      companyName: supplier.name,
      businessAddress: supplier.businessAddress || "—"
    }))
  );

  return (
    <FinancialRecordsTable
      title="Payables Track Records"
      columns={columns}
      rows={rows}
      onBack={onBack}
      embedded={embedded}
      searchPlaceholder="Search company, P.O., S.I., or voucher…"
      searchKeys={["companyName", "purchaseOrder", "salesInvoice", "voucherNumber"]}
      dateField="voucherDate"
      officeReportTitle="Payables Office Report"
      birReportTitle="Payables BIR Report"
      birReportColumns={birColumns}
      generatedBy={user?.fullName || user?.username}
    />
  );
}
