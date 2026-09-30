import FinancialRecordsTable from "../components/FinancialRecordsTable.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

const columns = [
  { key: "companyName", label: "Company Name", reportWidth: 1.7 },
  { key: "salesInvoice", label: "S.I. #", reportWidth: 1.1 },
  { key: "collectionReceipt", label: "C.R. #", reportWidth: 1.1 },
  { key: "date", label: "Date", reportWidth: 1.1, render: (row) => formatRecordDate(row.date), reportValue: (row) => formatRecordDate(row.date) },
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

export default function ReceivablesPage({ clients, user, onBack, embedded = false }) {
  const rows = clients.flatMap((client) =>
    client.transactions.filter((transaction) => !transaction.deletedAt).map((transaction) => ({
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
      searchPlaceholder="Search company, S.I., C.R., or date…"
      officeReportTitle="Receivables Office Report"
      generatedBy={user?.fullName || user?.username}
    />
  );
}
