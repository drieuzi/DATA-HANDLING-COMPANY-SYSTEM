const pool = require("../config/db");
const { writeAudit } = require("../services/auditservice");
const {
  cancelVoucherPayment,
  createVoucherWithPayment,
  issueVoucherPayment,
  updateVoucherDetails
} = require("../services/voucherservice");
const HttpError = require("../utils/httpError");
const validate = require("../utils/validation");

function mapVoucher(row) {
  return {
    id: String(row.id), voucherNumber: row.voucher_number,
    transactionId: String(row.supplier_transaction_id), supplierId: String(row.supplier_id),
    supplierName: row.supplier_name, purchaseOrder: row.purchase_order_number || "—",
    salesInvoice: row.sales_invoice_number || "—", voucherDate: row.voucher_date,
    chequeDate: row.cheque_date || "—", chequeNumber: row.cheque_number || "—",
    paymentDate: row.payment_date || "—", amountApplied: Number(row.payment_amount || 0),
    status: row.payment_status || "Draft", particulars: row.particulars || "",
    attachmentName: row.attachment_name || "", deletedAt: row.deleted_at,
    deletionReason: row.deletion_reason, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

async function listPayables(request, response, next) {
  try {
    const supplierId = request.query.supplierId ? validate.id(request.query.supplierId, "Supplier ID") : null;
    const status = validate.text(request.query.status, "Status", { max: 20 });
    const from = validate.date(request.query.from, "From date");
    const to = validate.date(request.query.to, "To date");
    if (status && !["Not Paid", "Partially Paid"].includes(status)) {
      throw new HttpError(400, "Payable status must be Not Paid or Partially Paid.");
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
      `SELECT v.*, s.name AS supplier_name, st.purchase_order_number,
         st.sales_invoice_number
       FROM vouchers v
       JOIN suppliers s ON s.id = v.supplier_id
       JOIN supplier_transactions st ON st.id = v.supplier_transaction_id
       WHERE ($1::BOOLEAN OR v.deleted_at IS NULL)
       ORDER BY v.created_at DESC, v.id DESC`,
      [includeDeleted]
    );
    response.json({ vouchers: result.rows.map(mapVoucher) });
  } catch (error) { next(error); }
}

async function getVoucher(request, response, next) {
  try {
    const voucherId = validate.id(request.params.id, "Voucher ID");
    const result = await pool.query(
      `SELECT v.*, s.name AS supplier_name, st.purchase_order_number,
         st.sales_invoice_number
       FROM vouchers v
       JOIN suppliers s ON s.id = v.supplier_id
       JOIN supplier_transactions st ON st.id = v.supplier_transaction_id
       WHERE v.id = $1 AND (v.deleted_at IS NULL OR $2 = 'admin')`,
      [voucherId, request.user.role]
    );
    if (!result.rows[0]) throw new HttpError(404, "Voucher not found.");
    response.json({ voucher: mapVoucher(result.rows[0]) });
  } catch (error) { next(error); }
}

function voucherValues(body) {
  const paymentStatus = validate.text(body.status || body.paymentStatus || "Draft", "Voucher status", { required: true, max: 20 });
  if (!["Draft", "Issued"].includes(paymentStatus)) throw new HttpError(400, "Voucher status must be Draft or Issued.");
  return {
    voucherNumber: validate.text(body.voucherNumber, "Voucher number", { required: true, max: 80 }),
    supplierTransactionId: validate.id(body.transactionId || body.supplierTransactionId, "Supplier transaction ID"),
    supplierId: validate.id(body.supplierId, "Supplier ID"),
    voucherDate: validate.date(body.voucherDate, "Voucher date", { required: true }),
    chequeDate: validate.date(body.chequeDate, "Cheque date"),
    chequeNumber: validate.text(body.chequeNumber, "Cheque number", { max: 80 }),
    paymentDate: validate.date(body.paymentDate, "Payment date", { required: paymentStatus === "Issued" }),
    paymentAmount: validate.money(body.amountApplied || body.paymentAmount, "Payment amount"),
    paymentStatus,
    particulars: validate.text(body.particulars, "Particulars", { max: 2000 }),
    attachmentName: validate.text(body.attachmentName, "Attachment name", { max: 255 })
  };
}

async function createVoucher(request, response, next) {
  try {
    const voucherId = await createVoucherWithPayment(request, voucherValues(request.body));
    const result = await pool.query(
      `SELECT v.*, s.name AS supplier_name, st.purchase_order_number,
         st.sales_invoice_number
       FROM vouchers v JOIN suppliers s ON s.id = v.supplier_id
       JOIN supplier_transactions st ON st.id = v.supplier_transaction_id
       WHERE v.id = $1`,
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
    await updateVoucherDetails(request, voucherId, voucherValues(request.body));
    const result = await pool.query(
      `SELECT v.*, s.name AS supplier_name, st.purchase_order_number,
         st.sales_invoice_number
       FROM vouchers v JOIN suppliers s ON s.id = v.supplier_id
       JOIN supplier_transactions st ON st.id = v.supplier_transaction_id
       WHERE v.id = $1`,
      [voucherId]
    );
    response.json({ voucher: mapVoucher(result.rows[0]) });
  } catch (error) { next(error); }
}

async function cancelVoucher(request, response, next) {
  try {
    const voucherId = validate.id(request.params.id, "Voucher ID");
    const reason = validate.text(request.body.reason, "Cancellation reason", { required: true, max: 500 });
    await cancelVoucherPayment(request, voucherId, reason);
    response.json({ message: "Voucher cancelled. Any issued payment was reversed." });
  } catch (error) { next(error); }
}

async function deleteVoucher(request, response, next) {
  let client;
  try {
    const voucherId = validate.id(request.params.id, "Voucher ID");
    const reason = validate.text(request.body.reason, "Deletion reason", { required: true, max: 500 });
    const statusResult = await pool.query(
      "SELECT payment_status FROM vouchers WHERE id = $1 AND deleted_at IS NULL",
      [voucherId]
    );
    if (!statusResult.rows[0]) throw new HttpError(404, "Voucher not found.");
    if (statusResult.rows[0].payment_status === "Issued") {
      await cancelVoucherPayment(request, voucherId, reason);
    }
    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE vouchers SET deleted_at = NOW(), deleted_by = $1, deletion_reason = $2
       WHERE id = $3 AND deleted_at IS NULL AND payment_status <> 'Issued'
       RETURNING id, voucher_number, payment_status`,
      [request.user.id, reason, voucherId]
    );
    if (!result.rows[0]) throw new HttpError(409, "Voucher not found, already deleted, or still Issued. Cancel it first.");
    await writeAudit(client, request, "VOUCHER_DELETED", "voucher", voucherId, { reason, voucherNumber: result.rows[0].voucher_number, status: result.rows[0].payment_status });
    await client.query("COMMIT");
    response.json({ message: "Voucher moved to deleted records." });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { if (client) client.release(); }
}

async function restoreVoucher(request, response, next) {
  const client = await pool.connect();
  try {
    const voucherId = validate.id(request.params.id, "Voucher ID");
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE vouchers v SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL
       FROM supplier_transactions st, suppliers s
       WHERE v.id = $1 AND v.deleted_at IS NOT NULL
         AND v.supplier_transaction_id = st.id AND st.deleted_at IS NULL
         AND v.supplier_id = s.id AND s.deleted_at IS NULL
       RETURNING v.id`,
      [voucherId]
    );
    if (!result.rows[0]) throw new HttpError(404, "Deleted voucher or its active transaction was not found.");
    await writeAudit(client, request, "VOUCHER_RESTORED", "voucher", voucherId);
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
  cancelVoucher, createVoucher, deleteVoucher, getVoucher, issueVoucher,
  listPayables, listVouchers, paymentHistory, restoreVoucher, updateVoucher
};
