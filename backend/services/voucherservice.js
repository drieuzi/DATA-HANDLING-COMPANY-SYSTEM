const pool = require("../config/db");
const { writeAudit } = require("./auditservice");
const HttpError = require("../utils/httpError");

async function lockVoucher(client, voucherId) {
  const result = await client.query(
    `SELECT * FROM vouchers WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
    [voucherId]
  );
  if (!result.rows[0]) throw new HttpError(404, "Voucher not found.");
  return result.rows[0];
}

async function lockTransaction(client, transactionId) {
  const result = await client.query(
    `SELECT st.*, s.deleted_at AS supplier_deleted_at
     FROM supplier_transactions st
     JOIN suppliers s ON s.id = st.supplier_id
     WHERE st.id = $1 AND st.deleted_at IS NULL
     FOR UPDATE OF st`,
    [transactionId]
  );
  if (!result.rows[0] || result.rows[0].supplier_deleted_at) {
    throw new HttpError(404, "Active supplier transaction not found.");
  }
  return result.rows[0];
}

async function reserveVoucherNumber(client) {
  const result = await client.query(
    `UPDATE system_counters
     SET current_value = current_value + 1, updated_at = NOW()
     WHERE counter_name = 'voucher_number'
     RETURNING current_value`
  );
  if (!result.rows[0]) {
    throw new HttpError(500, "Voucher number series is not initialized. Run the database initializer.");
  }
  return String(result.rows[0].current_value).padStart(6, "0");
}

async function issueLockedVoucher(client, request, voucher) {
  if (voucher.payment_status !== "Draft") {
    throw new HttpError(409, "Only a Draft voucher can be issued.");
  }
  if (!voucher.payment_date) {
    throw new HttpError(400, "Payment date is required before issuing a voucher.");
  }

  const transaction = await lockTransaction(client, voucher.supplier_transaction_id);
  const paymentAmount = Number(voucher.payment_amount);
  const balance = Number(transaction.balance);
  if (paymentAmount <= 0) throw new HttpError(400, "Payment must be greater than zero.");
  if (paymentAmount !== balance) {
    throw new HttpError(409, `Partial payments are not allowed. Payment must equal the full remaining balance of ${balance.toFixed(2)}.`);
  }

  await client.query(
    `UPDATE vouchers SET payment_status = 'Issued', issued_by = $1,
       issued_at = NOW(), cancelled_at = NULL
     WHERE id = $2`,
    [request.user.id, voucher.id]
  );
  await client.query(
    `INSERT INTO payments (
       voucher_id, supplier_transaction_id, supplier_id, amount,
       payment_date, recorded_by
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [voucher.id, transaction.id, transaction.supplier_id, voucher.payment_amount, voucher.payment_date, request.user.id]
  );
  const updated = await client.query(
    `UPDATE supplier_transactions SET
       balance = balance - $1,
       voucher_date = $2,
       payment_date = $3,
       cheque_date = $4
     WHERE id = $5
     RETURNING id, amount, balance, billing_status`,
    [voucher.payment_amount, voucher.voucher_date, voucher.payment_date, voucher.cheque_date, transaction.id]
  );
  await writeAudit(client, request, "VOUCHER_ISSUED", "voucher", voucher.id, {
    voucherNumber: voucher.voucher_number,
    transactionId: transaction.id,
    paymentAmount: voucher.payment_amount,
    newBalance: updated.rows[0].balance,
    billingStatus: updated.rows[0].billing_status
  });
  return updated.rows[0];
}

async function reverseIssuedVoucher(client, request, voucher, reason) {
  const transaction = await lockTransaction(client, voucher.supplier_transaction_id);
  const paymentResult = await client.query(
    `SELECT * FROM payments
     WHERE voucher_id = $1 AND reversed_at IS NULL
     FOR UPDATE`,
    [voucher.id]
  );
  const payment = paymentResult.rows[0];
  if (!payment) throw new HttpError(409, "The issued voucher payment history could not be found.");

  await client.query(
    `UPDATE payments SET reversed_at = NOW(), reversed_by = $1,
       reversal_reason = $2 WHERE id = $3`,
    [request.user.id, reason, payment.id]
  );
  const restored = await client.query(
    `UPDATE supplier_transactions SET
       balance = LEAST(amount, balance + $1),
       voucher_date = (
         SELECT v.voucher_date FROM vouchers v
         WHERE v.supplier_transaction_id = $2 AND v.id <> $3
           AND v.payment_status = 'Issued' AND v.deleted_at IS NULL
         ORDER BY v.issued_at DESC LIMIT 1
       ),
       payment_date = (
         SELECT p.payment_date FROM payments p
         JOIN vouchers v ON v.id = p.voucher_id
         WHERE p.supplier_transaction_id = $2 AND p.reversed_at IS NULL
           AND v.id <> $3 AND v.payment_status = 'Issued' AND v.deleted_at IS NULL
         ORDER BY p.created_at DESC LIMIT 1
       ),
       cheque_date = (
         SELECT v.cheque_date FROM vouchers v
         WHERE v.supplier_transaction_id = $2 AND v.id <> $3
           AND v.payment_status = 'Issued' AND v.deleted_at IS NULL
         ORDER BY v.issued_at DESC LIMIT 1
       )
     WHERE id = $2
     RETURNING balance`,
    [payment.amount, transaction.id, voucher.id]
  );
  return Number(restored.rows[0].balance);
}

async function createVoucherWithPayment(request, values) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const transaction = await lockTransaction(client, values.supplierTransactionId);
    if (Number(transaction.supplier_id) !== Number(values.supplierId)) {
      throw new HttpError(400, "The selected supplier does not own that transaction.");
    }
    if (Number(values.paymentAmount) !== Number(transaction.balance)) {
      throw new HttpError(409, `Partial payments are not allowed. Payment must equal the full remaining balance of ${Number(transaction.balance).toFixed(2)}.`);
    }
    const voucherNumber = await reserveVoucherNumber(client);
    const result = await client.query(
      `INSERT INTO vouchers (
         voucher_number, supplier_transaction_id, supplier_id, voucher_date,
         cheque_date, cheque_number, payment_date, payment_amount,
         withholding_tax_rate, bank_name,
         payment_status, particulars, attachment_name, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Draft', $11, $12, $13)
       RETURNING *`,
      [
        voucherNumber, values.supplierTransactionId, values.supplierId,
        values.voucherDate, values.chequeDate, values.chequeNumber,
        values.paymentDate, values.paymentAmount, values.withholdingTaxRate,
        values.bankName, values.particulars, values.attachmentName, request.user.id
      ]
    );
    const voucher = result.rows[0];
    await writeAudit(client, request, "VOUCHER_CREATED", "voucher", voucher.id, {
      voucherNumber: voucher.voucher_number,
      transactionId: voucher.supplier_transaction_id,
      paymentAmount: voucher.payment_amount,
      withholdingTaxAmount: voucher.withholding_tax_amount,
      bankName: voucher.bank_name
    });
    if (values.paymentStatus === "Issued") {
      await issueLockedVoucher(client, request, voucher);
    }
    await client.query("COMMIT");
    return voucher.id;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function issueVoucherPayment(request, voucherId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const voucher = await lockVoucher(client, voucherId);
    await issueLockedVoucher(client, request, voucher);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function updateVoucherDetails(request, voucherId, values) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const voucher = await lockVoucher(client, voucherId);
    if (request.user.role === "admin"
      && values.paymentStatus === "Cancelled"
      && voucher.payment_status !== "Cancelled") {
      throw new HttpError(403, "Admin accounts do not have permission to cancel vouchers.");
    }
    if (Number(voucher.supplier_id) !== Number(values.supplierId)
      || Number(voucher.supplier_transaction_id) !== Number(values.supplierTransactionId)) {
      throw new HttpError(409, "The linked supplier and transaction cannot be changed after the voucher is created.");
    }

    const transaction = await lockTransaction(client, voucher.supplier_transaction_id);
    let availableAmount = Number(transaction.balance);
    if (voucher.payment_status === "Issued" && values.paymentStatus === "Issued") {
      const paymentResult = await client.query(
        `SELECT * FROM payments WHERE voucher_id = $1 AND reversed_at IS NULL FOR UPDATE`,
        [voucher.id]
      );
      const payment = paymentResult.rows[0];
      if (!payment) throw new HttpError(409, "The issued voucher payment history could not be found.");
      availableAmount = Number(transaction.balance) + Number(payment.amount);
      if (Number(values.paymentAmount) !== availableAmount) {
        throw new HttpError(409, `Partial payments are not allowed. Payment must equal the full transaction amount of ${availableAmount.toFixed(2)}.`);
      }
      await client.query(
        `UPDATE payments SET amount = $1, payment_date = $2 WHERE id = $3`,
        [values.paymentAmount, values.paymentDate, payment.id]
      );
      await client.query(
        `UPDATE supplier_transactions SET balance = $1, voucher_date = $2,
           payment_date = $3, cheque_date = $4 WHERE id = $5`,
        [availableAmount - Number(values.paymentAmount), values.voucherDate,
          values.paymentDate, values.chequeDate, transaction.id]
      );
    } else if (voucher.payment_status === "Issued") {
      availableAmount = await reverseIssuedVoucher(
        client,
        request,
        voucher,
        `Voucher status changed from Issued to ${values.paymentStatus}`
      );
    }

    if (values.paymentStatus !== "Cancelled" && Number(values.paymentAmount) !== availableAmount) {
      throw new HttpError(409, `Partial payments are not allowed. Payment must equal the full transaction amount of ${availableAmount.toFixed(2)}.`);
    }

    const storedStatus = values.paymentStatus === "Issued" && voucher.payment_status !== "Issued"
      ? "Draft"
      : values.paymentStatus;

    const updated = await client.query(
      `UPDATE vouchers SET voucher_date = $1,
         cheque_date = $2, cheque_number = $3, payment_date = $4,
         payment_amount = $5, withholding_tax_rate = $6, bank_name = $7,
         particulars = $8,
         payment_status = $9,
         issued_by = CASE WHEN $9 = 'Draft' THEN NULL ELSE issued_by END,
         issued_at = CASE WHEN $9 = 'Draft' THEN NULL ELSE issued_at END,
         cancelled_at = CASE WHEN $9 = 'Cancelled' THEN NOW() ELSE NULL END,
         updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [values.voucherDate, values.chequeDate, values.chequeNumber,
        values.paymentDate, values.paymentAmount, values.withholdingTaxRate,
        values.bankName, values.particulars, storedStatus, voucher.id]
    );

    if (values.paymentStatus === "Issued" && voucher.payment_status !== "Issued") {
      await issueLockedVoucher(client, request, updated.rows[0]);
    }
    await writeAudit(client, request, "VOUCHER_UPDATED", "voucher", voucher.id, {
      voucherNumber: voucher.voucher_number,
      paymentAmount: values.paymentAmount,
      withholdingTaxRate: values.withholdingTaxRate,
      bankName: values.bankName,
      previousStatus: voucher.payment_status,
      status: values.paymentStatus
    });
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function deleteVoucherForHistory(request, voucherId, reason) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const voucher = await lockVoucher(client, voucherId);
    const allowedStatuses = request.user.role === "admin"
      ? ["Draft", "Issued"]
      : ["Draft", "Issued", "Cancelled"];

    if (!allowedStatuses.includes(voucher.payment_status)) {
      throw new HttpError(
        409,
        request.user.role === "admin"
          ? "Only Draft or Issued vouchers can be deleted from the active records."
          : "This voucher cannot be deleted."
      );
    }

    if (voucher.payment_status === "Issued") {
      await reverseIssuedVoucher(client, request, voucher, reason);
    }

    const result = await client.query(
      `UPDATE vouchers SET payment_status = 'Deleted', deleted_at = NOW(),
         deleted_by = $1, deletion_reason = $2, restore_allowed = TRUE,
         permanently_deleted_by = NULL, permanently_deleted_at = NULL,
         updated_at = NOW()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING id, voucher_number, deleted_at`,
      [request.user.id, reason, voucher.id]
    );
    const deletedVoucher = result.rows[0];
    await writeAudit(client, request, "VOUCHER_DELETED", "voucher", voucher.id, {
      voucherNumber: voucher.voucher_number,
      previousStatus: voucher.payment_status,
      status: "Deleted",
      deletionMode: "restorable",
      reason,
      deletedBy: request.user.fullName || request.user.username,
      deletedAt: deletedVoucher.deleted_at,
      actionPerformed: "Voucher moved from active records to historical deleted records"
    });
    await client.query("COMMIT");
    return deletedVoucher;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function permanentlyDeleteVoucher(request, voucherId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE vouchers SET restore_allowed = FALSE,
         permanently_deleted_by = $1, permanently_deleted_at = NOW(),
         updated_at = NOW()
       WHERE id = $2 AND payment_status = 'Deleted'
         AND deleted_at IS NOT NULL AND restore_allowed = TRUE
       RETURNING id, voucher_number, permanently_deleted_at`,
      [request.user.id, voucherId]
    );
    const voucher = result.rows[0];
    if (!voucher) {
      throw new HttpError(404, "Restorable deleted voucher not found.");
    }
    await writeAudit(client, request, "VOUCHER_PERMANENTLY_DELETED", "voucher", voucher.id, {
      voucherNumber: voucher.voucher_number,
      deletionMode: "unrestorable",
      permanentlyDeletedBy: request.user.fullName || request.user.username,
      permanentlyDeletedAt: voucher.permanently_deleted_at,
      actionPerformed: "Restore permission permanently removed"
    });
    await client.query("COMMIT");
    return voucher;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

module.exports = {
  createVoucherWithPayment,
  deleteVoucherForHistory,
  issueVoucherPayment,
  permanentlyDeleteVoucher,
  updateVoucherDetails
};
