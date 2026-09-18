import { useState } from "react";
import FinancialRecordsTable from "../components/FinancialRecordsTable.jsx";
import TransactionEditorDialog from "../components/TransactionEditorDialog.jsx";
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
  { key: "salesInvoice", label: "S.I. #" },
  { key: "collectionReceipt", label: "C.R. #" },
  { key: "date", label: "Date", render: (row) => formatDate(row.date) },
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

export default function ReceivablesPage({ clients, onBack, onSaveTransaction, embedded = false }) {
  const [editingRow, setEditingRow] = useState(null);
  const rows = clients.flatMap((client) =>
    client.transactions.map((transaction) => ({
      ...transaction,
      companyId: client.id,
      companyName: client.name
    }))
  );

  return (
    <>
      <FinancialRecordsTable title="Receivables Track Records" columns={columns} rows={rows} onBack={onBack} onEdit={setEditingRow} embedded={embedded} />
      <TransactionEditorDialog isOpen={Boolean(editingRow)} type="client" companyName={editingRow?.companyName || ""} transaction={editingRow} onSave={(values) => { onSaveTransaction(editingRow.companyId, values); setEditingRow(null); }} onClose={() => setEditingRow(null)} />
    </>
  );
}
