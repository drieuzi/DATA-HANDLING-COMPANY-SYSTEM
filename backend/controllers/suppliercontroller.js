const pool = require("../config/db");
const { writeAudit } = require("../services/auditservice");
const HttpError = require("../utils/httpError");
const validate = require("../utils/validation");

function mapTransaction(row) {
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    voucherDate: row.voucher_date || "—",
    paymentDate: row.payment_date || "—",
    salesInvoice: row.sales_invoice_number || "—",
    purchaseOrder: row.purchase_order_number || "—",
    collectionReceipt: row.collection_receipt_number || "—",
    chequeDate: row.cheque_date || "—",
    amount: Number(row.amount),
    balance: Number(row.balance),
    billingStatus: row.billing_status,
    voucherNumber: row.voucher_number || "—",
    voucherStatus: row.voucher_status || null,
    deletedAt: row.deleted_at,
    deletionReason: row.deletion_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function companyStatus(transactions) {
  if (!transactions.length) return "Not Paid";
  if (transactions.every((item) => item.billingStatus === "Paid")) return "Paid";
  if (transactions.some((item) => item.billingStatus !== "Not Paid")) return "Partially Paid";
  return "Not Paid";
}

function mapSupplier(row, transactions = []) {
  const activeTransactions = transactions.filter((transaction) => !transaction.deletedAt);
  return {
    id: String(row.id),
    supplierCode: row.supplier_code || "",
    name: row.name,
    businessAddress: row.business_address || "",
    contactPerson: row.contact_person || "",
    contactNumber: row.contact_number || "",
    email: row.email || "",
    isActive: row.is_active,
    deletedAt: row.deleted_at,
    deletionReason: row.deletion_reason,
    billingStatus: companyStatus(activeTransactions),
    transactions,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadSuppliers(includeDeleted = false) {
  const suppliersResult = await pool.query(
    `SELECT * FROM suppliers
     WHERE ($1::BOOLEAN OR deleted_at IS NULL)
     ORDER BY deleted_at NULLS FIRST, is_active DESC, name`,
    [includeDeleted]
  );
  const transactionsResult = await pool.query(
    `SELECT st.*,
       latest_voucher.voucher_number,
       latest_voucher.payment_status AS voucher_status
     FROM supplier_transactions st
     LEFT JOIN LATERAL (
       SELECT voucher_number, payment_status
       FROM vouchers
       WHERE supplier_transaction_id = st.id AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) latest_voucher ON TRUE
     WHERE ($1::BOOLEAN OR st.deleted_at IS NULL)
     ORDER BY st.created_at DESC, st.id DESC`,
    [includeDeleted]
  );
  const grouped = new Map();
  transactionsResult.rows.forEach((row) => {
    const key = String(row.supplier_id);
    grouped.set(key, [...(grouped.get(key) || []), mapTransaction(row)]);
  });
  return suppliersResult.rows.map((row) => mapSupplier(row, grouped.get(String(row.id)) || []));
}

async function listSuppliers(request, response, next) {
  try {
    const includeDeleted = request.user.role === "admin" && request.query.includeDeleted === "true";
    response.json({ suppliers: await loadSuppliers(includeDeleted) });
  } catch (error) { next(error); }
}

async function getSupplier(request, response, next) {
  try {
    const supplierId = validate.id(request.params.id, "Supplier ID");
    const suppliers = await loadSuppliers(request.user.role === "admin");
    const supplier = suppliers.find((item) => Number(item.id) === supplierId);
    if (!supplier) throw new HttpError(404, "Supplier not found.");
    response.json({ supplier });
  } catch (error) { next(error); }
}

async function createSupplier(request, response, next) {
  const client = await pool.connect();
  try {
    const values = {
      supplierCode: validate.text(request.body.supplierCode, "Supplier code", { max: 40 }),
      name: validate.text(request.body.name, "Supplier name", { required: true, max: 160 }),
      businessAddress: validate.text(request.body.businessAddress, "Business address", { max: 1000 }),
      contactPerson: validate.text(request.body.contactPerson, "Contact person", { max: 120 }),
      contactNumber: validate.text(request.body.contactNumber, "Contact number", { max: 40 }),
      email: validate.text(request.body.email, "Email", { max: 160 })
    };
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO suppliers (
         supplier_code, name, business_address, contact_person,
         contact_number, email, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [...Object.values(values), request.user.id]
    );
    await writeAudit(client, request, "SUPPLIER_CREATED", "supplier", result.rows[0].id, { name: values.name });
    await client.query("COMMIT");
    response.status(201).json({ supplier: mapSupplier(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function updateSupplier(request, response, next) {
  const client = await pool.connect();
  try {
    const supplierId = validate.id(request.params.id, "Supplier ID");
    const values = {
      supplierCode: validate.text(request.body.supplierCode, "Supplier code", { max: 40 }),
      name: validate.text(request.body.name, "Supplier name", { required: true, max: 160 }),
      businessAddress: validate.text(request.body.businessAddress, "Business address", { max: 1000 }),
      contactPerson: validate.text(request.body.contactPerson, "Contact person", { max: 120 }),
      contactNumber: validate.text(request.body.contactNumber, "Contact number", { max: 40 }),
      email: validate.text(request.body.email, "Email", { max: 160 }),
      isActive: validate.boolean(request.body.isActive, "Active status")
    };
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE suppliers SET
         supplier_code = $1, name = $2, business_address = $3,
         contact_person = $4, contact_number = $5, email = $6, is_active = $7
       WHERE id = $8 AND deleted_at IS NULL
       RETURNING *`,
      [...Object.values(values), supplierId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Supplier not found.");
    await writeAudit(client, request, "SUPPLIER_UPDATED", "supplier", supplierId, { name: values.name, isActive: values.isActive });
    await client.query("COMMIT");
    response.json({ supplier: mapSupplier(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function deleteSupplier(request, response, next) {
  const client = await pool.connect();
  try {
    const supplierId = validate.id(request.params.id, "Supplier ID");
    const reason = validate.text(request.body.reason, "Deletion reason", { required: true, max: 500 });
    await client.query("BEGIN");
    const linked = await client.query(
      `SELECT COUNT(*)::INTEGER AS count FROM supplier_transactions
       WHERE supplier_id = $1 AND deleted_at IS NULL`,
      [supplierId]
    );
    if (linked.rows[0].count > 0) {
      throw new HttpError(409, "Delete or archive the supplier's transactions before deleting the supplier.");
    }
    const result = await client.query(
      `UPDATE suppliers SET deleted_at = NOW(), deleted_by = $1,
         deletion_reason = $2, is_active = FALSE
       WHERE id = $3 AND deleted_at IS NULL RETURNING id, name`,
      [request.user.id, reason, supplierId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Supplier not found.");
    await writeAudit(client, request, "SUPPLIER_DELETED", "supplier", supplierId, { reason, name: result.rows[0].name });
    await client.query("COMMIT");
    response.json({ message: "Supplier moved to deleted records." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function restoreSupplier(request, response, next) {
  const client = await pool.connect();
  try {
    const supplierId = validate.id(request.params.id, "Supplier ID");
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE suppliers SET deleted_at = NULL, deleted_by = NULL,
         deletion_reason = NULL, is_active = TRUE
       WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
      [supplierId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Deleted supplier not found.");
    await writeAudit(client, request, "SUPPLIER_RESTORED", "supplier", supplierId, { name: result.rows[0].name });
    await client.query("COMMIT");
    response.json({ supplier: mapSupplier(result.rows[0]), message: "Supplier restored." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

function transactionValues(body) {
  const values = {
    voucherDate: validate.date(body.voucherDate, "Voucher date"),
    paymentDate: validate.date(body.paymentDate, "Payment date"),
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
    const supplierId = validate.id(request.body.supplierId, "Supplier ID");
    const values = transactionValues(request.body);
    await client.query("BEGIN");
    const supplier = await client.query(
      "SELECT id FROM suppliers WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL",
      [supplierId]
    );
    if (!supplier.rows[0]) throw new HttpError(404, "Active supplier not found.");
    const result = await client.query(
      `INSERT INTO supplier_transactions (
         supplier_id, voucher_date, payment_date, sales_invoice_number,
         purchase_order_number, collection_receipt_number, cheque_date,
         amount, balance, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)
       RETURNING *`,
      [supplierId, ...Object.values(values), request.user.id]
    );
    await writeAudit(client, request, "SUPPLIER_TRANSACTION_CREATED", "supplier_transaction", result.rows[0].id, { supplierId, amount: values.amount });
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
      `SELECT COALESCE(SUM(amount) FILTER (WHERE reversed_at IS NULL), 0) AS paid
       FROM payments WHERE supplier_transaction_id = $1`,
      [transactionId]
    );
    const paidAmount = Number(paidResult.rows[0].paid);
    if (Number(values.amount) < paidAmount) {
      throw new HttpError(409, "The amount cannot be lower than payments already applied to this transaction.");
    }
    const result = await client.query(
      `UPDATE supplier_transactions SET
         voucher_date = $1, payment_date = $2, sales_invoice_number = $3,
         purchase_order_number = $4, collection_receipt_number = $5,
         cheque_date = $6, amount = $7, balance = $7 - $8
       WHERE id = $9 AND deleted_at IS NULL
       RETURNING *`,
      [...Object.values(values), paidAmount, transactionId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Transaction not found.");
    await writeAudit(client, request, "SUPPLIER_TRANSACTION_UPDATED", "supplier_transaction", transactionId, { amount: values.amount });
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
    const linked = await client.query(
      `SELECT COUNT(*)::INTEGER AS count FROM vouchers
       WHERE supplier_transaction_id = $1 AND deleted_at IS NULL`,
      [transactionId]
    );
    if (linked.rows[0].count > 0) {
      throw new HttpError(409, "Cancel and delete every linked voucher before deleting this transaction.");
    }
    const result = await client.query(
      `UPDATE supplier_transactions SET deleted_at = NOW(), deleted_by = $1,
         deletion_reason = $2
       WHERE id = $3 AND deleted_at IS NULL RETURNING id`,
      [request.user.id, reason, transactionId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Transaction not found.");
    await writeAudit(client, request, "SUPPLIER_TRANSACTION_DELETED", "supplier_transaction", transactionId, { reason });
    await client.query("COMMIT");
    response.json({ message: "Transaction moved to deleted records." });
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
      `UPDATE supplier_transactions st SET deleted_at = NULL, deleted_by = NULL,
         deletion_reason = NULL
       FROM suppliers s
       WHERE st.id = $1 AND st.supplier_id = s.id
         AND st.deleted_at IS NOT NULL AND s.deleted_at IS NULL
       RETURNING st.*`,
      [transactionId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Deleted transaction or active supplier not found.");
    await writeAudit(client, request, "SUPPLIER_TRANSACTION_RESTORED", "supplier_transaction", transactionId);
    await client.query("COMMIT");
    response.json({ transaction: mapTransaction(result.rows[0]), message: "Transaction restored." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function listTransactions(request, response, next) {
  try {
    const supplierId = request.query.supplierId ? validate.id(request.query.supplierId, "Supplier ID") : null;
    const includeDeleted = request.user.role === "admin" && request.query.includeDeleted === "true";
    const result = await pool.query(
      `SELECT st.*, s.name AS supplier_name
       FROM supplier_transactions st JOIN suppliers s ON s.id = st.supplier_id
       WHERE ($1::BIGINT IS NULL OR st.supplier_id = $1)
         AND ($2::BOOLEAN OR st.deleted_at IS NULL)
       ORDER BY st.created_at DESC`,
      [supplierId, includeDeleted]
    );
    response.json({ transactions: result.rows.map((row) => ({ ...mapTransaction(row), supplierName: row.supplier_name })) });
  } catch (error) { next(error); }
}

async function getTransaction(request, response, next) {
  try {
    const transactionId = validate.id(request.params.id, "Transaction ID");
    const result = await pool.query(
      `SELECT st.*, s.name AS supplier_name
       FROM supplier_transactions st JOIN suppliers s ON s.id = st.supplier_id
       WHERE st.id = $1 AND (st.deleted_at IS NULL OR $2 = 'admin')`,
      [transactionId, request.user.role]
    );
    if (!result.rows[0]) throw new HttpError(404, "Transaction not found.");
    response.json({ transaction: { ...mapTransaction(result.rows[0]), supplierName: result.rows[0].supplier_name } });
  } catch (error) { next(error); }
}

module.exports = {
  createSupplier, createTransaction, deleteSupplier, deleteTransaction,
  getSupplier, getTransaction, listSuppliers, listTransactions,
  restoreSupplier, restoreTransaction, updateSupplier, updateTransaction
};
