import { useMemo, useState } from "react";
import Header from "../components/Header.jsx";
import PageBackButton from "../components/PageBackButton.jsx";
import RecentAuditTable from "../components/RecentAuditTable.jsx";

const categories = [
  { value: "all", label: "All Activity" },
  { value: "authentication", label: "Authentication" },
  { value: "suppliers", label: "Suppliers" },
  { value: "clients", label: "Clients" },
  { value: "transactions", label: "Transactions" },
  { value: "vouchers", label: "Voucher Cheque" },
  { value: "other_expenses", label: "Other Expenses" },
  { value: "user_accounts", label: "User Accounts" },
  { value: "file_reports", label: "File Reports" }
];

const actionTypes = [
  { value: "all", label: "All Actions" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "restored", label: "Restored" },
  { value: "permanent_delete", label: "Permanently Deleted" },
  { value: "approval", label: "Approval Activity" },
  { value: "login", label: "Logged In" },
  { value: "logout", label: "Logged Out" },
  { value: "exported", label: "Exported" }
];

function matchesCategory(log, category) {
  if (category === "all") return true;
  if (category === "authentication") return String(log.action).startsWith("AUTH_");
  if (category === "transactions") {
    return ["client_transaction", "supplier_transaction", "client_payment", "payment"].includes(log.entityType);
  }
  if (category === "clients") return log.entityType === "client";
  if (category === "suppliers") return log.entityType === "supplier";
  if (category === "vouchers") return log.entityType === "voucher";
  if (category === "other_expenses") return log.entityType === "outside_service";
  if (category === "user_accounts") {
    return log.entityType === "user" && !String(log.action).startsWith("AUTH_");
  }
  if (category === "file_reports") return log.entityType === "report";
  return false;
}

function matchesActionType(log, actionType) {
  if (actionType === "all") return true;
  const action = String(log.action || "").toUpperCase();
  if (actionType === "created") return action.endsWith("_CREATED");
  if (actionType === "updated") return action.endsWith("_UPDATED") || action.endsWith("_REPLACED");
  if (actionType === "deleted") return action.endsWith("_DELETED") || action.endsWith("_DEACTIVATED");
  if (actionType === "restored") return action.endsWith("_RESTORED");
  if (actionType === "permanent_delete") {
    return action === "PERMANENT_PURGE" || action.endsWith("_PERMANENTLY_DELETED");
  }
  if (actionType === "approval") {
    return action.endsWith("_REQUESTED") || action.endsWith("_APPROVED") || action.endsWith("_REJECTED");
  }
  if (actionType === "login") return action === "AUTH_LOGIN";
  if (actionType === "logout") return action === "AUTH_LOGOUT";
  if (actionType === "exported") return action.endsWith("_EXPORTED");
  return false;
}

