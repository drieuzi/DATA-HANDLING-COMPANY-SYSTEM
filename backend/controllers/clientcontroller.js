const pool = require("../config/db");
const { writeAudit } = require("../services/auditservice");
const HttpError = require("../utils/httpError");
const validate = require("../utils/validation");

function mapTransaction(row) {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    date: row.transaction_date,
    salesInvoice: row.sales_invoice_number || "—",
    purchaseOrder: row.purchase_order_number || "—",
    collectionReceipt: row.collection_receipt_number || "—",
    paymentDate: row.payment_date || "—",
    chequeDate: row.cheque_date || "—",
    amount: Number(row.amount),
    balance: Number(row.balance),
    billingStatus: row.billing_status,
    deletedAt: row.deleted_at,
    deletionReason: row.deletion_reason,
    restoreAllowed: row.restore_allowed !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function companyStatus(transactions) {
  if (!transactions.length) return "Not Paid";
  if (transactions.every((item) => item.billingStatus === "Paid")) return "Paid";
  return "Not Paid";
}

function mapClient(row, transactions = []) {
  const activeTransactions = transactions.filter((transaction) => !transaction.deletedAt);
  const latestPaymentDate = activeTransactions
    .map((item) => item.paymentDate)
    .filter((value) => value && value !== "—")
    .sort()
    .at(-1) || "—";
  return {
    id: String(row.id),
    clientCode: row.client_code || "",
    name: row.name,
    businessAddress: row.business_address || "",
    contactPerson: row.contact_person || "",
    contactNumber: row.contact_number || "",
    email: row.email || "",
    isActive: row.is_active,
    deletedAt: row.deleted_at,
    deletionReason: row.deletion_reason,
    restoreAllowed: row.restore_allowed !== false,
    paymentDate: latestPaymentDate,
    billingStatus: companyStatus(activeTransactions),
    transactions,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadClients(includeDeleted = false) {
  const [clientsResult, transactionsResult] = await Promise.all([
    pool.query(
      `SELECT * FROM clients
       WHERE deleted_at IS NULL OR ($1::BOOLEAN AND restore_allowed = TRUE)
       ORDER BY deleted_at NULLS FIRST, is_active DESC, name`,
      [includeDeleted]
    ),
    pool.query(
      `SELECT * FROM client_transactions
       WHERE deleted_at IS NULL OR ($1::BOOLEAN AND restore_allowed = TRUE)
       ORDER BY transaction_date DESC, created_at DESC, id DESC`,
      [includeDeleted]
    )
  ]);
  const grouped = new Map();
  transactionsResult.rows.forEach((row) => {
    const key = String(row.client_id);
    grouped.set(key, [...(grouped.get(key) || []), mapTransaction(row)]);
  });
  return clientsResult.rows.map((row) => mapClient(row, grouped.get(String(row.id)) || []));
}

async function listClients(request, response, next) {
  try {
    const includeDeleted = request.user.role === "admin" && request.query.includeDeleted === "true";
    response.json({ clients: await loadClients(includeDeleted) });
  } catch (error) { next(error); }
}

async function getClient(request, response, next) {
  try {
    const clientId = validate.id(request.params.id, "Client ID");
    const clients = await loadClients(request.user.role === "admin");
    const client = clients.find((item) => Number(item.id) === clientId);
    if (!client) throw new HttpError(404, "Client not found.");
    response.json({ client });
  } catch (error) { next(error); }
}

function clientValues(body) {
  return {
    clientCode: validate.text(body.clientCode, "Client code", { max: 40 }),
    name: validate.text(body.name, "Client name", { required: true, max: 160 }),
    businessAddress: validate.text(body.businessAddress, "Business address", { max: 1000 }),
    contactPerson: validate.text(body.contactPerson, "Contact person", { max: 120 }),
    contactNumber: validate.text(body.contactNumber, "Contact number", { max: 40 }),
    email: validate.text(body.email, "Email", { max: 160 })
  };
}

async function createClient(request, response, next) {
  const client = await pool.connect();
  try {
    const values = clientValues(request.body);
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO clients (
         client_code, name, business_address, contact_person,
         contact_number, email, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [...Object.values(values), request.user.id]
    );
    await writeAudit(client, request, "CLIENT_CREATED", "client", result.rows[0].id, { name: values.name });
    await client.query("COMMIT");
    response.status(201).json({ client: mapClient(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function updateClient(request, response, next) {
  const client = await pool.connect();
  try {
    const clientId = validate.id(request.params.id, "Client ID");
    const values = clientValues(request.body);
    const isActive = validate.boolean(request.body.isActive, "Active status");
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE clients SET client_code = $1, name = $2, business_address = $3,
         contact_person = $4, contact_number = $5, email = $6, is_active = $7
       WHERE id = $8 AND deleted_at IS NULL RETURNING *`,
      [...Object.values(values), isActive, clientId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Client not found.");
    await writeAudit(client, request, "CLIENT_UPDATED", "client", clientId, { name: values.name, isActive });
    await client.query("COMMIT");
    response.json({ client: mapClient(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function deleteClient(request, response, next) {
  const client = await pool.connect();
  try {
    const clientId = validate.id(request.params.id, "Client ID");
    const reason = validate.text(request.body.reason, "Deletion reason", { required: true, max: 500 });
    await client.query("BEGIN");
    const linked = await client.query(
      "SELECT COUNT(*)::INTEGER AS count FROM client_transactions WHERE client_id = $1 AND deleted_at IS NULL",
      [clientId]
    );
    if (linked.rows[0].count > 0) throw new HttpError(409, "Delete the client's active transactions before deleting the client.");
    const result = await client.query(
      `UPDATE clients SET deleted_at = NOW(), deleted_by = $1,
         deletion_reason = $2, is_active = FALSE, restore_allowed = $3
       WHERE id = $4 AND deleted_at IS NULL RETURNING id, name`,
      [request.user.id, reason, request.user.role !== "admin", clientId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Client not found.");
    await writeAudit(client, request, "CLIENT_DELETED", "client", clientId, {
      reason, name: result.rows[0].name, deletionMode: request.user.role === "admin" ? "permanent_hidden" : "restorable"
    });
    await client.query("COMMIT");
    response.json({ message: request.user.role === "admin" ? "Client permanently hidden. Audit history was kept." : "Client moved to deleted records." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function restoreClient(request, response, next) {
  const client = await pool.connect();
  try {
    const clientId = validate.id(request.params.id, "Client ID");
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE clients SET deleted_at = NULL, deleted_by = NULL,
         deletion_reason = NULL, is_active = TRUE, restore_allowed = TRUE
       WHERE id = $1 AND deleted_at IS NOT NULL AND restore_allowed = TRUE RETURNING *`,
      [clientId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Deleted client not found.");
    await writeAudit(client, request, "CLIENT_RESTORED", "client", clientId, { name: result.rows[0].name });
    await client.query("COMMIT");
    response.json({ client: mapClient(result.rows[0]), message: "Client restored." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

function transactionValues(body) {
  const values = {
    transactionDate: validate.date(body.date || body.transactionDate, "Transaction date", { required: true }),
    salesInvoice: validate.text(body.salesInvoice, "Sales invoice number", { max: 80 }),
    purchaseOrder: validate.text(body.purchaseOrder, "Purchase order number", { max: 80 }),
    collectionReceipt: validate.text(body.collectionReceipt, "Collection receipt number", { max: 80 }),
    chequeDate: validate.date(body.chequeDate, "Cheque date"),
    amount: validate.money(body.amount, "Amount")
  };
  if (!values.salesInvoice && !values.purchaseOrder) {
    throw new HttpError(400, "Enter a sales invoice number or purchase order number.");
  }
  return values;
}

async function createTransaction(request, response, next) {
  const client = await pool.connect();
  try {
    const clientId = validate.id(request.body.clientId, "Client ID");
    const values = transactionValues(request.body);
    await client.query("BEGIN");
    const owner = await client.query("SELECT id FROM clients WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL", [clientId]);
    if (!owner.rows[0]) throw new HttpError(404, "Active client not found.");
    const result = await client.query(
      `INSERT INTO client_transactions (
         client_id, transaction_date, sales_invoice_number, purchase_order_number,
         collection_receipt_number, cheque_date, amount, balance, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8) RETURNING *`,
      [clientId, ...Object.values(values), request.user.id]
    );
    await writeAudit(client, request, "CLIENT_TRANSACTION_CREATED", "client_transaction", result.rows[0].id, { clientId, amount: values.amount });
    await client.query("COMMIT");
    response.status(201).json({ transaction: mapTransaction(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function updateTransaction(request, response, next) {
  const client = await pool.connect();
  try {
    const transactionId = validate.id(request.params.id, "Transaction ID");
    const values = transactionValues(request.body);
    await client.query("BEGIN");
    const paidResult = await client.query(
      "SELECT COALESCE(SUM(amount), 0) AS paid FROM client_payments WHERE client_transaction_id = $1",
      [transactionId]
    );
    const paidAmount = Number(paidResult.rows[0].paid);
    if (paidAmount > 0 && Number(values.amount) !== paidAmount) {
      throw new HttpError(409, "A paid transaction amount must remain equal to its completed payment.");
    }
    const result = await client.query(
      `UPDATE client_transactions SET transaction_date = $1,
         sales_invoice_number = $2, purchase_order_number = $3,
         collection_receipt_number = COALESCE($4, collection_receipt_number),
         cheque_date = COALESCE($5, cheque_date), amount = $6, balance = $6 - $7
       WHERE id = $8 AND deleted_at IS NULL RETURNING *`,
      [...Object.values(values), paidAmount, transactionId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Client transaction not found.");
    await writeAudit(client, request, "CLIENT_TRANSACTION_UPDATED", "client_transaction", transactionId, { amount: values.amount });
    await client.query("COMMIT");
    response.json({ transaction: mapTransaction(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function deleteTransaction(request, response, next) {
  const client = await pool.connect();
  try {
    const transactionId = validate.id(request.params.id, "Transaction ID");
    const reason = validate.text(request.body.reason, "Deletion reason", { required: true, max: 500 });
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE client_transactions SET deleted_at = NOW(), deleted_by = $1,
         deletion_reason = $2, restore_allowed = $3
       WHERE id = $4 AND deleted_at IS NULL RETURNING id`,
      [request.user.id, reason, request.user.role !== "admin", transactionId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Client transaction not found.");
    await writeAudit(client, request, "CLIENT_TRANSACTION_DELETED", "client_transaction", transactionId, {
      reason, deletionMode: request.user.role === "admin" ? "permanent_hidden" : "restorable"
    });
    await client.query("COMMIT");
    response.json({ message: request.user.role === "admin" ? "Client transaction permanently hidden. Audit history was kept." : "Client transaction moved to deleted records." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function restoreTransaction(request, response, next) {
  const client = await pool.connect();
  try {
    const transactionId = validate.id(request.params.id, "Transaction ID");
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE client_transactions ct SET deleted_at = NULL, deleted_by = NULL,
         deletion_reason = NULL, restore_allowed = TRUE
       FROM clients c WHERE ct.id = $1 AND ct.client_id = c.id
         AND ct.deleted_at IS NOT NULL AND ct.restore_allowed = TRUE
         AND c.deleted_at IS NULL RETURNING ct.*`,
      [transactionId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Deleted transaction or active client not found.");
    await writeAudit(client, request, "CLIENT_TRANSACTION_RESTORED", "client_transaction", transactionId);
    await client.query("COMMIT");
    response.json({ transaction: mapTransaction(result.rows[0]), message: "Client transaction restored." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function addPayment(request, response, next) {
  const client = await pool.connect();
  try {
    const transactionId = validate.id(request.params.id, "Transaction ID");
    const paymentAmount = validate.money(request.body.amount, "Payment amount");
    const paymentDate = validate.date(request.body.paymentDate, "Payment date", { required: true });
    const collectionReceipt = validate.text(request.body.collectionReceipt, "Collection receipt number", { max: 80 });
    const chequeDate = validate.date(request.body.chequeDate, "Cheque date");
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT ct.* FROM client_transactions ct JOIN clients c ON c.id = ct.client_id
       WHERE ct.id = $1 AND ct.deleted_at IS NULL AND c.deleted_at IS NULL FOR UPDATE OF ct`,
      [transactionId]
    );
    const transaction = locked.rows[0];
    if (!transaction) throw new HttpError(404, "Active client transaction not found.");
    if (Number(paymentAmount) !== Number(transaction.balance)) {
      throw new HttpError(409, `Partial payments are not allowed. Payment must equal the full remaining balance of ${Number(transaction.balance).toFixed(2)}.`);
    }
    const payment = await client.query(
      `INSERT INTO client_payments (
         client_transaction_id, client_id, collection_receipt_number,
         payment_date, cheque_date, amount, recorded_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [transaction.id, transaction.client_id, collectionReceipt, paymentDate, chequeDate, paymentAmount, request.user.id]
    );
    const updated = await client.query(
      `UPDATE client_transactions SET balance = balance - $1,
         payment_date = $2,
         collection_receipt_number = COALESCE($3, collection_receipt_number),
         cheque_date = COALESCE($4, cheque_date)
       WHERE id = $5 RETURNING *`,
      [paymentAmount, paymentDate, collectionReceipt, chequeDate, transaction.id]
    );
    await writeAudit(client, request, "CLIENT_PAYMENT_RECORDED", "client_payment", payment.rows[0].id, {
      transactionId, paymentAmount, newBalance: updated.rows[0].balance, billingStatus: updated.rows[0].billing_status
    });
    await client.query("COMMIT");
    response.status(201).json({ transaction: mapTransaction(updated.rows[0]), payment: payment.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function paymentHistory(request, response, next) {
  try {
    const transactionId = validate.id(request.params.id, "Transaction ID");
    const result = await pool.query(
      `SELECT id, amount, payment_date, collection_receipt_number,
         cheque_date, recorded_by, created_at
       FROM client_payments WHERE client_transaction_id = $1
       ORDER BY payment_date DESC, created_at DESC`,
      [transactionId]
    );
    response.json({ payments: result.rows.map((row) => ({
      id: String(row.id), amount: Number(row.amount), paymentDate: row.payment_date,
      collectionReceipt: row.collection_receipt_number || "—", chequeDate: row.cheque_date || "—",
      recordedBy: row.recorded_by, createdAt: row.created_at
    })) });
  } catch (error) { next(error); }
}

async function listReceivables(request, response, next) {
  try {
    const clientId = request.query.clientId ? validate.id(request.query.clientId, "Client ID") : null;
    const status = validate.text(request.query.status, "Status", { max: 20 });
    if (status && status !== "Not Paid") throw new HttpError(400, "Receivable status must be Not Paid.");
    const result = await pool.query(
      `SELECT * FROM receivable_records
       WHERE ($1::BIGINT IS NULL OR client_id = $1)
         AND ($2::TEXT IS NULL OR billing_status = $2)
       ORDER BY transaction_date DESC, created_at DESC`,
      [clientId, status]
    );
    response.json({
      receivables: result.rows,
      totals: { count: result.rows.length, balance: result.rows.reduce((sum, row) => sum + Number(row.balance), 0) }
    });
  } catch (error) { next(error); }
}

module.exports = {
  addPayment, createClient, createTransaction, deleteClient, deleteTransaction,
  getClient, listClients, listReceivables, paymentHistory, restoreClient,
  restoreTransaction, updateClient, updateTransaction
};
