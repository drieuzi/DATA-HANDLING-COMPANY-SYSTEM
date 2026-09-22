import { useEffect, useMemo, useState } from "react";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SuppliersPage from "./pages/SuppliersPage.jsx";
import SupplierDetailsPage from "./pages/SupplierDetailsPage.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import ClientDetailsPage from "./pages/ClientDetailsPage.jsx";
import VouchersPage from "./pages/VouchersPage.jsx";
import TotalSalesPage from "./pages/TotalSalesPage.jsx";
import AdminUsersPage from "./pages/AdminUsersPage.jsx";
import { getCurrentUser, logout, USE_DEMO_DATA } from "./services/authApi.js";
import {
  createSupplier, createSupplierTransaction, deleteSupplier, deleteSupplierTransaction,
  listSuppliers, restoreSupplier, restoreSupplierTransaction, updateSupplier,
  updateSupplierTransaction
} from "./services/supplierApi.js";
import {
  cancelVoucher as cancelVoucherRequest, createVoucher as createVoucherRequest,
  deleteVoucher as deleteVoucherRequest, issueVoucher as issueVoucherRequest,
  listVouchers, restoreVoucher as restoreVoucherRequest,
  updateVoucher as updateVoucherRequest
} from "./services/voucherApi.js";
import { listAuditLogs } from "./services/auditApi.js";
import {
  createClient, createClientTransaction, deleteClient, deleteClientTransaction,
  listClients, recordClientPayment, restoreClient, restoreClientTransaction,
  updateClient, updateClientTransaction
} from "./services/clientApi.js";
import { demoSuppliers } from "./data/demoSuppliers.js";
import { demoClients } from "./data/demoClients.js";
import { calculateBillingStatus, calculateCompanyStatus, createRecordId } from "./utils/recordHelpers.js";

