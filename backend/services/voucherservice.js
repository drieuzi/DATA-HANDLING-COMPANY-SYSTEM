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

const cents = (value) => Math.round(Number(value || 0) * 100);

async function lockSelectedTransactions(client, transactionIds) {
  const result = await client.query(
    `SELECT st.*, s.deleted_at AS supplier_deleted_at
     FROM supplier_transactions st
     JOIN suppliers s ON s.id = st.supplier_id
     WHERE st.id = ANY($1::BIGINT[])
     ORDER BY st.id
     FOR UPDATE OF st`,
    [transactionIds]
  );
  if (result.rows.length !== transactionIds.length
    || result.rows.some((row) => row.deleted_at || row.supplier_deleted_at)) {
    throw new HttpError(404, "One or more selected supplier transactions are no longer active.");
  }
  return result.rows;
}

async function lockVoucherTransactions(client, voucherId, requireActive = true) {
  const result = await client.query(
    `SELECT st.*, vt.amount_applied
     FROM voucher_transactions vt
     JOIN supplier_transactions st ON st.id = vt.supplier_transaction_id
     JOIN suppliers s ON s.id = st.supplier_id
     WHERE vt.voucher_id = $1
       AND ($2::BOOLEAN = FALSE OR (st.deleted_at IS NULL AND s.deleted_at IS NULL))
     ORDER BY st.id FOR UPDATE OF st`,
    [voucherId, requireActive]
  );
  if (!result.rows.length) {
    throw new HttpError(requireActive ? 404 : 409,
      requireActive ? "Active linked supplier transactions were not found."
        : "The voucher's linked supplier transactions no longer exist.");
  }
  return result.rows;
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

  const transactions = await lockVoucherTransactions(client, voucher.id);
  const linkedTotal = transactions.reduce((sum, row) => sum + Number(row.amount_applied), 0);
  if (cents(linkedTotal) !== cents(voucher.payment_amount)) {
    throw new HttpError(409, "The linked transaction total no longer matches the voucher amount.");
  }
  for (const transaction of transactions) {
    if (cents(transaction.amount_applied) !== cents(transaction.balance)) {
      throw new HttpError(409, `Transaction ${transaction.id} must be paid in full. Its current balance is ${Number(transaction.balance).toFixed(2)}.`);
    }
  }

  await client.query(
    `UPDATE vouchers SET payment_status = 'Issued', issued_by = $1,
       issued_at = NOW(), cancelled_at = NULL
     WHERE id = $2`,
    [request.user.id, voucher.id]
  );
  for (const transaction of transactions) {
    await client.query(
      `INSERT INTO payments (
         voucher_id, supplier_transaction_id, supplier_id, amount,
         payment_date, recorded_by
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [voucher.id, transaction.id, transaction.supplier_id,
        transaction.amount_applied, voucher.payment_date, request.user.id]
    );
    await client.query(
      `UPDATE supplier_transactions SET balance = balance - $1,
         voucher_date = $2, payment_date = $3, cheque_date = $4
       WHERE id = $5`,
      [transaction.amount_applied, voucher.voucher_date,
        voucher.payment_date, voucher.cheque_date, transaction.id]
    );
  }
  await writeAudit(client, request, "VOUCHER_ISSUED", "voucher", voucher.id, {
    voucherNumber: voucher.voucher_number,
    transactionIds: transactions.map((row) => String(row.id)),
    transactionCount: transactions.length,
    paymentAmount: voucher.payment_amount,
    billingStatus: "Paid"
  });
  return transactions;
}

async function reverseIssuedVoucher(client, request, voucher, reason) {
  // A voucher is part of the permanent payment history. Its payment must still
  // be reversible after the related supplier or transaction has been soft
  // deleted. Creating, issuing, and editing continue to use lockTransaction(),
  // which intentionally requires an active supplier and transaction.
  const transactions = await lockVoucherTransactions(client, voucher.id, false);
  const paymentResult = await client.query(
    `SELECT * FROM payments
     WHERE voucher_id = $1 AND reversed_at IS NULL
     ORDER BY supplier_transaction_id
     FOR UPDATE`,
    [voucher.id]
  );
  if (!paymentResult.rows.length) throw new HttpError(409, "The issued voucher payment history could not be found.");
  const knownIds = new Set(transactions.map((row) => String(row.id)));
  for (const payment of paymentResult.rows) {
    if (!knownIds.has(String(payment.supplier_transaction_id))) {
      throw new HttpError(409, "A linked supplier transaction no longer exists.");
    }
    await client.query(
      `UPDATE payments SET reversed_at = NOW(), reversed_by = $1,
         reversal_reason = $2 WHERE id = $3`,
      [request.user.id, reason, payment.id]
    );
    await client.query(
      `UPDATE supplier_transactions SET
         balance = LEAST(amount, balance + $1),
         voucher_date = NULL, payment_date = NULL, cheque_date = NULL
       WHERE id = $2`,
      [payment.amount, payment.supplier_transaction_id]
    );
  }
  return paymentResult.rows;
}

async function createVoucherWithPayment(request, values) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const transactions = await lockSelectedTransactions(client, values.supplierTransactionIds);
    if (transactions.some((transaction) => Number(transaction.supplier_id) !== Number(values.supplierId))) {
      throw new HttpError(400, "Every selected transaction must belong to the selected supplier.");
    }
    if (transactions.some((transaction) => Number(transaction.balance) <= 0)) {
      throw new HttpError(409, "Only unpaid supplier transactions can be included in a voucher.");
    }
    const paymentAmount = transactions.reduce((sum, transaction) => sum + Number(transaction.balance), 0);
    if (cents(values.paymentAmount) !== cents(paymentAmount)) {
      throw new HttpError(409, `The selected full balances total ${paymentAmount.toFixed(2)}. Refresh the form and try again.`);
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
        voucherNumber, transactions[0].id, values.supplierId,
        values.voucherDate, values.chequeDate, values.chequeNumber,
        values.paymentDate, paymentAmount, values.withholdingTaxRate,
        values.bankName, values.particulars, values.attachmentName, request.user.id
      ]
    );
    const voucher = result.rows[0];
    for (const transaction of transactions) {
      await client.query(
        `INSERT INTO voucher_transactions (
           voucher_id, supplier_transaction_id, supplier_id, amount_applied
         ) VALUES ($1, $2, $3, $4)`,
        [voucher.id, transaction.id, transaction.supplier_id, transaction.balance]
      );
    }
    await writeAudit(client, request, "VOUCHER_CREATED", "voucher", voucher.id, {
      voucherNumber: voucher.voucher_number,
      transactionIds: transactions.map((transaction) => String(transaction.id)),
      transactionCount: transactions.length,
      paymentAmount,
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
    if (voucher.payment_status === "Deleted") {
      throw new HttpError(409, "Deleted vouchers cannot be edited.");
    }

    if (voucher.payment_status === "Issued" && values.paymentStatus !== "Issued") {
      await reverseIssuedVoucher(
        client,
        request,
        voucher,
        `Voucher status changed from Issued to ${values.paymentStatus}`
      );
    }

    const storedStatus = values.paymentStatus === "Issued" && voucher.payment_status !== "Issued"
      ? "Draft"
      : values.paymentStatus;

    const updated = await client.query(
      `UPDATE vouchers SET voucher_date = $1,
         payment_date = $2,
         cheque_date = $3,
         payment_status = $4::VARCHAR,
         issued_by = CASE WHEN $4::VARCHAR = 'Draft' THEN NULL ELSE issued_by END,
         issued_at = CASE WHEN $4::VARCHAR = 'Draft' THEN NULL ELSE issued_at END,
         cancelled_at = CASE WHEN $4::VARCHAR = 'Cancelled' THEN NOW() ELSE NULL END,
         updated_at = NOW()
       WHERE id = $5 AND deleted_at IS NULL RETURNING *`,
      [values.voucherDate, values.paymentDate, values.chequeDate, storedStatus, voucher.id]
    );

    if (!updated.rows[0]) throw new HttpError(404, "Voucher not found.");

    if (voucher.payment_status === "Issued" && values.paymentStatus !== "Issued") {
      await client.query(
        `UPDATE payments SET payment_date = $1 WHERE voucher_id = $2`,
        [values.paymentDate, voucher.id]
      );
    }

    if (values.paymentStatus === "Issued" && voucher.payment_status !== "Issued") {
      await issueLockedVoucher(client, request, updated.rows[0]);
    } else if (values.paymentStatus === "Issued") {
      const paymentResult = await client.query(
        `UPDATE payments SET payment_date = $1
         WHERE voucher_id = $2 AND reversed_at IS NULL
         RETURNING id`,
        [values.paymentDate, voucher.id]
      );
      if (!paymentResult.rows[0]) {
        throw new HttpError(409, "The issued voucher payment history could not be found.");
      }
      await client.query(
        `UPDATE supplier_transactions
         SET voucher_date = $1, payment_date = $2, cheque_date = $3
         WHERE id IN (
           SELECT supplier_transaction_id FROM voucher_transactions
           WHERE voucher_id = $4
         )`,
        [values.voucherDate, values.paymentDate, values.chequeDate,
          voucher.id]
      );
    }
    await writeAudit(client, request, "VOUCHER_UPDATED", "voucher", voucher.id, {
      voucherNumber: voucher.voucher_number,
      previousVoucherDate: voucher.voucher_date,
      voucherDate: values.voucherDate,
      previousPaymentDate: voucher.payment_date,
      paymentDate: values.paymentDate,
      previousChequeDate: voucher.cheque_date,
      chequeDate: values.chequeDate,
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

async function cancelVoucherPayment(request, voucherId, reason) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const voucher = await lockVoucher(client, voucherId);
    if (voucher.payment_status === "Cancelled") throw new HttpError(409, "Voucher is already cancelled.");

    if (voucher.payment_status === "Issued") {
      await reverseIssuedVoucher(client, request, voucher, reason);
    }

    await client.query(
      `UPDATE vouchers SET payment_status = 'Cancelled', cancelled_at = NOW()
       WHERE id = $1`,
      [voucher.id]
    );
    await writeAudit(client, request, "VOUCHER_CANCELLED", "voucher", voucher.id, {
      voucherNumber: voucher.voucher_number,
      previousStatus: voucher.payment_status,
      reason
    });
    await client.query("COMMIT");
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
         deleted_with_transaction = FALSE,
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

async function permanentlyDeleteVoucher(request, voucherId, reason) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id, voucher_number, supplier_transaction_id, supplier_id,
         attachment_name
       FROM vouchers
       WHERE id = $1 AND payment_status = 'Deleted'
         AND deleted_at IS NOT NULL AND restore_allowed = TRUE
       FOR UPDATE`,
      [voucherId]
    );
    const voucher = result.rows[0];
    if (!voucher) {
      throw new HttpError(404, "Restorable deleted voucher not found.");
    }

    const links = await client.query(
      "SELECT supplier_transaction_id FROM voucher_transactions WHERE voucher_id = $1 ORDER BY supplier_transaction_id",
      [voucherId]
    );

    const payments = await client.query(
      "SELECT id, reversed_at FROM payments WHERE voucher_id = $1 FOR UPDATE",
      [voucherId]
    );
    if (payments.rows.some((payment) => !payment.reversed_at)) {
      throw new HttpError(409, "The voucher still has an active payment and cannot be permanently deleted.");
    }
    const paymentIds = payments.rows.map((payment) => payment.id);
    await client.query(
      `DELETE FROM audit_logs
       WHERE (entity_type = 'voucher' AND entity_id = $1)
          OR (entity_type = 'payment' AND entity_id = ANY($2::BIGINT[]))`,
      [voucherId, paymentIds]
    );
    await client.query("DELETE FROM payments WHERE voucher_id = $1", [voucherId]);
    await client.query("DELETE FROM vouchers WHERE id = $1", [voucherId]);

    await writeAudit(client, request, "PERMANENT_PURGE", "voucher", voucher.id, {
      voucherNumber: voucher.voucher_number,
      transactionIds: links.rows.map((row) => String(row.supplier_transaction_id)),
      supplierId: String(voucher.supplier_id),
      reason,
      status: "Unrestorable",
      deletedPaymentCount: payments.rowCount,
      deletedAttachmentCount: voucher.attachment_name ? 1 : 0,
      financialEffectRemoved: true
    });
    await client.query("COMMIT");
    return voucher;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

module.exports = {
  cancelVoucherPayment,
  createVoucherWithPayment,
  deleteVoucherForHistory,
  issueVoucherPayment,
  permanentlyDeleteVoucher,
  reverseIssuedVoucher,
  updateVoucherDetails
};
