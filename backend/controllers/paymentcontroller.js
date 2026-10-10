const pool = require("../config/db");
const { writeAudit } = require("../services/auditservice");
const {
  createVoucherWithPayment,
  deleteVoucherForHistory,
  issueVoucherPayment,
  permanentlyDeleteVoucher: permanentlyDeleteVoucherRecord,
  updateVoucherDetails
} = require("../services/voucherservice");
const HttpError = require("../utils/httpError");
const validate = require("../utils/validation");

function mapVoucher(row) {
  const transactions = (Array.isArray(row.linked_transactions) ? row.linked_transactions : [])
    .map((transaction) => ({
      id: String(transaction.id),
      purchaseOrder: transaction.purchaseOrder || "—",
      salesInvoice: transaction.salesInvoice || "—",
      amountApplied: Number(transaction.amountApplied || 0)
    }));
  const firstTransaction = transactions[0] || {};
  return {
    id: String(row.id), voucherNumber: row.voucher_number,
    transactionId: String(firstTransaction.id || row.supplier_transaction_id),
    transactionIds: transactions.length ? transactions.map((transaction) => transaction.id) : [String(row.supplier_transaction_id)],
    transactions,
    supplierId: String(row.supplier_id), supplierName: row.supplier_name,
    purchaseOrder: transactions.length ? transactions.map((transaction) => transaction.purchaseOrder).join(", ") : (row.purchase_order_number || "—"),
    salesInvoice: transactions.length ? transactions.map((transaction) => transaction.salesInvoice).join(", ") : (row.sales_invoice_number || "—"),
    voucherDate: row.voucher_date,
    chequeDate: row.cheque_date || "—", chequeNumber: row.cheque_number || "—",
    paymentDate: row.payment_date || "—", amountApplied: Number(row.payment_amount || 0),
    withholdingTaxRate: Number(row.withholding_tax_rate || 0),
    withholdingTaxAmount: Number(row.withholding_tax_amount || 0),
    netChequeAmount: Number(row.net_cheque_amount ?? row.payment_amount ?? 0),
    bankName: row.bank_name || "",
    status: row.payment_status || "Draft", particulars: row.particulars || "",
    attachmentName: row.attachment_name || "", deletedAt: row.deleted_at,
    deletionReason: row.deletion_reason, restoreAllowed: row.restore_allowed !== false,
    permanentlyDeletedAt: row.permanently_deleted_at,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

const voucherSelect = `SELECT v.*, s.name AS supplier_name,
  links.linked_transactions
 FROM vouchers v
 JOIN suppliers s ON s.id = v.supplier_id
 LEFT JOIN LATERAL (
   SELECT json_agg(json_build_object(
     'id', st.id,
     'purchaseOrder', COALESCE(st.purchase_order_number, '—'),
     'salesInvoice', COALESCE(st.sales_invoice_number, '—'),
     'amountApplied', vt.amount_applied
   ) ORDER BY st.created_at, st.id) AS linked_transactions
   FROM voucher_transactions vt
   JOIN supplier_transactions st ON st.id = vt.supplier_transaction_id
   WHERE vt.voucher_id = v.id
 ) links ON TRUE`;

async function listPayables(request, response, next) {
  try {
    const supplierId = request.query.supplierId ? validate.id(request.query.supplierId, "Supplier ID") : null;
    const status = validate.text(request.query.status, "Status", { max: 20 });
    const from = validate.date(request.query.from, "From date");
    const to = validate.date(request.query.to, "To date");
    if (status && status !== "Not Paid") {
      throw new HttpError(400, "Payable status must be Not Paid.");
    }
    const result = await pool.query(
      `SELECT * FROM payable_records
       WHERE ($1::BIGINT IS NULL OR supplier_id = $1)
         AND ($2::TEXT IS NULL OR billing_status = $2)
         AND ($3::DATE IS NULL OR created_at::DATE >= $3)
         AND ($4::DATE IS NULL OR created_at::DATE <= $4)
       ORDER BY created_at DESC`,
      [supplierId, status, from, to]
    );
    const total = result.rows.reduce((sum, row) => sum + Number(row.balance), 0);
    response.json({ payables: result.rows, totals: { count: result.rows.length, balance: total } });
  } catch (error) { next(error); }
}

async function listVouchers(request, response, next) {
  try {
    const includeDeleted = request.user.role === "admin" && request.query.includeDeleted === "true";
    const result = await pool.query(
      `${voucherSelect}
       WHERE v.deleted_at IS NULL OR ($1::BOOLEAN AND v.restore_allowed = TRUE)
       ORDER BY v.created_at DESC, v.id DESC`,
      [includeDeleted]
    );
    response.json({ vouchers: result.rows.map(mapVoucher) });
  } catch (error) { next(error); }
}

async function previewNextVoucherNumber(_request, response, next) {
  try {
    const result = await pool.query(
      `SELECT current_value + 1 AS next_value
       FROM system_counters
       WHERE counter_name = 'voucher_number'`
    );
    if (!result.rows[0]) {
      throw new HttpError(500, "Voucher number series is not initialized. Run the database initializer.");
    }
    response.json({
      voucherNumber: String(result.rows[0].next_value).padStart(6, "0")
    });
  } catch (error) { next(error); }
}

async function getVoucher(request, response, next) {
  try {
    const voucherId = validate.id(request.params.id, "Voucher ID");
    const result = await pool.query(
      `${voucherSelect}
       WHERE v.id = $1 AND (v.deleted_at IS NULL OR ($2 = 'admin' AND v.restore_allowed = TRUE))`,
      [voucherId, request.user.role]
    );
    if (!result.rows[0]) throw new HttpError(404, "Voucher not found.");
    response.json({ voucher: mapVoucher(result.rows[0]) });
  } catch (error) { next(error); }
}

function voucherValues(body, { allowCancelled = false } = {}) {
  const paymentStatus = validate.text(body.status || body.paymentStatus || "Draft", "Voucher status", { required: true, max: 20 });
  const allowedStatuses = allowCancelled ? ["Draft", "Issued", "Cancelled"] : ["Draft", "Issued"];
  if (!allowedStatuses.includes(paymentStatus)) {
    throw new HttpError(400, `Voucher status must be ${allowedStatuses.join(", ")}.`);
  }
  const rawIds = Array.isArray(body.transactionIds || body.supplierTransactionIds)
    ? (body.transactionIds || body.supplierTransactionIds)
    : [body.transactionId || body.supplierTransactionId];
  const supplierTransactionIds = [...new Set(rawIds.map((id) => validate.id(id, "Supplier transaction ID")))];
  if (!supplierTransactionIds.length) throw new HttpError(400, "Select at least one supplier transaction.");
  return {
    supplierTransactionIds,
    supplierId: validate.id(body.supplierId, "Supplier ID"),
    voucherDate: validate.date(body.voucherDate, "Voucher date", { required: true }),
    chequeDate: validate.date(body.chequeDate, "Cheque date"),
    chequeNumber: validate.text(body.chequeNumber, "Cheque number", { max: 80 }),
    paymentDate: validate.date(body.paymentDate, "Payment date", { required: paymentStatus === "Issued" }),
    paymentAmount: validate.money(body.amountApplied || body.paymentAmount, "Payment amount"),
    withholdingTaxRate: body.applyWithholdingTax === true ? "0.0100" : "0",
    bankName: validate.text(body.bankName, "Bank used", { required: true, max: 120 }).toUpperCase(),
    paymentStatus,
    particulars: validate.text(body.particulars, "Particulars", { max: 2000 }),
    attachmentName: validate.text(body.attachmentName, "Attachment name", { max: 255 })
  };
}

function voucherEditValues(body) {
  const paymentStatus = validate.text(
    body.status || body.paymentStatus,
    "Voucher status",
    { required: true, max: 20 }
  );
  const allowedStatuses = ["Draft", "Issued", "Cancelled"];
  if (!allowedStatuses.includes(paymentStatus)) {
    throw new HttpError(400, `Voucher status must be ${allowedStatuses.join(", ")}.`);
  }
  return {
    voucherDate: validate.date(body.voucherDate, "Voucher date", { required: true }),
    paymentDate: validate.date(body.paymentDate, "Payment date", { required: true }),
    chequeDate: validate.date(body.chequeDate, "Cheque date", { required: true }),
    paymentStatus
  };
}

async function createVoucher(request, response, next) {
  try {
    const voucherId = await createVoucherWithPayment(request, voucherValues(request.body));
    const result = await pool.query(
      `${voucherSelect} WHERE v.id = $1`,
      [voucherId]
    );
    response.status(201).json({ voucher: mapVoucher(result.rows[0]) });
  } catch (error) { next(error); }
}

async function issueVoucher(request, response, next) {
  try {
    const voucherId = validate.id(request.params.id, "Voucher ID");
    await issueVoucherPayment(request, voucherId);
    response.json({ message: "Voucher issued and payment applied." });
  } catch (error) { next(error); }
}

async function updateVoucher(request, response, next) {
  try {
    const voucherId = validate.id(request.params.id, "Voucher ID");
    await updateVoucherDetails(request, voucherId, voucherEditValues(request.body));
    const result = await pool.query(
      `${voucherSelect} WHERE v.id = $1`,
      [voucherId]
    );
    response.json({ voucher: mapVoucher(result.rows[0]) });
  } catch (error) { next(error); }
}

async function deleteVoucher(request, response, next) {
  try {
    const voucherId = validate.id(request.params.id, "Voucher ID");
    const reason = validate.text(request.body.reason, "Deletion reason", { required: true, max: 500 });
    await deleteVoucherForHistory(request, voucherId, reason);
    response.json({ message: "Voucher moved to Admin Monitoring deleted records." });
  } catch (error) { next(error); }
}

async function permanentlyDeleteVoucher(request, response, next) {
  try {
    const voucherId = validate.id(request.params.id, "Voucher ID");
    const confirmation = validate.text(request.body.confirmation, "Confirmation", { required: true, max: 20 });
    const reason = validate.text(request.body.reason, "Permanent deletion reason", { required: true, max: 500 });
    if (confirmation !== "DELETE") {
      throw new HttpError(400, 'Type "DELETE" exactly to confirm permanent deletion.');
    }
    await permanentlyDeleteVoucherRecord(request, voucherId, reason);
    response.json({ message: "Voucher and its reversed payment record were permanently deleted." });
  } catch (error) { next(error); }
}

async function restoreVoucher(request, response, next) {
  const client = await pool.connect();
  try {
    const voucherId = validate.id(request.params.id, "Voucher ID");
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE vouchers v SET payment_status = 'Draft',
         deleted_at = NULL, deleted_by = NULL,
         deletion_reason = NULL, restore_allowed = TRUE,
         deleted_with_transaction = FALSE,
         issued_by = NULL, issued_at = NULL, cancelled_at = NULL,
         permanently_deleted_by = NULL, permanently_deleted_at = NULL
       FROM suppliers s
       WHERE v.id = $1 AND v.payment_status = 'Deleted'
         AND v.deleted_at IS NOT NULL AND v.restore_allowed = TRUE
         AND v.supplier_id = s.id AND s.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM voucher_transactions vt
           JOIN supplier_transactions st ON st.id = vt.supplier_transaction_id
           WHERE vt.voucher_id = v.id AND st.deleted_at IS NOT NULL
         )
       RETURNING v.id, v.voucher_number`,
      [voucherId]
    );
    if (!result.rows[0]) {
      const blocked = await client.query(
        `SELECT v.id, s.deleted_at AS supplier_deleted_at,
           EXISTS (
             SELECT 1 FROM voucher_transactions vt
             JOIN supplier_transactions st ON st.id = vt.supplier_transaction_id
             WHERE vt.voucher_id = v.id AND st.deleted_at IS NOT NULL
           ) AS has_deleted_transaction
         FROM vouchers v
         JOIN suppliers s ON s.id = v.supplier_id
         WHERE v.id = $1 AND v.payment_status = 'Deleted'
           AND v.deleted_at IS NOT NULL AND v.restore_allowed = TRUE`,
        [voucherId]
      );
      if (blocked.rows[0]?.supplier_deleted_at || blocked.rows[0]?.has_deleted_transaction) {
        throw new HttpError(409, "Restore the linked supplier and every linked transaction first. The voucher can then be restored as Draft.");
      }
      throw new HttpError(404, "Restorable deleted voucher not found.");
    }
    await writeAudit(client, request, "VOUCHER_RESTORED", "voucher", voucherId, {
      voucherNumber: result.rows[0].voucher_number,
      restoredAs: "Draft",
      restoredBy: request.user.fullName || request.user.username,
      actionPerformed: "Deleted voucher restored as Draft without reapplying payment"
    });
    await client.query("COMMIT");
    response.json({ message: "Voucher restored." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
}

async function paymentHistory(request, response, next) {
  try {
    const transactionId = validate.id(request.params.id, "Transaction ID");
    const result = await pool.query(
      `SELECT p.id, p.voucher_id, v.voucher_number, p.amount, p.payment_date,
         p.recorded_by, p.created_at, p.reversed_at, p.reversal_reason
       FROM payments p JOIN vouchers v ON v.id = p.voucher_id
       WHERE p.supplier_transaction_id = $1
       ORDER BY p.created_at DESC`,
      [transactionId]
    );
    response.json({ payments: result.rows.map((row) => ({
      id: String(row.id), voucherId: String(row.voucher_id), voucherNumber: row.voucher_number,
      amount: Number(row.amount), paymentDate: row.payment_date, recordedBy: row.recorded_by,
      createdAt: row.created_at, reversedAt: row.reversed_at, reversalReason: row.reversal_reason
    })) });
  } catch (error) { next(error); }
}

module.exports = {
  createVoucher, deleteVoucher, getVoucher, issueVoucher,
  listPayables, listVouchers, paymentHistory, previewNextVoucherNumber,
  permanentlyDeleteVoucher, restoreVoucher, updateVoucher
};