export default function AdminMonitoringPage({
  user, auditLog = [], suppliers, clients, vouchers, outsideServices = [], onBack, onLogout,
  onRestoreSupplier, onPermanentDeleteSupplier,
  onRestoreSupplierTransaction, onPermanentDeleteSupplierTransaction,
  onRestoreClient, onPermanentDeleteClient,
  onRestoreClientTransaction, onPermanentDeleteClientTransaction,
  onRestoreVoucher, onPermanentDeleteVoucher,
  onRestoreOutsideService, onPermanentDeleteOutsideService
}) {
  const [category, setCategory] = useState("all");
  const [actionType, setActionType] = useState("all");
  const [query, setQuery] = useState("");
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [purgeReason, setPurgeReason] = useState("");
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const [purgeError, setPurgeError] = useState("");
  const [purging, setPurging] = useState(false);
  const filteredLogs = useMemo(
    () => {
      const normalizedQuery = query.trim().toLowerCase();
      return auditLog
        .filter((log) => matchesCategory(log, category))
        .filter((log) => matchesActionType(log, actionType))
        .filter((log) => {
          if (!normalizedQuery) return true;
          const displayedDate = log.createdAt
            ? new Date(log.createdAt).toLocaleString("en-PH")
            : "";
          const searchable = [
            log.actorFullName,
            log.actorUsername,
            displayedDate,
            log.createdAt
          ].filter(Boolean).join(" ").toLowerCase();
          return searchable.includes(normalizedQuery);
        });
    },
    [auditLog, category, actionType, query]
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

  function openPurgeDialog(type, record, label) {
    setPurgeTarget({ type, id: record.id, name: label || record.name });
    setPurgeReason("");
    setPurgeConfirmation("");
    setPurgeError("");
  }

  function closePurgeDialog() {
    if (purging) return;
    setPurgeTarget(null);
    setPurgeError("");
  }

  async function confirmPurge(event) {
    event.preventDefault();
    if (!purgeTarget || purgeConfirmation !== "DELETE" || !purgeReason.trim()) return;
    setPurging(true);
    setPurgeError("");
    try {
      const actions = {
        supplier: onPermanentDeleteSupplier,
        client: onPermanentDeleteClient,
        supplier_transaction: onPermanentDeleteSupplierTransaction,
        client_transaction: onPermanentDeleteClientTransaction,
        voucher: onPermanentDeleteVoucher,
        outside_service: onPermanentDeleteOutsideService
      };
      const action = actions[purgeTarget.type];
      if (!action) throw new Error("Permanent deletion is not available for this record.");
      await action(purgeTarget.id, {
        confirmation: purgeConfirmation,
        reason: purgeReason.trim()
      });
      setPurgeTarget(null);
    } catch (error) {
      setPurgeError(error.message);
    } finally {
      setPurging(false);
    }
  }

  function renderActions(log) {
    if (!log.entityId) return null;

    if (log.entityType === "supplier" && log.action === "SUPPLIER_DELETED" && isLatestDeletion(log, "SUPPLIER_DELETED")) {
      const supplier = suppliers.find((item) => String(item.id) === String(log.entityId));
      if (supplier?.deletedAt && supplier.restoreAllowed !== false) return <>
        <button type="button" onClick={() => runAction(() => onRestoreSupplier(supplier.id))}>Restore</button>
        <button className="danger-action" type="button" onClick={() => openPurgeDialog("supplier", supplier, supplier.name)}>Delete</button>
      </>;
    }

    if (log.entityType === "client" && log.action === "CLIENT_DELETED" && isLatestDeletion(log, "CLIENT_DELETED")) {
      const client = clients.find((item) => String(item.id) === String(log.entityId));
      if (client?.deletedAt && client.restoreAllowed !== false) return <>
        <button type="button" onClick={() => runAction(() => onRestoreClient(client.id))}>Restore</button>
        <button className="danger-action" type="button" onClick={() => openPurgeDialog("client", client, client.name)}>Delete</button>
      </>;
    }

    if (log.entityType === "voucher" && log.action === "VOUCHER_DELETED" && isLatestDeletion(log, "VOUCHER_DELETED")) {
      const voucher = vouchers.find((item) => String(item.id) === String(log.entityId));
      if (voucher?.deletedAt && voucher.restoreAllowed !== false) return <>
        <button type="button" onClick={() => runAction(() => onRestoreVoucher(voucher.id))}>Restore</button>
        <button className="danger-action" type="button" onClick={() => openPurgeDialog(
          "voucher", voucher, `Voucher ${voucher.voucherNumber}`
        )}>Delete</button>
      </>;
    }

    if (log.entityType === "supplier_transaction" && log.action === "SUPPLIER_TRANSACTION_DELETED"
      && isLatestDeletion(log, "SUPPLIER_TRANSACTION_DELETED")) {
      const transaction = suppliers.flatMap((item) => item.transactions)
        .find((item) => String(item.id) === String(log.entityId));
      if (transaction?.deletedAt && transaction.restoreAllowed !== false) {
        return <>
          <button type="button" onClick={() => runAction(() => onRestoreSupplierTransaction(transaction.id))}>Restore</button>
          <button className="danger-action" type="button" onClick={() => openPurgeDialog(
            "supplier_transaction", transaction, `Supplier transaction #${transaction.id}`
          )}>Delete</button>
        </>;
      }
    }

    if (log.entityType === "client_transaction" && log.action === "CLIENT_TRANSACTION_DELETED"
      && isLatestDeletion(log, "CLIENT_TRANSACTION_DELETED")) {
      const transaction = clients.flatMap((item) => item.transactions)
        .find((item) => String(item.id) === String(log.entityId));
      if (transaction?.deletedAt && transaction.restoreAllowed !== false) {
        return <>
          <button type="button" onClick={() => runAction(() => onRestoreClientTransaction(transaction.id))}>Restore</button>
          <button className="danger-action" type="button" onClick={() => openPurgeDialog(
            "client_transaction", transaction, `Client transaction #${transaction.id}`
          )}>Delete</button>
        </>;
      }
    }

    if (log.entityType === "outside_service" && log.action === "OUTSIDE_SERVICE_DELETED"
      && isLatestDeletion(log, "OUTSIDE_SERVICE_DELETED")) {
      const service = outsideServices.find((item) => String(item.id) === String(log.entityId));
      if (service?.deletedAt && service.restoreAllowed !== false) {
        return <>
          <button type="button" onClick={() => runAction(() => onRestoreOutsideService(service.id))}>Restore</button>
          <button className="danger-action" type="button" onClick={() => openPurgeDialog(
            "outside_service", service, `Other Expense: ${service.item}`
          )}>Delete</button>
        </>;
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
          <div className="admin-monitoring-filters">
            <label>
              <span>Search Activity</span>
              <input
                type="search"
                value={query}
                placeholder="Search employee name or activity date"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              <span>Activity Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span>Action Type</span>
              <select value={actionType} onChange={(event) => setActionType(event.target.value)}>
                {actionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>
        </section>
        <RecentAuditTable logs={filteredLogs} renderActions={renderActions} />
      </main>
      {purgeTarget && (
        <div className="permanent-purge-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePurgeDialog();
        }}>
          <section className="permanent-purge-dialog" role="dialog" aria-modal="true" aria-labelledby="permanentPurgeTitle">
            <p className="permanent-purge-eyebrow">Irreversible Admin action</p>
            <h2 id="permanentPurgeTitle">Permanently delete {purgeTarget.name}?</h2>
            <p>
              This permanently removes the deleted record
              {purgeTarget.type === "supplier" ? ", all linked transactions, vouchers, payments, and voucher attachment records" : ""}
              {purgeTarget.type === "client" ? ", all linked transactions and payments" : ""}
              {purgeTarget.type === "supplier_transaction" ? ", all linked vouchers, payments, and voucher attachment records" : ""}
              {purgeTarget.type === "client_transaction" ? " and all linked payments" : ""}
              {purgeTarget.type === "voucher" ? " and its reversed payment record" : ""}.
              {purgeTarget.type === "outside_service" ? " Its stored attachment will also be removed." : ""}
              Only one minimal audit entry will remain.
            </p>
            <form onSubmit={confirmPurge}>
              <label>
                <span>Reason for permanent deletion</span>
                <textarea
                  autoFocus
                  maxLength="500"
                  required
                  value={purgeReason}
                  onChange={(event) => setPurgeReason(event.target.value)}
                  placeholder="Explain why this record must be permanently removed"
                />
              </label>
              <label>
                <span>Type DELETE to confirm</span>
                <input
                  type="text"
                  autoComplete="off"
                  value={purgeConfirmation}
                  onChange={(event) => setPurgeConfirmation(event.target.value)}
                  placeholder="DELETE"
                />
              </label>
              {purgeError && <p className="permanent-purge-error" role="alert">{purgeError}</p>}
              <div className="permanent-purge-actions">
                <button type="button" onClick={closePurgeDialog} disabled={purging}>Cancel</button>
                <button
                  className="danger-action"
                  type="submit"
                  disabled={purging || purgeConfirmation !== "DELETE" || !purgeReason.trim()}
                >
                  {purging ? "Deleting…" : "Permanently Delete"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
