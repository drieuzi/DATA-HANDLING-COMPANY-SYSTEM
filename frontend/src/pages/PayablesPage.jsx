import FinancialRecordsTable from "../components/FinancialRecordsTable.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";

function formatDate(value) {
  if (!value || value === "—") return "—";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(`${value}T00:00:00`));
}

const columns = [
  { key: "companyName", label: "Company Name" },
  { key: "purchaseOrder", label: "P.O. #" },
  { key: "voucherDate", label: "Voucher Date", render: (row) => formatDate(row.voucherDate) },
  { key: "paymentDate", label: "Payment Date", render: (row) => formatDate(row.paymentDate) },
  { key: "chequeDate", label: "Cheque Date", render: (row) => formatDate(row.chequeDate) },
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

export default function PayablesPage({ suppliers, onBack }) {
  const rows = suppliers.flatMap((supplier) =>
    supplier.transactions.map((transaction) => ({
      ...transaction,
      companyName: supplier.name
    }))
  );

  return (
    <FinancialRecordsTable
      title="Payables Track Records"
      columns={columns}
      rows={rows}
      onBack={onBack}
    />
  );
}
