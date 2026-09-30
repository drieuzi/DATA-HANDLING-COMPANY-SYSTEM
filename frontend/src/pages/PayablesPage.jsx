import FinancialRecordsTable from "../components/FinancialRecordsTable.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

const columns = [
  { key: "companyName", label: "Company Name", reportWidth: 1.7 },
  { key: "purchaseOrder", label: "P.O. #", reportWidth: 1.1 },
  { key: "voucherNumber", label: "Voucher #", reportWidth: 1.1, render: (row) => row.voucherNumber || "—" },
  { key: "voucherDate", label: "Voucher Date", reportWidth: 1.1, render: (row) => formatRecordDate(row.voucherDate), reportValue: (row) => formatRecordDate(row.voucherDate) },
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

export default function PayablesPage({ suppliers, user, onBack, embedded = false }) {
  const rows = suppliers.flatMap((supplier) =>
    supplier.transactions.filter((transaction) => !transaction.deletedAt).map((transaction) => ({
      ...transaction,
      companyId: supplier.id,
      companyName: supplier.name
    }))
  );

  return (
    <FinancialRecordsTable
      title="Payables Track Records"
      columns={columns}
      rows={rows}
      onBack={onBack}
      embedded={embedded}
      officeReportTitle="Payables Office Report"
      generatedBy={user?.fullName || user?.username}
    />
  );
}
