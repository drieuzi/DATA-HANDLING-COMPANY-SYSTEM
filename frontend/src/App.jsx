import { useEffect, useMemo, useState } from "react";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import SuppliersPage from "./pages/SuppliersPage.jsx";
import SupplierDetailsPage from "./pages/SupplierDetailsPage.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import ClientDetailsPage from "./pages/ClientDetailsPage.jsx";
import VouchersPage from "./pages/VouchersPage.jsx";
import TotalSalesPage from "./pages/TotalSalesPage.jsx";
import TotalPurchasesPage from "./pages/TotalPurchasesPage.jsx";
import OutsideServicesPage from "./pages/OutsideServicesPage.jsx";
import AdminUsersPage from "./pages/AdminUsersPage.jsx";
import AdminMonitoringPage from "./pages/AdminMonitoringPage.jsx";
import ReportExportPage from "./pages/ReportExportPage.jsx";
import { getCurrentUser, logout, USE_DEMO_DATA } from "./services/authApi.js";
import {
  createSupplier, createSupplierTransaction, deleteSupplier, deleteSupplierTransaction,
  listSuppliers, permanentlyDeleteSupplier, permanentlyDeleteSupplierTransaction,
  restoreSupplier, restoreSupplierTransaction, updateSupplier, updateSupplierTransaction
} from "./services/supplierApi.js";
import {
  createVoucher as createVoucherRequest,
  deleteVoucher as deleteVoucherRequest, issueVoucher as issueVoucherRequest,
  listVouchers, permanentlyDeleteVoucher as permanentlyDeleteVoucherRequest,
  restoreVoucher as restoreVoucherRequest,
  updateVoucher as updateVoucherRequest
} from "./services/voucherApi.js";
import { listAuditLogs, recordReportExport } from "./services/auditApi.js";
import {
  createClient, createClientTransaction, deleteClient, deleteClientTransaction,
  confirmClientPaymentDeposit,
  listClients, permanentlyDeleteClient, permanentlyDeleteClientTransaction,
  recordClientPayment, rescheduleClientPaymentCheque,
  restoreClient, restoreClientTransaction, updateClient, updateClientTransaction
} from "./services/clientApi.js";
import {
  createOutsideService, deleteOutsideService, downloadOutsideServiceAttachment, listOutsideServices,
  permanentlyDeleteOutsideService, removeOutsideServiceAttachment, replaceOutsideServiceAttachment,
  restoreOutsideService, updateOutsideService, viewOutsideServiceAttachment
} from "./services/outsideServiceApi.js";
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
  const [focusedClientTransactionId, setFocusedClientTransactionId] = useState(null);
  const [supplierSectionTab, setSupplierSectionTab] = useState("payables");
  const [clientSectionTab, setClientSectionTab] = useState("receivables");
  const [suppliers, setSuppliers] = useState(USE_DEMO_DATA ? demoSuppliers : []);
  const [clients, setClients] = useState(USE_DEMO_DATA ? demoClients : []);
  const [vouchers, setVouchers] = useState([]);
  const [outsideServices, setOutsideServices] = useState([]);
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
    if (!user || USE_DEMO_DATA) return undefined;
    const timer = window.setInterval(() => {
      refreshBackendData(user).catch((error) => setAppMessage(error.message));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!appMessage) return undefined;
    const timer = window.setTimeout(() => setAppMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [appMessage]);

  async function refreshBackendData(account = user) {
    if (!account || USE_DEMO_DATA) return;
    const isAdmin = account.role === "admin";
    const [supplierRecords, clientRecords, voucherRecords, outsideServiceRecords, activityRecords] = await Promise.all([
      listSuppliers(isAdmin), listClients(isAdmin), listVouchers(isAdmin),
      listOutsideServices(isAdmin),
      isAdmin ? listAuditLogs(500) : Promise.resolve([])
    ]);
    setSuppliers(supplierRecords);
    setClients(clientRecords);
    setVouchers(voucherRecords);
    setOutsideServices(outsideServiceRecords);
    setAuditLog(activityRecords);
  }

  const selectedSupplier = suppliers.find((item) => item.id === selectedSupplierId);
  const selectedClient = clients.find((item) => item.id === selectedClientId);
  const dueChequePayments = useMemo(() => clients.flatMap((client) =>
    client.deletedAt ? [] : client.transactions
      .filter((transaction) => !transaction.deletedAt && transaction.depositDue)
      .map((transaction) => ({ ...transaction, clientName: client.name }))
  ), [clients]);

  function openDueChequeTransaction(transaction) {
    setSelectedClientId(String(transaction.clientId || transaction.companyId));
    setFocusedClientTransactionId(String(transaction.id));
    setCurrentPage("client-details");
  }
  function addLocalAudit(action, details, entityType = null, entityId = null) {
    setAuditLog((current) => [{
      id: createRecordId("activity"), action, details, entityType, entityId,
      actorUsername: user?.username, actorFullName: user?.fullName,
      createdAt: new Date().toISOString()
    }, ...current].slice(0, 100));
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
    if (USE_DEMO_DATA) setSuppliers((current) => current.map((item) => {
      if (item.id !== supplierId) return item;
      const deletedAt = new Date().toISOString();
      return {
        ...item, deletedAt, deletionReason: reason, restoreAllowed: true,
        transactions: item.transactions.map((transaction) => transaction.deletedAt ? transaction : {
          ...transaction, deletedAt, deletionReason: reason, restoreAllowed: true, deletedWithCompany: true
        })
      };
    }));
    else { await deleteSupplier(supplierId, reason); await refreshBackendData(); }
    setAppMessage("Supplier moved to deleted records.");
  }

  async function recoverSupplier(supplierId) {
    if (USE_DEMO_DATA) setSuppliers((current) => current.map((item) => item.id === supplierId ? {
      ...item, deletedAt: null, deletionReason: null,
      transactions: item.transactions.map((transaction) => transaction.deletedWithCompany ? {
        ...transaction, deletedAt: null, deletionReason: null, deletedWithCompany: false
      } : transaction)
    } : item));
    else { await restoreSupplier(supplierId); await refreshBackendData(); }
    setAppMessage("Supplier restored.");
  }

  async function permanentlyRemoveSupplier(supplierId, purgeDetails) {
    if (USE_DEMO_DATA) {
      const supplier = suppliers.find((item) => item.id === supplierId);
      setSuppliers((current) => current.filter((item) => item.id !== supplierId));
      addLocalAudit("PERMANENT_PURGE", {
        companyName: supplier?.name,
        reason: purgeDetails?.reason,
        status: "Unrestorable",
        deletedTransactionCount: supplier?.transactions?.length || 0
      }, "supplier", supplierId);
    } else { await permanentlyDeleteSupplier(supplierId, purgeDetails); await refreshBackendData(); }
    setSelectedSupplierId(null);
    setAppMessage("Supplier and its full record chain were permanently deleted. A minimal audit entry was kept.");
  }

  async function removeSupplierTransaction(transactionId, reason) {
    if (USE_DEMO_DATA) {
      setSuppliers((current) => current.map((supplier) => ({
        ...supplier,
        transactions: supplier.transactions.map((item) => item.id === transactionId
          ? { ...item, deletedAt: new Date().toISOString(), deletionReason: reason, restoreAllowed: true }
          : item)
      })));
      addLocalAudit("SUPPLIER_TRANSACTION_DELETED", { reason, deletionMode: "restorable" }, "supplier_transaction", transactionId);
    }
    else { await deleteSupplierTransaction(transactionId, reason); await refreshBackendData(); }
    setAppMessage("Transaction moved to deleted records.");
  }

  async function recoverSupplierTransaction(transactionId) {
    if (USE_DEMO_DATA) setSuppliers((current) => current.map((supplier) => ({ ...supplier, transactions: supplier.transactions.map((item) => item.id === transactionId ? { ...item, deletedAt: null, deletionReason: null } : item) })));
    else { await restoreSupplierTransaction(transactionId); await refreshBackendData(); }
    setAppMessage("Transaction restored.");
  }

  async function permanentlyRemoveSupplierTransaction(transactionId, purgeDetails) {
    if (USE_DEMO_DATA) {
      setSuppliers((current) => current.map((supplier) => ({
        ...supplier,
        transactions: supplier.transactions.filter((item) => item.id !== transactionId)
      })));
      setVouchers((current) => current.filter((item) => item.transactionId !== transactionId));
      addLocalAudit("PERMANENT_PURGE", {
        transactionId, reason: purgeDetails?.reason, status: "Unrestorable"
      }, "supplier_transaction", transactionId);
    } else {
      await permanentlyDeleteSupplierTransaction(transactionId, purgeDetails);
      await refreshBackendData();
    }
    setAppMessage("Supplier transaction and its linked vouchers and payments were permanently deleted.");
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
    if (USE_DEMO_DATA) setClients((current) => current.map((item) => {
      if (item.id !== clientId) return item;
      const deletedAt = new Date().toISOString();
      return {
        ...item, deletedAt, deletionReason: reason, restoreAllowed: true,
        transactions: item.transactions.map((transaction) => transaction.deletedAt ? transaction : {
          ...transaction, deletedAt, deletionReason: reason, restoreAllowed: true, deletedWithCompany: true
        })
      };
    }));
    else { await deleteClient(clientId, reason); await refreshBackendData(); }
    setAppMessage("Client moved to deleted records.");
  }

  async function recoverClient(clientId) {
    if (USE_DEMO_DATA) setClients((current) => current.map((item) => item.id === clientId ? {
      ...item, deletedAt: null, deletionReason: null,
      transactions: item.transactions.map((transaction) => transaction.deletedWithCompany ? {
        ...transaction, deletedAt: null, deletionReason: null, deletedWithCompany: false
      } : transaction)
    } : item));
    else { await restoreClient(clientId); await refreshBackendData(); }
    setAppMessage("Client restored.");
  }

  async function permanentlyRemoveClient(clientId, purgeDetails) {
    if (USE_DEMO_DATA) {
      const client = clients.find((item) => item.id === clientId);
      setClients((current) => current.filter((item) => item.id !== clientId));
      addLocalAudit("PERMANENT_PURGE", {
        companyName: client?.name,
        reason: purgeDetails?.reason,
        status: "Unrestorable",
        deletedTransactionCount: client?.transactions?.length || 0
      }, "client", clientId);
    } else { await permanentlyDeleteClient(clientId, purgeDetails); await refreshBackendData(); }
    setSelectedClientId(null);
    setAppMessage("Client and its full record chain were permanently deleted. A minimal audit entry was kept.");
  }

  async function removeClientTransaction(transactionId, reason) {
    if (USE_DEMO_DATA) {
      setClients((current) => current.map((client) => ({
        ...client,
        transactions: client.transactions.map((item) => item.id === transactionId
          ? { ...item, deletedAt: new Date().toISOString(), deletionReason: reason, restoreAllowed: true }
          : item)
      })));
      addLocalAudit("CLIENT_TRANSACTION_DELETED", { reason, deletionMode: "restorable" }, "client_transaction", transactionId);
    }
    else { await deleteClientTransaction(transactionId, reason); await refreshBackendData(); }
    setAppMessage("Client transaction moved to deleted records.");
  }

  async function recoverClientTransaction(transactionId) {
    if (USE_DEMO_DATA) setClients((current) => current.map((client) => ({ ...client, transactions: client.transactions.map((item) => item.id === transactionId ? { ...item, deletedAt: null, deletionReason: null } : item) })));
    else { await restoreClientTransaction(transactionId); await refreshBackendData(); }
    setAppMessage("Client transaction restored.");
  }

  async function permanentlyRemoveClientTransaction(transactionId, purgeDetails) {
    if (USE_DEMO_DATA) {
      setClients((current) => current.map((client) => ({
        ...client,
        transactions: client.transactions.filter((item) => item.id !== transactionId)
      })));
      addLocalAudit("PERMANENT_PURGE", {
        transactionId, reason: purgeDetails?.reason, status: "Unrestorable"
      }, "client_transaction", transactionId);
    } else {
      await permanentlyDeleteClientTransaction(transactionId, purgeDetails);
      await refreshBackendData();
    }
    setAppMessage("Client transaction and its linked payments were permanently deleted.");
  }

  async function receiveClientPayment(transactionId, values) {
    if (USE_DEMO_DATA) {
      const selectedTransaction = clients.flatMap((client) => client.transactions)
        .find((transaction) => transaction.id === transactionId);
      if (!selectedTransaction || Number(values.amount) !== Number(selectedTransaction.balance)) {
        throw new Error("Partial payments are not allowed. Payment must equal the full remaining balance.");
      }
      setClients((current) => current.map((client) => {
        const transactions = client.transactions.map((transaction) => {
          if (transaction.id !== transactionId) return transaction;
          return {
            ...transaction,
            ...values,
            paymentId: createRecordId("client-payment"),
            depositStatus: "Pending Deposit",
            depositDue: values.chequeDate <= today(),
            billingStatus: "Not Paid"
          };
        });
        return { ...client, transactions, billingStatus: calculateCompanyStatus(transactions) };
      }));
    } else { await recordClientPayment(transactionId, values); await refreshBackendData(); }
    setAppMessage("Client cheque recorded as Pending Deposit. Confirm it after the cheque date.");
  }

  async function confirmClientDeposit(paymentId) {
    if (USE_DEMO_DATA) {
      setClients((current) => current.map((client) => {
        const transactions = client.transactions.map((transaction) => transaction.paymentId === paymentId
          ? { ...transaction, balance: 0, billingStatus: "Paid", depositStatus: "Deposited", depositDue: false, paymentDate: transaction.chequeDate }
          : transaction);
        return { ...client, transactions, billingStatus: calculateCompanyStatus(transactions) };
      }));
    } else {
      await confirmClientPaymentDeposit(paymentId);
      await refreshBackendData();
    }
    setAppMessage("Cheque deposit confirmed. The client transaction is now Paid.");
  }

  async function rescheduleClientCheque(paymentId, chequeDate) {
    if (USE_DEMO_DATA) {
      setClients((current) => current.map((client) => ({
        ...client,
        transactions: client.transactions.map((transaction) => transaction.paymentId === paymentId
          ? { ...transaction, chequeDate, depositDue: chequeDate <= today() }
          : transaction)
      })));
    } else {
      await rescheduleClientPaymentCheque(paymentId, chequeDate);
      await refreshBackendData();
    }
    setAppMessage("Cheque date updated. The payment remains Pending Deposit.");
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

  async function removeVoucher(voucherId, reason) {
    if (USE_DEMO_DATA) {
      const deletedAt = new Date().toISOString();
      const voucher = vouchers.find((item) => item.id === voucherId);
      setVouchers((current) => current.map((item) => item.id === voucherId ? {
        ...item, previousStatus: item.status, status: "Deleted",
        deletedAt, deletionReason: reason, restoreAllowed: true
      } : item));
      addLocalAudit("VOUCHER_DELETED", {
        voucherNumber: voucher?.voucherNumber,
        previousStatus: voucher?.status,
        status: "Deleted",
        deletionMode: "restorable",
        reason
      }, "voucher", voucherId);
    }
    else { await deleteVoucherRequest(voucherId, reason); await refreshBackendData(); }
    setAppMessage("Voucher moved to Admin Monitoring deleted records.");
  }

  async function recoverVoucher(voucherId) {
    if (USE_DEMO_DATA) setVouchers((current) => current.map((item) => item.id === voucherId ? {
      ...item, status: "Draft", deletedAt: null, deletionReason: null, restoreAllowed: true
    } : item));
    else { await restoreVoucherRequest(voucherId); await refreshBackendData(); }
    setAppMessage("Voucher restored as Draft. No payment was reapplied.");
  }

  async function permanentlyRemoveVoucher(voucherId, purgeDetails) {
    if (USE_DEMO_DATA) {
      const voucher = vouchers.find((item) => item.id === voucherId);
      setVouchers((current) => current.filter((item) => item.id !== voucherId));
      addLocalAudit("PERMANENT_PURGE", {
        voucherNumber: voucher?.voucherNumber,
        reason: purgeDetails?.reason,
        status: "Unrestorable"
      }, "voucher", voucherId);
    } else {
      await permanentlyDeleteVoucherRequest(voucherId, purgeDetails);
      await refreshBackendData();
    }
    setAppMessage("Voucher and its reversed payment record were permanently deleted.");
  }

  async function saveOutsideService(serviceId, values) {
    if (USE_DEMO_DATA) {
      const { attachment, ...recordValues } = values;
      const attachmentValues = attachment ? {
        attachmentName: attachment.name,
        attachmentMimeType: attachment.type,
        attachmentSize: attachment.size,
        attachmentObjectUrl: URL.createObjectURL(attachment),
        hasAttachment: true
      } : {};
      if (serviceId) {
        setOutsideServices((current) => current.map((item) => item.id === serviceId
          ? { ...item, ...recordValues, ...attachmentValues, amount: Number(values.amount), updatedAt: new Date().toISOString() }
          : item));
        addLocalAudit("OUTSIDE_SERVICE_UPDATED", recordValues, "outside_service", serviceId);
      } else {
        const created = {
          ...recordValues,
          ...attachmentValues,
          id: createRecordId("outside-service"),
          amount: Number(values.amount),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setOutsideServices((current) => [created, ...current]);
        addLocalAudit("OUTSIDE_SERVICE_CREATED", recordValues, "outside_service", created.id);
      }
    } else {
      if (serviceId) await updateOutsideService(serviceId, values);
      else await createOutsideService(values);
      await refreshBackendData();
    }
    setAppMessage(serviceId ? "Other expense updated." : "Other expense added to monthly expenses.");
  }

  async function replaceOutsideServiceFile(serviceId, attachment) {
    if (USE_DEMO_DATA) {
      setOutsideServices((current) => current.map((item) => item.id === serviceId ? {
        ...item,
        attachmentName: attachment.name,
        attachmentMimeType: attachment.type,
        attachmentSize: attachment.size,
        attachmentObjectUrl: URL.createObjectURL(attachment),
        hasAttachment: true
      } : item));
      addLocalAudit("OUTSIDE_SERVICE_ATTACHMENT_REPLACED", {
        attachmentName: attachment.name
      }, "outside_service", serviceId);
    } else {
      await replaceOutsideServiceAttachment(serviceId, attachment);
      await refreshBackendData();
    }
  }

  async function removeOutsideServiceFile(serviceId) {
    if (USE_DEMO_DATA) {
      setOutsideServices((current) => current.map((item) => item.id === serviceId ? {
        ...item,
        attachmentName: null,
        attachmentMimeType: null,
        attachmentSize: null,
        attachmentObjectUrl: null,
        hasAttachment: false
      } : item));
      addLocalAudit("OUTSIDE_SERVICE_ATTACHMENT_REMOVED", {}, "outside_service", serviceId);
    } else {
      await removeOutsideServiceAttachment(serviceId);
      await refreshBackendData();
    }
  }

  async function viewOutsideServiceFile(serviceId) {
    if (!USE_DEMO_DATA) {
      await viewOutsideServiceAttachment(serviceId);
      if (user?.role === "admin") setAuditLog(await listAuditLogs(500));
      return;
    }
    const record = outsideServices.find((item) => item.id === serviceId);
    if (record?.attachmentObjectUrl) window.open(record.attachmentObjectUrl, "_blank", "noopener,noreferrer");
    addLocalAudit("OUTSIDE_SERVICE_ATTACHMENT_VIEWED", {
      attachmentName: record?.attachmentName
    }, "outside_service", serviceId);
  }

  async function downloadOutsideServiceFile(serviceId, filename) {
    if (!USE_DEMO_DATA) {
      await downloadOutsideServiceAttachment(serviceId, filename);
      if (user?.role === "admin") setAuditLog(await listAuditLogs(500));
      return;
    }
    const record = outsideServices.find((item) => item.id === serviceId);
    if (record?.attachmentObjectUrl) {
      const link = document.createElement("a");
      link.href = record.attachmentObjectUrl;
      link.download = filename || "outside-service-attachment";
      link.click();
    }
    addLocalAudit("OUTSIDE_SERVICE_ATTACHMENT_DOWNLOADED", {
      attachmentName: filename || record?.attachmentName
    }, "outside_service", serviceId);
  }

  async function removeOutsideService(serviceId, reason) {
    if (USE_DEMO_DATA) {
      const service = outsideServices.find((item) => item.id === serviceId);
      setOutsideServices((current) => current.map((item) => item.id === serviceId ? {
        ...item,
        deletedAt: new Date().toISOString(),
        deletionReason: reason,
        restoreAllowed: true
      } : item));
      addLocalAudit("OUTSIDE_SERVICE_DELETED", {
        item: service?.item,
        amount: service?.amount,
        date: service?.date,
        reason,
        deletionMode: "restorable"
      }, "outside_service", serviceId);
    } else {
      await deleteOutsideService(serviceId, reason);
      await refreshBackendData();
    }
    setAppMessage("Other expense moved to Admin Monitoring and removed from monthly analytics.");
  }

  async function recoverOutsideService(serviceId) {
    if (USE_DEMO_DATA) {
      setOutsideServices((current) => current.map((item) => item.id === serviceId ? {
        ...item, deletedAt: null, deletionReason: null, restoreAllowed: true
      } : item));
      addLocalAudit("OUTSIDE_SERVICE_RESTORED", {}, "outside_service", serviceId);
    } else {
      await restoreOutsideService(serviceId);
      await refreshBackendData();
    }
    setAppMessage("Other expense restored.");
  }

  async function permanentlyRemoveOutsideService(serviceId, purgeDetails) {
    if (USE_DEMO_DATA) {
      const service = outsideServices.find((item) => item.id === serviceId);
      setOutsideServices((current) => current.filter((item) => item.id !== serviceId));
      addLocalAudit("PERMANENT_PURGE", {
        item: service?.item,
        amount: service?.amount,
        date: service?.date,
        reason: purgeDetails?.reason,
        status: "Unrestorable"
      }, "outside_service", serviceId);
    } else {
      await permanentlyDeleteOutsideService(serviceId, purgeDetails);
      await refreshBackendData();
    }
    setAppMessage("Other expense permanently deleted. A minimal audit entry was kept.");
  }

  async function recordExport(details) {
    if (USE_DEMO_DATA) {
      addLocalAudit("REPORT_EXPORTED", details, "report");
      return;
    }
    await recordReportExport(details);
    if (user?.role === "admin") setAuditLog(await listAuditLogs(500));
  }

  if (authLoading) return <div className="auth-loading" role="status">Loading Illuminux system…</div>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  let page;
  if (currentPage === "admin-users" && user.role === "admin") {
    page = <AdminUsersPage currentUser={user} onBack={() => setCurrentPage("dashboard")} onLogout={handleLogout} />;
  } else if (currentPage === "admin-monitoring" && user.role === "admin") {
    page = <AdminMonitoringPage user={user} auditLog={auditLog} suppliers={suppliers} clients={clients} vouchers={vouchers} outsideServices={outsideServices} onBack={() => setCurrentPage("dashboard")} onLogout={handleLogout} onRestoreSupplier={recoverSupplier} onPermanentDeleteSupplier={permanentlyRemoveSupplier} onRestoreSupplierTransaction={recoverSupplierTransaction} onPermanentDeleteSupplierTransaction={permanentlyRemoveSupplierTransaction} onRestoreClient={recoverClient} onPermanentDeleteClient={permanentlyRemoveClient} onRestoreClientTransaction={recoverClientTransaction} onPermanentDeleteClientTransaction={permanentlyRemoveClientTransaction} onRestoreVoucher={recoverVoucher} onPermanentDeleteVoucher={permanentlyRemoveVoucher} onRestoreOutsideService={recoverOutsideService} onPermanentDeleteOutsideService={permanentlyRemoveOutsideService} />;
  } else if (currentPage === "file-report" && user.role === "admin") {
    page = <ReportExportPage user={user} clients={clients} suppliers={suppliers} outsideServices={outsideServices.filter((item) => !item.deletedAt)} onBack={() => setCurrentPage("dashboard")} onLogout={handleLogout} onRecordExport={recordExport} />;
  } else if (currentPage === "suppliers") {
    page = <SuppliersPage suppliers={suppliers} user={user} onBack={() => setCurrentPage("dashboard")} onSelectSupplier={(item) => { setSelectedSupplierId(item.id); setCurrentPage("supplier-details"); }} onSaveTransaction={saveSupplierTransaction} onDeleteTransaction={removeSupplierTransaction} onSaveSupplier={saveSupplier} onDeleteSupplier={removeSupplier} onRestoreSupplier={recoverSupplier} activeTab={supplierSectionTab} onTabChange={setSupplierSectionTab} />;
  } else if (currentPage === "clients") {
    page = <ClientsPage clients={clients} user={user} onBack={() => setCurrentPage("dashboard")} onSelectClient={(item) => { setSelectedClientId(item.id); setCurrentPage("client-details"); }} onSaveTransaction={saveClientTransaction} onDeleteTransaction={removeClientTransaction} onReceivePayment={receiveClientPayment} onConfirmDeposit={confirmClientDeposit} onRescheduleCheque={rescheduleClientCheque} onSaveClient={saveClient} onDeleteClient={removeClient} onRestoreClient={recoverClient} activeTab={clientSectionTab} onTabChange={setClientSectionTab} />;
  } else if (currentPage === "vouchers") {
    page = <VouchersPage user={user} suppliers={suppliers.filter((item) => !item.deletedAt)} vouchers={vouchers} onBack={() => setCurrentPage("dashboard")} onCreate={createVoucher} onEdit={editVoucher} onIssue={issueVoucher} onDelete={removeVoucher} />;
  } else if (currentPage === "total-sales") {
    page = <TotalSalesPage clients={clients} onBack={() => setCurrentPage("dashboard")} />;
  } else if (currentPage === "total-purchases") {
    page = <TotalPurchasesPage suppliers={suppliers} vouchers={vouchers} onBack={() => setCurrentPage("dashboard")} />;
  } else if (currentPage === "outside-services") {
    page = <OutsideServicesPage user={user} services={outsideServices.filter((item) => !item.deletedAt)} onBack={() => setCurrentPage("dashboard")} onSave={saveOutsideService} onDelete={removeOutsideService} onViewAttachment={viewOutsideServiceFile} onDownloadAttachment={downloadOutsideServiceFile} onReplaceAttachment={replaceOutsideServiceFile} onRemoveAttachment={removeOutsideServiceFile} onRecordExport={recordExport} />;
  } else if (currentPage === "supplier-details" && selectedSupplier) {
    page = <SupplierDetailsPage supplier={selectedSupplier} user={user} onBack={() => setCurrentPage("suppliers")} onSaveTransaction={saveSupplierTransaction} onDeleteTransaction={removeSupplierTransaction} onRestoreTransaction={recoverSupplierTransaction} onSaveSupplier={saveSupplier} onDeleteSupplier={removeSupplier} onRestoreSupplier={recoverSupplier} />;
  } else if (currentPage === "client-details" && selectedClient) {
    page = <ClientDetailsPage client={selectedClient} user={user} focusTransactionId={focusedClientTransactionId} onFocusHandled={() => setFocusedClientTransactionId(null)} onBack={() => setCurrentPage("clients")} onSaveTransaction={saveClientTransaction} onDeleteTransaction={removeClientTransaction} onRestoreTransaction={recoverClientTransaction} onReceivePayment={receiveClientPayment} onConfirmDeposit={confirmClientDeposit} onRescheduleCheque={rescheduleClientCheque} onSaveClient={saveClient} onDeleteClient={removeClient} onRestoreClient={recoverClient} />;
  } else {
    page = <DashboardPage user={user} onLogout={handleLogout} dueChequePayments={dueChequePayments} voucherCount={vouchers.filter((item) => !item.deletedAt).length} onOpenDueCheque={openDueChequeTransaction} onOpenClients={() => { setClientSectionTab("receivables"); setCurrentPage("clients"); }} onOpenSuppliers={() => { setSupplierSectionTab("payables"); setCurrentPage("suppliers"); }} onOpenVouchers={() => setCurrentPage("vouchers")} onOpenSales={() => setCurrentPage("total-sales")} onOpenPurchases={() => setCurrentPage("total-purchases")} onOpenOutsideServices={() => setCurrentPage("outside-services")} onOpenAdmin={() => setCurrentPage("admin-users")} onOpenMonitoring={() => setCurrentPage("admin-monitoring")} onOpenReports={() => setCurrentPage("file-report")} />;
  }

  return <>{dataLoading && <div className="app-data-loading" role="status">Refreshing records…</div>}{appMessage && <div className="dashboard-notice" role="status">{appMessage}</div>}{page}</>;
}