const SESSION_KEY = "illuminux-demo-session";
const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [appMessage, setAppMessage] = useState("");
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [supplierSectionTab, setSupplierSectionTab] = useState("payables");
  const [clientSectionTab, setClientSectionTab] = useState("receivables");
  const [suppliers, setSuppliers] = useState(USE_DEMO_DATA ? demoSuppliers : []);
  const [clients, setClients] = useState(USE_DEMO_DATA ? demoClients : []);
  const [vouchers, setVouchers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((account) => { if (active) setUser(account); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || USE_DEMO_DATA) return undefined;
    let active = true;
    setDataLoading(true);
    refreshBackendData(user)
      .catch((error) => { if (active) setAppMessage(error.message); })
      .finally(() => { if (active) setDataLoading(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!appMessage) return undefined;
    const timer = window.setTimeout(() => setAppMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [appMessage]);

  async function refreshBackendData(account = user) {
    if (!account || USE_DEMO_DATA) return;
    const isAdmin = account.role === "admin";
    const [supplierRecords, clientRecords, voucherRecords, activityRecords] = await Promise.all([
      listSuppliers(isAdmin), listClients(isAdmin), listVouchers(isAdmin),
      isAdmin ? listAuditLogs(100) : Promise.resolve([])
    ]);
    setSuppliers(supplierRecords);
    setClients(clientRecords);
    setVouchers(voucherRecords);
    setAuditLog(activityRecords);
  }

  const selectedSupplier = suppliers.find((item) => item.id === selectedSupplierId);
  const selectedClient = clients.find((item) => item.id === selectedClientId);
  const recordSummary = useMemo(() => {
    const purchases = suppliers.filter((item) => !item.deletedAt)
      .flatMap((item) => item.transactions.filter((transaction) => !transaction.deletedAt));
    const sales = clients.filter((item) => !item.deletedAt)
      .flatMap((item) => item.transactions.filter((transaction) => !transaction.deletedAt));
    return {
      payables: purchases.reduce((sum, item) => sum + Number(item.balance || 0), 0),
      receivables: sales.reduce((sum, item) => sum + Number(item.balance || 0), 0),
      totalPurchases: purchases
        .filter((item) => item.billingStatus === "Paid" || Number(item.balance) === 0)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
      totalSales: sales.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    };
  }, [suppliers, clients]);

  function addLocalAudit(action, details) {
    setAuditLog((current) => [{ id: createRecordId("activity"), action, details, createdAt: new Date().toISOString() }, ...current].slice(0, 100));
  }

  function handleLogin(authenticatedUser) {
    if (USE_DEMO_DATA) sessionStorage.setItem(SESSION_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
  }

  async function handleLogout() {
    try { await logout(); }
    finally { sessionStorage.removeItem(SESSION_KEY); setUser(null); setCurrentPage("dashboard"); }
  }

  function saveSupplierTransactionLocally(supplierId, values) {
    let companyName = "Supplier";
    setSuppliers((current) => current.map((supplier) => {
      if (supplier.id !== supplierId) return supplier;
      companyName = supplier.name;
      const existing = supplier.transactions.find((item) => item.id === values.id);
      const paidAmount = existing ? Math.max(Number(existing.amount) - Number(existing.balance), 0) : 0;
      const balance = existing ? Math.max(Number(values.amount) - paidAmount, 0) : Number(values.amount);
      const transaction = {
        ...existing, ...values, id: existing?.id || createRecordId(supplier.id),
        amount: Number(values.amount), balance, voucherDate: existing?.voucherDate || "—",
        paymentDate: existing?.paymentDate || "—", chequeDate: existing?.chequeDate || "—",
        billingStatus: calculateBillingStatus(values.amount, balance)
      };
      const transactions = existing
        ? supplier.transactions.map((item) => item.id === existing.id ? transaction : item)
        : [...supplier.transactions, transaction];
      return { ...supplier, transactions, billingStatus: calculateCompanyStatus(transactions) };
    }));
    addLocalAudit(values.id ? "Supplier transaction updated" : "Supplier transaction added", companyName);
  }

  async function saveSupplierTransaction(supplierId, values) {
    if (USE_DEMO_DATA) return saveSupplierTransactionLocally(supplierId, values);
    if (values.id) await updateSupplierTransaction(values.id, values);
    else await createSupplierTransaction(supplierId, values);
    await refreshBackendData();
    setAppMessage(values.id ? "Supplier transaction updated." : "Supplier transaction created and added to Payables.");
  }

  async function saveSupplier(supplierId, values) {
    if (USE_DEMO_DATA) {
      if (supplierId) setSuppliers((current) => current.map((item) => item.id === supplierId ? { ...item, ...values } : item));
      else setSuppliers((current) => [...current, { ...values, id: createRecordId("supplier"), transactions: [], billingStatus: "Not Paid" }]);
    } else {
      if (supplierId) await updateSupplier(supplierId, values);
      else await createSupplier(values);
      await refreshBackendData();
    }
    setAppMessage(supplierId ? "Supplier updated." : "Supplier created.");
  }

  async function removeSupplier(supplierId, reason) {
    if (USE_DEMO_DATA) setSuppliers((current) => current.map((item) => item.id === supplierId ? { ...item, deletedAt: new Date().toISOString(), deletionReason: reason } : item));
    else { await deleteSupplier(supplierId, reason); await refreshBackendData(); }
    setAppMessage("Supplier moved to deleted records.");
  }

  async function recoverSupplier(supplierId) {
    if (USE_DEMO_DATA) setSuppliers((current) => current.map((item) => item.id === supplierId ? { ...item, deletedAt: null, deletionReason: null } : item));
    else { await restoreSupplier(supplierId); await refreshBackendData(); }
    setAppMessage("Supplier restored.");
  }

  async function removeSupplierTransaction(transactionId, reason) {
    if (USE_DEMO_DATA) setSuppliers((current) => current.map((supplier) => ({ ...supplier, transactions: supplier.transactions.map((item) => item.id === transactionId ? { ...item, deletedAt: new Date().toISOString(), deletionReason: reason } : item) })));
    else { await deleteSupplierTransaction(transactionId, reason); await refreshBackendData(); }
    setAppMessage("Transaction moved to deleted records.");
  }

  async function recoverSupplierTransaction(transactionId) {
    if (USE_DEMO_DATA) setSuppliers((current) => current.map((supplier) => ({ ...supplier, transactions: supplier.transactions.map((item) => item.id === transactionId ? { ...item, deletedAt: null, deletionReason: null } : item) })));
    else { await restoreSupplierTransaction(transactionId); await refreshBackendData(); }
    setAppMessage("Transaction restored.");
  }

  function saveClientTransactionLocally(clientId, values) {
    let companyName = "Client";
    setClients((current) => current.map((client) => {
      if (client.id !== clientId) return client;
      companyName = client.name;
      const existing = client.transactions.find((item) => item.id === values.id);
      const transaction = { ...existing, ...values, id: existing?.id || createRecordId(client.id), amount: Number(values.amount), balance: Number(values.balance), billingStatus: calculateBillingStatus(values.amount, values.balance) };
      const transactions = existing ? client.transactions.map((item) => item.id === existing.id ? transaction : item) : [...client.transactions, transaction];
      return { ...client, transactions, paymentDate: transactions.every((item) => item.billingStatus === "Paid") ? today() : "—", billingStatus: calculateCompanyStatus(transactions) };
    }));
    addLocalAudit(values.id ? "Client transaction updated" : "Client transaction added", companyName);
  }

  async function saveClientTransaction(clientId, values) {
    if (USE_DEMO_DATA) return saveClientTransactionLocally(clientId, values);
    if (values.id) await updateClientTransaction(values.id, values);
    else await createClientTransaction(clientId, values);
    await refreshBackendData();
    setAppMessage(values.id ? "Client transaction updated." : "Client transaction created and added to Receivables.");
  }

  async function saveClient(clientId, values) {
    if (USE_DEMO_DATA) {
      if (clientId) setClients((current) => current.map((item) => item.id === clientId ? { ...item, ...values } : item));
      else setClients((current) => [...current, { ...values, id: createRecordId("client"), transactions: [], billingStatus: "Not Paid", paymentDate: "—" }]);
    } else {
      if (clientId) await updateClient(clientId, values);
      else await createClient(values);
      await refreshBackendData();
    }
    setAppMessage(clientId ? "Client updated." : "Client created.");
  }

  async function removeClient(clientId, reason) {
    if (USE_DEMO_DATA) setClients((current) => current.map((item) => item.id === clientId ? { ...item, deletedAt: new Date().toISOString(), deletionReason: reason } : item));
    else { await deleteClient(clientId, reason); await refreshBackendData(); }
    setAppMessage("Client moved to deleted records.");
  }

  async function recoverClient(clientId) {
    if (USE_DEMO_DATA) setClients((current) => current.map((item) => item.id === clientId ? { ...item, deletedAt: null, deletionReason: null } : item));
    else { await restoreClient(clientId); await refreshBackendData(); }
    setAppMessage("Client restored.");
  }

  async function removeClientTransaction(transactionId, reason) {
    if (USE_DEMO_DATA) setClients((current) => current.map((client) => ({ ...client, transactions: client.transactions.map((item) => item.id === transactionId ? { ...item, deletedAt: new Date().toISOString(), deletionReason: reason } : item) })));
    else { await deleteClientTransaction(transactionId, reason); await refreshBackendData(); }
    setAppMessage("Client transaction moved to deleted records.");
  }

  async function recoverClientTransaction(transactionId) {
    if (USE_DEMO_DATA) setClients((current) => current.map((client) => ({ ...client, transactions: client.transactions.map((item) => item.id === transactionId ? { ...item, deletedAt: null, deletionReason: null } : item) })));
    else { await restoreClientTransaction(transactionId); await refreshBackendData(); }
    setAppMessage("Client transaction restored.");
  }

  async function receiveClientPayment(transactionId, values) {
    if (USE_DEMO_DATA) {
      setClients((current) => current.map((client) => {
        const transactions = client.transactions.map((transaction) => {
          if (transaction.id !== transactionId) return transaction;
          const balance = Math.max(Number(transaction.balance) - Number(values.amount), 0);
          return { ...transaction, ...values, balance, billingStatus: calculateBillingStatus(transaction.amount, balance) };
        });
        return { ...client, transactions, billingStatus: calculateCompanyStatus(transactions) };
      }));
    } else { await recordClientPayment(transactionId, values); await refreshBackendData(); }
    setAppMessage("Client payment recorded and Receivables updated.");
  }

  async function createVoucher(values) {
    if (USE_DEMO_DATA) {
      setVouchers((current) => {
        const highestNumber = current.reduce((highest, voucher) => {
          const number = Number.parseInt(String(voucher.voucherNumber || "").replace(/\D/g, ""), 10);
          return Number.isFinite(number) ? Math.max(highest, number) : highest;
        }, 140);
        const voucherNumber = String(highestNumber + 1).padStart(6, "0");
        return [...current, { ...values, voucherNumber, id: createRecordId("voucher"), amountApplied: Number(values.amountApplied), createdAt: new Date().toISOString() }];
      });
    }
    else { await createVoucherRequest(values); await refreshBackendData(); }
    setAppMessage(values.status === "Issued" ? "Voucher issued and payment applied." : "Voucher draft created.");
  }

  async function issueVoucher(voucherId) {
    if (USE_DEMO_DATA) setVouchers((current) => current.map((item) => item.id === voucherId ? { ...item, status: "Issued" } : item));
    else { await issueVoucherRequest(voucherId); await refreshBackendData(); }
    setAppMessage("Voucher issued and payment applied.");
  }

  async function editVoucher(voucherId, values) {
    if (USE_DEMO_DATA) {
      setVouchers((current) => current.map((item) => item.id === voucherId ? { ...item, ...values } : item));
    } else {
      await updateVoucherRequest(voucherId, values);
      await refreshBackendData();
    }
    setAppMessage("Voucher details updated and linked records recalculated.");
  }

  async function cancelVoucher(voucherId, reason) {
    if (USE_DEMO_DATA) setVouchers((current) => current.map((item) => item.id === voucherId ? { ...item, status: "Cancelled" } : item));
    else { await cancelVoucherRequest(voucherId, reason); await refreshBackendData(); }
    setAppMessage("Voucher cancelled and its payment reversed.");
  }

  async function removeVoucher(voucherId, reason) {
    if (USE_DEMO_DATA) setVouchers((current) => current.map((item) => item.id === voucherId ? { ...item, deletedAt: new Date().toISOString(), deletionReason: reason } : item));
    else { await deleteVoucherRequest(voucherId, reason); await refreshBackendData(); }
    setAppMessage("Voucher moved to deleted records.");
  }

  async function recoverVoucher(voucherId) {
    if (USE_DEMO_DATA) setVouchers((current) => current.map((item) => item.id === voucherId ? { ...item, deletedAt: null, deletionReason: null } : item));
    else { await restoreVoucherRequest(voucherId); await refreshBackendData(); }
    setAppMessage("Voucher restored.");
  }

  if (authLoading) return <div className="auth-loading" role="status">Loading Illuminux system…</div>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  let page;
  if (currentPage === "admin-users" && user.role === "admin") {
    page = <AdminUsersPage currentUser={user} onBack={() => setCurrentPage("dashboard")} onLogout={handleLogout} />;
  } else if (currentPage === "suppliers") {
    page = <SuppliersPage suppliers={suppliers} user={user} onBack={() => setCurrentPage("dashboard")} onSelectSupplier={(item) => { setSelectedSupplierId(item.id); setCurrentPage("supplier-details"); }} onSaveTransaction={saveSupplierTransaction} onDeleteTransaction={removeSupplierTransaction} onSaveSupplier={saveSupplier} onDeleteSupplier={removeSupplier} onRestoreSupplier={recoverSupplier} activeTab={supplierSectionTab} onTabChange={setSupplierSectionTab} />;
  } else if (currentPage === "clients") {
    page = <ClientsPage clients={clients} user={user} onBack={() => setCurrentPage("dashboard")} onSelectClient={(item) => { setSelectedClientId(item.id); setCurrentPage("client-details"); }} onSaveTransaction={saveClientTransaction} onDeleteTransaction={removeClientTransaction} onReceivePayment={receiveClientPayment} onSaveClient={saveClient} onDeleteClient={removeClient} onRestoreClient={recoverClient} activeTab={clientSectionTab} onTabChange={setClientSectionTab} />;
  } else if (currentPage === "vouchers") {
    page = <VouchersPage user={user} suppliers={suppliers.filter((item) => !item.deletedAt)} vouchers={vouchers} auditLog={auditLog} onBack={() => setCurrentPage("dashboard")} onCreate={createVoucher} onEdit={editVoucher} onIssue={issueVoucher} onCancel={cancelVoucher} onDelete={removeVoucher} onRestore={recoverVoucher} />;
  } else if (currentPage === "total-sales") {
    page = <TotalSalesPage clients={clients} onBack={() => setCurrentPage("dashboard")} />;
  } else if (currentPage === "supplier-details" && selectedSupplier) {
    page = <SupplierDetailsPage supplier={selectedSupplier} user={user} onBack={() => setCurrentPage("suppliers")} onSaveTransaction={saveSupplierTransaction} onDeleteTransaction={removeSupplierTransaction} onRestoreTransaction={recoverSupplierTransaction} onSaveSupplier={saveSupplier} onDeleteSupplier={removeSupplier} />;
  } else if (currentPage === "client-details" && selectedClient) {
    page = <ClientDetailsPage client={selectedClient} user={user} onBack={() => setCurrentPage("clients")} onSaveTransaction={saveClientTransaction} onDeleteTransaction={removeClientTransaction} onRestoreTransaction={recoverClientTransaction} onReceivePayment={receiveClientPayment} onSaveClient={saveClient} onDeleteClient={removeClient} />;
  } else {
    page = <DashboardPage user={user} onLogout={handleLogout} recordSummary={recordSummary} voucherCount={vouchers.filter((item) => !item.deletedAt).length} onOpenClients={() => { setClientSectionTab("receivables"); setCurrentPage("clients"); }} onOpenSuppliers={() => { setSupplierSectionTab("payables"); setCurrentPage("suppliers"); }} onOpenVouchers={() => setCurrentPage("vouchers")} onOpenSales={() => setCurrentPage("total-sales")} onOpenAdmin={() => setCurrentPage("admin-users")} />;
  }

  return <>{dataLoading && <div className="app-data-loading" role="status">Refreshing records…</div>}{appMessage && <div className="dashboard-notice" role="status">{appMessage}</div>}{page}</>;
}
