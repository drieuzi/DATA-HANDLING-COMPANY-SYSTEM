const pool = require("../config/db");
const { writeAudit } = require("../services/auditservice");
const { reverseIssuedVoucher } = require("../services/voucherservice");
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
    tinNumber: row.tin_number || "—",
    chequeDate: row.cheque_date || "—",
    amount: Number(row.amount),
    balance: Number(row.balance),
    billingStatus: row.billing_status,
    voucherNumber: row.voucher_number || "—",
    voucherStatus: row.voucher_status || null,
    deletedAt: row.deleted_at,
    deletionReason: row.deletion_reason,
    restoreAllowed: row.restore_allowed !== false,
    deletedWithCompany: row.deleted_with_company === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function companyStatus(transactions) {
  if (!transactions.length) return "Not Paid";
  if (transactions.every((item) => item.billingStatus === "Paid")) return "Paid";
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
    restoreAllowed: row.restore_allowed !== false,
    billingStatus: companyStatus(activeTransactions),
    transactions,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function loadSuppliers(includeDeleted = false) {
  const suppliersResult = await pool.query(
    `SELECT * FROM suppliers
     WHERE deleted_at IS NULL OR ($1::BOOLEAN AND restore_allowed = TRUE)
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
     WHERE st.deleted_at IS NULL OR ($1::BOOLEAN AND st.restore_allowed = TRUE)
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
      businessAddress: validate.text(request.body.businessAddress, "Business address", { required: true, max: 1000 }),
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
      businessAddress: validate.text(request.body.businessAddress, "Business address", { required: true, max: 1000 }),
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
    const result = await client.query(
      `UPDATE suppliers SET deleted_at = NOW(), deleted_by = $1,
         deletion_reason = $2, is_active = FALSE, restore_allowed = TRUE
       WHERE id = $3 AND deleted_at IS NULL RETURNING id, name`,
      [request.user.id, reason, supplierId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Supplier not found.");
    const linkedVouchers = await client.query(
      `SELECT * FROM vouchers
       WHERE supplier_id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [supplierId]
    );
    for (const voucher of linkedVouchers.rows) {
      if (voucher.payment_status === "Issued") {
        await reverseIssuedVoucher(client, request, voucher, `Supplier deleted: ${reason}`);
      }
    }
    const deletedVouchers = await client.query(
      `UPDATE vouchers SET payment_status = 'Deleted', deleted_at = NOW(),
         deleted_by = $1, deletion_reason = $2, restore_allowed = TRUE,
         deleted_with_transaction = TRUE, updated_at = NOW()
       WHERE supplier_id = $3 AND deleted_at IS NULL
       RETURNING id, voucher_number`,
      [request.user.id, `Deleted with supplier: ${reason}`, supplierId]
    );
    for (const voucher of deletedVouchers.rows) {
      await writeAudit(client, request, "VOUCHER_DELETED", "voucher", voucher.id, {
        voucherNumber: voucher.voucher_number,
        deletionMode: "deleted_with_supplier",
        reason
      });
    }
    const linked = await client.query(
      `UPDATE supplier_transactions SET deleted_at = NOW(), deleted_by = $1,
         deletion_reason = $2, restore_allowed = TRUE, deleted_with_company = TRUE
       WHERE supplier_id = $3 AND deleted_at IS NULL RETURNING id`,
      [request.user.id, reason, supplierId]
    );
    await writeAudit(client, request, "SUPPLIER_DELETED", "supplier", supplierId, {
      reason, name: result.rows[0].name, deletionMode: "restorable",
      linkedTransactionsDeleted: linked.rowCount,
      linkedVouchersDeleted: deletedVouchers.rowCount
    });
    await client.query("COMMIT");
    response.json({ message: `Supplier, ${linked.rowCount} transaction(s), and ${deletedVouchers.rowCount} voucher(s) moved to deleted records.` });
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
         deletion_reason = NULL, is_active = TRUE, restore_allowed = TRUE
       WHERE id = $1 AND deleted_at IS NOT NULL AND restore_allowed = TRUE RETURNING *`,
      [supplierId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Deleted supplier not found.");
    const linked = await client.query(
      `UPDATE supplier_transactions SET deleted_at = NULL, deleted_by = NULL,
         deletion_reason = NULL, restore_allowed = TRUE, deleted_with_company = FALSE
       WHERE supplier_id = $1 AND deleted_with_company = TRUE AND restore_allowed = TRUE
       RETURNING id`,
      [supplierId]
    );
    const restoredVouchers = await client.query(
      `UPDATE vouchers SET payment_status = 'Draft', deleted_at = NULL,
         deleted_by = NULL, deletion_reason = NULL, restore_allowed = TRUE,
         deleted_with_transaction = FALSE, issued_by = NULL, issued_at = NULL,
         cancelled_at = NULL, updated_at = NOW()
       WHERE supplier_id = $1 AND deleted_with_transaction = TRUE
         AND deleted_at IS NOT NULL AND restore_allowed = TRUE
       RETURNING id, voucher_number`,
      [supplierId]
    );
    for (const voucher of restoredVouchers.rows) {
      await writeAudit(client, request, "VOUCHER_RESTORED", "voucher", voucher.id, {
        voucherNumber: voucher.voucher_number,
        restoredAs: "Draft",
        restorationMode: "restored_with_supplier"
      });
    }
    await writeAudit(client, request, "SUPPLIER_RESTORED", "supplier", supplierId, {
      name: result.rows[0].name,
      linkedTransactionsRestored: linked.rowCount,
      linkedVouchersRestoredAsDraft: restoredVouchers.rowCount
    });
    await client.query("COMMIT");
    response.json({
      supplier: mapSupplier(result.rows[0]),
      message: `Supplier restored with ${restoredVouchers.rowCount} voucher(s) as Draft.`
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function permanentlyDeleteSupplier(request, response, next) {
  const client = await pool.connect();
  try {
    const supplierId = validate.id(request.params.id, "Supplier ID");
    const confirmation = validate.text(request.body.confirmation, "Confirmation", { required: true, max: 20 });
    const reason = validate.text(request.body.reason, "Permanent deletion reason", { required: true, max: 500 });
    if (confirmation !== "DELETE") {
      throw new HttpError(400, 'Type "DELETE" exactly to confirm permanent deletion.');
    }

    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, name FROM suppliers
       WHERE id = $1 AND deleted_at IS NOT NULL AND restore_allowed = TRUE
       FOR UPDATE`,
      [supplierId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Restorable deleted supplier not found.");

    const transactions = await client.query(
      "SELECT id FROM supplier_transactions WHERE supplier_id = $1 FOR UPDATE",
      [supplierId]
    );
    const vouchers = await client.query(
      `SELECT id, voucher_number, attachment_name
       FROM vouchers WHERE supplier_id = $1 FOR UPDATE`,
      [supplierId]
    );
    const payments = await client.query(
      "SELECT id FROM payments WHERE supplier_id = $1 FOR UPDATE",
      [supplierId]
    );

    const transactionIds = transactions.rows.map((row) => row.id);
    const voucherIds = vouchers.rows.map((row) => row.id);
    const paymentIds = payments.rows.map((row) => row.id);

    await client.query(
      `DELETE FROM audit_logs
       WHERE (entity_type = 'supplier' AND entity_id = $1)
          OR (entity_type = 'supplier_transaction' AND entity_id = ANY($2::BIGINT[]))
          OR (entity_type = 'voucher' AND entity_id = ANY($3::BIGINT[]))
          OR (entity_type = 'payment' AND entity_id = ANY($4::BIGINT[]))`,
      [supplierId, transactionIds, voucherIds, paymentIds]
    );
    await client.query("DELETE FROM payments WHERE supplier_id = $1", [supplierId]);
    await client.query("DELETE FROM vouchers WHERE supplier_id = $1", [supplierId]);
    await client.query("DELETE FROM supplier_transactions WHERE supplier_id = $1", [supplierId]);
    await client.query("DELETE FROM suppliers WHERE id = $1", [supplierId]);

    await writeAudit(client, request, "PERMANENT_PURGE", "supplier", supplierId, {
      companyId: String(supplierId),
      companyName: result.rows[0].name,
      reason,
      status: "Unrestorable",
      transactionIds: transactionIds.map(String),
      voucherNumbers: vouchers.rows.map((row) => row.voucher_number),
      deletedTransactionCount: transactions.rowCount,
      deletedVoucherCount: vouchers.rowCount,
      deletedPaymentCount: payments.rowCount,
      deletedAttachmentCount: vouchers.rows.filter((row) => row.attachment_name).length,
      financialEffectRemoved: true
    });
    await client.query("COMMIT");
    response.json({
      message: "Supplier, linked transactions, vouchers, payments, and attachment records were permanently deleted. A minimal audit entry was kept."
    });
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
    chequeDate: validate.date(body.chequeDate, "Cheque date"),
    amount: validate.money(body.amount, "Amount"),
    tinNumber: validate.text(body.tinNumber, "TIN number", { required: true, max: 40 })
  };
  if (!values.salesInvoice || !values.purchaseOrder) {
    throw new HttpError(400, "Sales invoice number and purchase order number are required.");
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
         purchase_order_number, cheque_date, amount, tin_number, balance, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $9)
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
    if (paidAmount > 0 && Number(values.amount) !== paidAmount) {
      throw new HttpError(409, "A paid transaction amount must remain equal to its completed payment.");
    }
    const result = await client.query(
      `UPDATE supplier_transactions SET
         voucher_date = $1, payment_date = $2, sales_invoice_number = $3,
         purchase_order_number = $4, cheque_date = $5,
         amount = $6, tin_number = $7,
         balance = $6::NUMERIC - $8::NUMERIC
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
    const transactionResult = await client.query(
      `SELECT * FROM supplier_transactions
       WHERE id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [transactionId]
    );
    if (!transactionResult.rows[0]) throw new HttpError(404, "Transaction not found.");

    const linkedVouchers = await client.query(
      `SELECT * FROM vouchers
       WHERE supplier_transaction_id = $1 AND deleted_at IS NULL
       FOR UPDATE`,
      [transactionId]
    );
    for (const voucher of linkedVouchers.rows) {
      if (voucher.payment_status === "Issued") {
        await reverseIssuedVoucher(
          client,
          request,
          voucher,
          `Supplier transaction deleted: ${reason}`
        );
      }
    }
    const deletedVouchers = await client.query(
      `UPDATE vouchers SET payment_status = 'Deleted', deleted_at = NOW(),
         deleted_by = $1, deletion_reason = $2, restore_allowed = TRUE,
         deleted_with_transaction = TRUE, updated_at = NOW()
       WHERE supplier_transaction_id = $3 AND deleted_at IS NULL
       RETURNING id, voucher_number`,
      [request.user.id, `Deleted with supplier transaction: ${reason}`, transactionId]
    );
    for (const voucher of deletedVouchers.rows) {
      await writeAudit(client, request, "VOUCHER_DELETED", "voucher", voucher.id, {
        voucherNumber: voucher.voucher_number,
        transactionId: String(transactionId),
        deletionMode: "deleted_with_transaction",
        reason
      });
    }
    const result = await client.query(
      `UPDATE supplier_transactions SET deleted_at = NOW(), deleted_by = $1,
         deletion_reason = $2, restore_allowed = TRUE, deleted_with_company = FALSE
       WHERE id = $3 AND deleted_at IS NULL RETURNING id`,
      [request.user.id, reason, transactionId]
    );
    await writeAudit(client, request, "SUPPLIER_TRANSACTION_DELETED", "supplier_transaction", transactionId, {
      reason,
      deletionMode: "restorable",
      linkedVouchersDeleted: deletedVouchers.rowCount
    });
    await client.query("COMMIT");
    response.json({ message: `Transaction and ${deletedVouchers.rowCount} linked voucher(s) moved to Admin Monitoring.` });
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
         deletion_reason = NULL, restore_allowed = TRUE, deleted_with_company = FALSE
       FROM suppliers s
       WHERE st.id = $1 AND st.supplier_id = s.id
         AND st.deleted_at IS NOT NULL AND st.restore_allowed = TRUE AND s.deleted_at IS NULL
       RETURNING st.*`,
      [transactionId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Deleted transaction or active supplier not found.");
    const restoredVouchers = await client.query(
      `UPDATE vouchers SET payment_status = 'Draft', deleted_at = NULL,
         deleted_by = NULL, deletion_reason = NULL, restore_allowed = TRUE,
         deleted_with_transaction = FALSE, issued_by = NULL, issued_at = NULL,
         cancelled_at = NULL, updated_at = NOW()
       WHERE supplier_transaction_id = $1 AND deleted_with_transaction = TRUE
         AND deleted_at IS NOT NULL AND restore_allowed = TRUE
       RETURNING id, voucher_number`,
      [transactionId]
    );
    for (const voucher of restoredVouchers.rows) {
      await writeAudit(client, request, "VOUCHER_RESTORED", "voucher", voucher.id, {
        voucherNumber: voucher.voucher_number,
        transactionId: String(transactionId),
        restoredAs: "Draft",
        restorationMode: "restored_with_transaction"
      });
    }
    await writeAudit(client, request, "SUPPLIER_TRANSACTION_RESTORED", "supplier_transaction", transactionId, {
      linkedVouchersRestoredAsDraft: restoredVouchers.rowCount
    });
    await client.query("COMMIT");
    response.json({
      transaction: mapTransaction(result.rows[0]),
      message: `Transaction restored with ${restoredVouchers.rowCount} linked voucher(s) as Draft.`
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function permanentlyDeleteTransaction(request, response, next) {
  const client = await pool.connect();
  try {
    const transactionId = validate.id(request.params.id, "Transaction ID");
    const confirmation = validate.text(request.body.confirmation, "Confirmation", { required: true, max: 20 });
    const reason = validate.text(request.body.reason, "Permanent deletion reason", { required: true, max: 500 });
    if (confirmation !== "DELETE") {
      throw new HttpError(400, 'Type "DELETE" exactly to confirm permanent deletion.');
    }

    await client.query("BEGIN");
    const transactionResult = await client.query(
      `SELECT id, supplier_id, sales_invoice_number, purchase_order_number
       FROM supplier_transactions
       WHERE id = $1 AND deleted_at IS NOT NULL AND restore_allowed = TRUE
       FOR UPDATE`,
      [transactionId]
    );
    const transaction = transactionResult.rows[0];
    if (!transaction) throw new HttpError(404, "Restorable deleted supplier transaction not found.");

    const vouchers = await client.query(
      `SELECT id, voucher_number, attachment_name
       FROM vouchers WHERE supplier_transaction_id = $1 FOR UPDATE`,
      [transactionId]
    );
    const payments = await client.query(
      "SELECT id FROM payments WHERE supplier_transaction_id = $1 FOR UPDATE",
      [transactionId]
    );
    const voucherIds = vouchers.rows.map((row) => row.id);
    const paymentIds = payments.rows.map((row) => row.id);

    await client.query(
      `DELETE FROM audit_logs
       WHERE (entity_type = 'supplier_transaction' AND entity_id = $1)
          OR (entity_type = 'voucher' AND entity_id = ANY($2::BIGINT[]))
          OR (entity_type = 'payment' AND entity_id = ANY($3::BIGINT[]))`,
      [transactionId, voucherIds, paymentIds]
    );
    await client.query("DELETE FROM payments WHERE supplier_transaction_id = $1", [transactionId]);
    await client.query("DELETE FROM vouchers WHERE supplier_transaction_id = $1", [transactionId]);
    await client.query("DELETE FROM supplier_transactions WHERE id = $1", [transactionId]);

    await writeAudit(client, request, "PERMANENT_PURGE", "supplier_transaction", transactionId, {
      transactionId: String(transactionId),
      supplierId: String(transaction.supplier_id),
      salesInvoiceNumber: transaction.sales_invoice_number,
      purchaseOrderNumber: transaction.purchase_order_number,
      voucherNumbers: vouchers.rows.map((row) => row.voucher_number),
      reason,
      status: "Unrestorable",
      deletedVoucherCount: vouchers.rowCount,
      deletedPaymentCount: payments.rowCount,
      deletedAttachmentCount: vouchers.rows.filter((row) => row.attachment_name).length,
      financialEffectRemoved: true
    });
    await client.query("COMMIT");
    response.json({ message: "Supplier transaction and all linked vouchers and payments were permanently deleted." });
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
         AND (st.deleted_at IS NULL OR ($2::BOOLEAN AND st.restore_allowed = TRUE))
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
       WHERE st.id = $1 AND (st.deleted_at IS NULL OR ($2 = 'admin' AND st.restore_allowed = TRUE))`,
      [transactionId, request.user.role]
    );
    if (!result.rows[0]) throw new HttpError(404, "Transaction not found.");
    response.json({ transaction: { ...mapTransaction(result.rows[0]), supplierName: result.rows[0].supplier_name } });
  } catch (error) { next(error); }
}

module.exports = {
  createSupplier, createTransaction, deleteSupplier, deleteTransaction,
  getSupplier, getTransaction, listSuppliers, listTransactions,
  permanentlyDeleteSupplier, permanentlyDeleteTransaction,
  restoreSupplier, restoreTransaction, updateSupplier, updateTransaction
};
