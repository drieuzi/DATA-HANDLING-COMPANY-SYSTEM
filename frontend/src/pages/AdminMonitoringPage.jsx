import { useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import RecentAuditTable from "../components/RecentAuditTable.jsx";

const categories = [
  { value: "all", label: "All Activity" },
  { value: "login", label: "Log In" },
  { value: "transactions", label: "Transactions" },
  { value: "clients", label: "Clients" },
  { value: "suppliers", label: "Suppliers" },
  { value: "vouchers", label: "Voucher Cheque" }
];

function matchesCategory(log, category) {
  if (category === "all") return true;
  if (category === "login") return String(log.action).startsWith("AUTH_");
  if (category === "transactions") {
    return ["client_transaction", "supplier_transaction", "client_payment"].includes(log.entityType);
  }
  if (category === "clients") return log.entityType === "client";
  if (category === "suppliers") return log.entityType === "supplier";
  if (category === "vouchers") return log.entityType === "voucher";
  return false;
}

export default function AdminMonitoringPage({
  user, auditLog = [], suppliers, clients, vouchers, onBack, onLogout,
  onRestoreSupplier, onPermanentDeleteSupplier, onRestoreSupplierTransaction,
  onRestoreClient, onPermanentDeleteClient, onRestoreClientTransaction,
  onRestoreVoucher, onPermanentDeleteVoucher
}) {
  const [category, setCategory] = useState("all");
  const filteredLogs = useMemo(
    () => auditLog.filter((log) => matchesCategory(log, category)),
    [auditLog, category]
  );

  function isLatestDeletion(log, action) {
    return auditLog.find((item) => item.action === action
      && item.entityType === log.entityType
      && String(item.entityId) === String(log.entityId))?.id === log.id;
  }

  async function runAction(action) {
    try { await action(); }
    catch (error) { window.alert(error.message); }
  }

  function renderActions(log) {
    if (!log.entityId) return null;

    if (log.entityType === "supplier" && log.action === "SUPPLIER_DELETED" && isLatestDeletion(log, "SUPPLIER_DELETED")) {
      const supplier = suppliers.find((item) => String(item.id) === String(log.entityId));
      if (supplier?.deletedAt && supplier.restoreAllowed !== false) return <>
        <button type="button" onClick={() => runAction(() => onRestoreSupplier(supplier.id))}>Restore</button>
        <button className="danger-action" type="button" onClick={() => {
          if (window.confirm("Are you sure you want to permanently delete this record? This action cannot be undone.")) {
            runAction(() => onPermanentDeleteSupplier(supplier.id));
          }
        }}>Delete</button>
      </>;
    }

    if (log.entityType === "client" && log.action === "CLIENT_DELETED" && isLatestDeletion(log, "CLIENT_DELETED")) {
      const client = clients.find((item) => String(item.id) === String(log.entityId));
      if (client?.deletedAt && client.restoreAllowed !== false) return <>
        <button type="button" onClick={() => runAction(() => onRestoreClient(client.id))}>Restore</button>
        <button className="danger-action" type="button" onClick={() => {
          if (window.confirm("Are you sure you want to permanently delete this record? This action cannot be undone.")) {
            runAction(() => onPermanentDeleteClient(client.id));
          }
        }}>Delete</button>
      </>;
    }

    if (log.entityType === "voucher" && log.action === "VOUCHER_DELETED" && isLatestDeletion(log, "VOUCHER_DELETED")) {
      const voucher = vouchers.find((item) => String(item.id) === String(log.entityId));
      if (voucher?.deletedAt && voucher.restoreAllowed !== false) return <>
        <button type="button" onClick={() => runAction(() => onRestoreVoucher(voucher.id))}>Restore</button>
        <button className="danger-action" type="button" onClick={() => {
          if (window.confirm("Are you sure you want to permanently delete this record? This action cannot be undone.")) {
            runAction(() => onPermanentDeleteVoucher(voucher.id));
          }
        }}>Delete</button>
      </>;
    }

    if (log.entityType === "supplier_transaction" && log.action === "SUPPLIER_TRANSACTION_DELETED"
      && isLatestDeletion(log, "SUPPLIER_TRANSACTION_DELETED")) {
      const transaction = suppliers.flatMap((item) => item.transactions)
        .find((item) => String(item.id) === String(log.entityId));
      if (transaction?.deletedAt && transaction.restoreAllowed !== false) {
        return <button type="button" onClick={() => runAction(() => onRestoreSupplierTransaction(transaction.id))}>Restore</button>;
      }
    }

    if (log.entityType === "client_transaction" && log.action === "CLIENT_TRANSACTION_DELETED"
      && isLatestDeletion(log, "CLIENT_TRANSACTION_DELETED")) {
      const transaction = clients.flatMap((item) => item.transactions)
        .find((item) => String(item.id) === String(log.entityId));
      if (transaction?.deletedAt && transaction.restoreAllowed !== false) {
        return <button type="button" onClick={() => runAction(() => onRestoreClientTransaction(transaction.id))}>Restore</button>;
      }
    }

    return null;
  }

  return (
    <div className="app-page admin-monitoring-page">
      <Header user={user} onLogout={onLogout} />
      <main className="admin-monitoring-main">
        <PageBackButton label="Back to Dashboard" onClick={onBack} />
        <section className="admin-monitoring-toolbar" aria-label="Audit filters">
          <div>
            <p>Administrator access</p>
            <h1>Admin Monitoring</h1>
          </div>
          <label>
            <span>Activity Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </section>
        <RecentAuditTable logs={filteredLogs} renderActions={renderActions} />
      </main>
    </div>
  );
}
