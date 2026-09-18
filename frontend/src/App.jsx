import { useMemo, useState } from "react";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SuppliersPage from "./pages/SuppliersPage.jsx";
import SupplierDetailsPage from "./pages/SupplierDetailsPage.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import ClientDetailsPage from "./pages/ClientDetailsPage.jsx";
import VouchersPage from "./pages/VouchersPage.jsx";
import TotalSalesPage from "./pages/TotalSalesPage.jsx";
import { demoSuppliers } from "./data/demoSuppliers.js";
import { demoClients } from "./data/demoClients.js";
import usePersistentState from "./hooks/usePersistentState.js";
import { calculateBillingStatus, calculateCompanyStatus, createRecordId } from "./utils/recordHelpers.js";

const SESSION_KEY = "illuminux-demo-session";

function readSavedSession() {
  try {
    const savedSession = sessionStorage.getItem(SESSION_KEY);
    return savedSession ? JSON.parse(savedSession) : null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [user, setUser] = useState(readSavedSession);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [supplierSectionTab, setSupplierSectionTab] = useState("payables");
  const [clientSectionTab, setClientSectionTab] = useState("receivables");
  const [suppliers, setSuppliers] = usePersistentState("illuminux-suppliers-v1", demoSuppliers);
  const [clients, setClients] = usePersistentState("illuminux-clients-v1", demoClients);
  const [vouchers, setVouchers] = usePersistentState("illuminux-vouchers-v1", []);
  const [auditLog, setAuditLog] = usePersistentState("illuminux-audit-v1", []);

  const selectedSupplier = suppliers.find((item) => item.id === selectedSupplierId);
  const selectedClient = clients.find((item) => item.id === selectedClientId);
  const recordSummary = useMemo(() => {
    const purchases = suppliers.flatMap((item) => item.transactions);
    const sales = clients.flatMap((item) => item.transactions);
    return {
      payables: purchases.reduce((sum, item) => sum + Number(item.balance || 0), 0),
      receivables: sales.reduce((sum, item) => sum + Number(item.balance || 0), 0),
      totalPurchases: purchases.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      totalSales: sales.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    };
  }, [suppliers, clients]);

  function addAudit(action, details) {
    setAuditLog((current) => [{
      id: createRecordId("activity"), action, details, createdAt: new Date().toISOString()
    }, ...current].slice(0, 100));
  }

  function handleLogin(authenticatedUser) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
    setCurrentPage("dashboard");
  }

  function saveSupplierTransaction(supplierId, values) {
    let companyName = "Supplier";
    setSuppliers((current) => current.map((supplier) => {
      if (supplier.id !== supplierId) return supplier;
      companyName = supplier.name;
      const existing = supplier.transactions.find((item) => item.id === values.id);
      const paidAmount = existing ? Math.max(Number(existing.amount) - Number(existing.balance), 0) : 0;
      const balance = existing ? Math.max(Number(values.amount) - paidAmount, 0) : Number(values.amount);
      const transaction = {
        ...existing, ...values,
        id: existing?.id || createRecordId(supplier.id),
        amount: Number(values.amount), balance,
        voucherDate: existing?.voucherDate || "—",
        paymentDate: existing?.paymentDate || "—",
        chequeDate: existing?.chequeDate || "—",
        billingStatus: calculateBillingStatus(values.amount, balance)
      };
      const transactions = existing
        ? supplier.transactions.map((item) => item.id === existing.id ? transaction : item)
        : [...supplier.transactions, transaction];
      return { ...supplier, transactions, billingStatus: calculateCompanyStatus(transactions) };
    }));
    addAudit(values.id ? "Supplier transaction updated" : "Supplier transaction added", companyName);
  }

  function saveClientTransaction(clientId, values) {
    let companyName = "Client";
    setClients((current) => current.map((client) => {
      if (client.id !== clientId) return client;
      companyName = client.name;
      const existing = client.transactions.find((item) => item.id === values.id);
      const transaction = {
        ...existing, ...values,
        id: existing?.id || createRecordId(client.id),
        amount: Number(values.amount), balance: Number(values.balance),
        billingStatus: calculateBillingStatus(values.amount, values.balance)
      };
      const transactions = existing
        ? client.transactions.map((item) => item.id === existing.id ? transaction : item)
        : [...client.transactions, transaction];
      return {
        ...client, transactions,
        paymentDate: transactions.every((item) => item.billingStatus === "Paid") ? today() : "—",
        billingStatus: calculateCompanyStatus(transactions)
      };
    }));
    addAudit(values.id ? "Client transaction updated" : "Client transaction added", companyName);
  }

  function applyIssuedVoucher(voucher) {
    setSuppliers((current) => current.map((supplier) => {
      if (supplier.id !== voucher.supplierId) return supplier;
      const transactions = supplier.transactions.map((transaction) => {
        if (transaction.id !== voucher.transactionId) return transaction;
        const balance = Math.max(Number(transaction.balance) - Number(voucher.amountApplied), 0);
        return {
          ...transaction,
          voucherNumber: voucher.voucherNumber, voucherStatus: "Issued",
          voucherDate: voucher.voucherDate, paymentDate: voucher.paymentDate,
          chequeDate: voucher.chequeDate, chequeNumber: voucher.chequeNumber,
          balance, billingStatus: calculateBillingStatus(transaction.amount, balance)
        };
      });
      return { ...supplier, transactions, billingStatus: calculateCompanyStatus(transactions) };
    }));
  }

  function createVoucher(values) {
    const voucher = {
      ...values, id: createRecordId("voucher"),
      amountApplied: Number(values.amountApplied), createdAt: new Date().toISOString()
    };
    setVouchers((current) => [...current, voucher]);
    if (voucher.status === "Issued") {
      applyIssuedVoucher(voucher);
    } else {
      setSuppliers((current) => current.map((supplier) => supplier.id !== voucher.supplierId ? supplier : {
        ...supplier,
        transactions: supplier.transactions.map((transaction) => transaction.id !== voucher.transactionId ? transaction : {
          ...transaction,
          voucherNumber: voucher.voucherNumber,
          voucherStatus: "Draft"
        })
      }));
    }
    addAudit(`Voucher ${voucher.status.toLowerCase()}`, `${voucher.voucherNumber} · ${voucher.supplierName}`);
  }

  function issueVoucher(voucherId) {
    const voucher = vouchers.find((item) => item.id === voucherId);
    if (!voucher || voucher.status !== "Draft") return;
    const issued = { ...voucher, status: "Issued", issuedAt: new Date().toISOString() };
    setVouchers((current) => current.map((item) => item.id === voucherId ? issued : item));
    applyIssuedVoucher(issued);
    addAudit("Voucher issued", `${voucher.voucherNumber} · ${voucher.supplierName}`);
  }

  function cancelVoucher(voucherId) {
    const voucher = vouchers.find((item) => item.id === voucherId);
    if (!voucher || voucher.status === "Cancelled") return;
    setVouchers((current) => current.map((item) => item.id === voucherId
      ? { ...item, status: "Cancelled", cancelledAt: new Date().toISOString() } : item));

    setSuppliers((current) => current.map((supplier) => {
      if (supplier.id !== voucher.supplierId) return supplier;
      const transactions = supplier.transactions.map((transaction) => {
        if (transaction.id !== voucher.transactionId) return transaction;
        const balance = voucher.status === "Issued"
          ? Math.min(Number(transaction.amount), Number(transaction.balance) + Number(voucher.amountApplied))
          : Number(transaction.balance);
        return {
          ...transaction, voucherNumber: "—", voucherStatus: "Cancelled",
          voucherDate: "—", paymentDate: "—", chequeDate: "—", chequeNumber: "—",
          balance, billingStatus: calculateBillingStatus(transaction.amount, balance)
        };
      });
      return { ...supplier, transactions, billingStatus: calculateCompanyStatus(transactions) };
    }));
    addAudit("Voucher cancelled", `${voucher.voucherNumber} · ${voucher.supplierName}`);
  }

  if (!user) return <LoginPage onLogin={handleLogin} />;
  if (currentPage === "suppliers") return <SuppliersPage suppliers={suppliers} onBack={() => setCurrentPage("dashboard")} onSelectSupplier={(item) => { setSelectedSupplierId(item.id); setCurrentPage("supplier-details"); }} onSaveTransaction={saveSupplierTransaction} activeTab={supplierSectionTab} onTabChange={setSupplierSectionTab} />;
  if (currentPage === "clients") return <ClientsPage clients={clients} onBack={() => setCurrentPage("dashboard")} onSelectClient={(item) => { setSelectedClientId(item.id); setCurrentPage("client-details"); }} onSaveTransaction={saveClientTransaction} activeTab={clientSectionTab} onTabChange={setClientSectionTab} />;
  if (currentPage === "vouchers") return <VouchersPage suppliers={suppliers} vouchers={vouchers} auditLog={auditLog} onBack={() => setCurrentPage("dashboard")} onCreate={createVoucher} onIssue={issueVoucher} onCancel={cancelVoucher} />;
  if (currentPage === "total-sales") return <TotalSalesPage clients={clients} onBack={() => setCurrentPage("dashboard")} />;
  if (currentPage === "supplier-details" && selectedSupplier) return <SupplierDetailsPage supplier={selectedSupplier} onBack={() => setCurrentPage("suppliers")} onSaveTransaction={saveSupplierTransaction} />;
  if (currentPage === "client-details" && selectedClient) return <ClientDetailsPage client={selectedClient} onBack={() => setCurrentPage("clients")} onSaveTransaction={saveClientTransaction} />;

  return <DashboardPage user={user} onLogout={handleLogout} recordSummary={recordSummary} onOpenClients={() => { setClientSectionTab("receivables"); setCurrentPage("clients"); }} onOpenSuppliers={() => { setSupplierSectionTab("payables"); setCurrentPage("suppliers"); }} onOpenVouchers={() => setCurrentPage("vouchers")} onOpenSales={() => setCurrentPage("total-sales")} />;
}
