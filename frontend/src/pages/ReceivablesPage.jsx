import { useState } from "react";
import FinancialRecordsTable from "../components/FinancialRecordsTable.jsx";
import ClientDepositDialog from "../components/ClientDepositDialog.jsx";
import { formatCurrency } from "../utils/dashboardCalculations.js";
import { formatRecordDate } from "../utils/recordHelpers.js";

const columns = [
  { key: "companyName", label: "Company Name", reportWidth: 1.7 },
  { key: "salesInvoice", label: "S.I. #", reportWidth: 1.1 },
  { key: "collectionReceipt", label: "C.R. #", reportWidth: 1.1 },
  { key: "date", label: "Date", reportWidth: 1.1, render: (row) => formatRecordDate(row.date), reportValue: (row) => formatRecordDate(row.date) },
  { key: "collectionDate", label: "Collection Date", reportWidth: 1.1, render: (row) => formatRecordDate(row.collectionDate), reportValue: (row) => formatRecordDate(row.collectionDate) },
  { key: "chequeDate", label: "Cheque Date", reportWidth: 1.1, render: (row) => formatRecordDate(row.chequeDate), reportValue: (row) => formatRecordDate(row.chequeDate) },
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
  },
  {
    key: "depositStatus",
    label: "Deposit Status",
    render: (row) => (
      <span className={`deposit-status${row.depositDue ? " deposit-status--due" : ""}`}>
        {row.depositDue ? "Due for Confirmation" : row.depositStatus}
      </span>
    )
  }
];

export default function ReceivablesPage({
  clients, user, onBack, onConfirmDeposit, onRescheduleCheque, embedded = false
}) {
  const [depositTransaction, setDepositTransaction] = useState(null);
  const rows = clients.flatMap((client) =>
    client.transactions.filter((transaction) => !transaction.deletedAt).map((transaction) => ({
      ...transaction,
      companyId: client.id,
      companyName: client.name
    }))
  );
  const dueCheques = rows.filter((row) => row.depositDue);

  return (
    <>
      {dueCheques.length > 0 && <section className="deposit-notification" role="alert">
        <strong>{dueCheques.length} cheque deposit{dueCheques.length === 1 ? " is" : "s are"} due for confirmation.</strong>
        <span>Confirm successful deposits or manually adjust their cheque dates.</span>
      </section>}
      <FinancialRecordsTable
        title="Receivables Track Records"
        columns={columns}
        rows={rows}
        onBack={onBack}
        embedded={embedded}
        searchPlaceholder="Search company, S.I., or C.R.…"
        searchKeys={["companyName", "salesInvoice", "collectionReceipt"]}
        dateField="date"
        renderActions={(row) => row.depositStatus === "Pending Deposit" ? <>
          <button type="button" title={row.depositDue ? "Confirm deposit or adjust its date" : "Adjust the scheduled cheque date"} onClick={() => setDepositTransaction(row)}>{row.depositDue ? "Review Deposit" : "Adjust Date"}</button>
        </> : null}
        officeReportTitle="Receivables Office Report"
        generatedBy={user?.fullName || user?.username}
      />
      <ClientDepositDialog
        transaction={depositTransaction}
        clientName={depositTransaction?.companyName}
        onConfirm={onConfirmDeposit}
        onReschedule={onRescheduleCheque}
        onClose={() => setDepositTransaction(null)}
      />
    </>
  );
}
