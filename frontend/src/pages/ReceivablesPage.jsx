import FinancialRecordsTable from "../components/FinancialRecordsTable.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

const columns = [
  { key: "companyName", label: "Company Name" },
  { key: "purchaseOrder", label: "P.O. #" },
  { key: "salesInvoice", label: "S.I. #" },
  { key: "collectionReceipt", label: "C.R. #" },
  { key: "date", label: "Date", render: (row) => formatRecordDate(row.date) },
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

export default function ReceivablesPage({ clients, onBack, embedded = false }) {
  const rows = clients.flatMap((client) =>
    client.transactions.filter((transaction) => !transaction.deletedAt && Number(transaction.balance) > 0).map((transaction) => ({
      ...transaction,
      companyId: client.id,
      companyName: client.name
    }))
  );

  return (
    <FinancialRecordsTable
      title="Receivables Track Records"
      columns={columns}
      rows={rows}
      onBack={onBack}
      embedded={embedded}
    />
  );
}
