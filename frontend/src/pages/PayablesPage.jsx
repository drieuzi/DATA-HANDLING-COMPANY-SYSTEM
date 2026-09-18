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
  { key: "voucherNumber", label: "Voucher #", render: (row) => row.voucherNumber || "—" },
  { key: "voucherDate", label: "Voucher Date", render: (row) => formatDate(row.voucherDate) },
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

export default function PayablesPage({ suppliers, onBack, onSaveTransaction, embedded = false }) {
  const [editingRow, setEditingRow] = useState(null);
  const rows = suppliers.flatMap((supplier) =>
    supplier.transactions.map((transaction) => ({
      ...transaction,
      companyId: supplier.id,
      companyName: supplier.name
    }))
  );

  return (
    <>
      <FinancialRecordsTable title="Payables Track Records" columns={columns} rows={rows} onBack={onBack} onEdit={setEditingRow} canEdit={(row) => !["Draft", "Issued"].includes(row.voucherStatus)} embedded={embedded} />
      <TransactionEditorDialog isOpen={Boolean(editingRow)} type="supplier" companyName={editingRow?.companyName || ""} transaction={editingRow} onSave={(values) => { onSaveTransaction(editingRow.companyId, values); setEditingRow(null); }} onClose={() => setEditingRow(null)} />
    </>
  );
}
