import FinancialRecordsTable from "../components/FinancialRecordsTable.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

const columns = [
  { key: "companyName", label: "Company Name" },
  { key: "purchaseOrder", label: "P.O. #" },
  { key: "voucherNumber", label: "Voucher #", render: (row) => row.voucherNumber || "—" },
  { key: "voucherDate", label: "Voucher Date", render: (row) => formatRecordDate(row.voucherDate) },
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

export default function PayablesPage({ suppliers, onBack, embedded = false }) {
  const rows = suppliers.flatMap((supplier) =>
    supplier.transactions.filter((transaction) => !transaction.deletedAt && Number(transaction.balance) > 0).map((transaction) => ({
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
    />
  );
}
