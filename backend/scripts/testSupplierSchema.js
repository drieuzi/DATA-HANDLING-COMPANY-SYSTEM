require("dotenv").config();

const assert = require("node:assert/strict");
const pool = require("../config/db");

async function expectDatabaseError(client, savepoint, expectedCode, operation) {
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await operation();
    throw new Error(`Expected PostgreSQL error ${expectedCode}, but the query succeeded.`);
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    if (error.code !== expectedCode) throw error;
  }
}

async function runTest() {
  const client = await pool.connect();
  const suffix = Date.now();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (username, full_name, password_hash, role)
       VALUES ($1, 'Schema Test Admin', 'not-a-login-password-hash', 'admin')
       RETURNING id`,
      [`schema_test_${suffix}`]
    );
    const userId = userResult.rows[0].id;

    const supplierResult = await client.query(
      `INSERT INTO suppliers (supplier_code, name, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [`TEST-${suffix}`, `Schema Test Supplier ${suffix}`, userId]
    );
    const supplierId = supplierResult.rows[0].id;

    const transactionResult = await client.query(
      `INSERT INTO supplier_transactions (
         supplier_id, purchase_order_number, amount, balance, created_by
       ) VALUES ($1, $2, 10000.00, 10000.00, $3)
       RETURNING id, amount, balance, billing_status`,
      [supplierId, `PO-TEST-${suffix}`, userId]
    );
    const transactionId = transactionResult.rows[0].id;
    assert.equal(transactionResult.rows[0].billing_status, "Not Paid");

    const initialPayable = await client.query(
      "SELECT balance FROM payable_records WHERE transaction_id = $1",
      [transactionId]
    );
    assert.equal(initialPayable.rows[0].balance, "10000.00");

    const firstVoucher = await client.query(
      `INSERT INTO vouchers (
         voucher_number, supplier_transaction_id, supplier_id, voucher_date,
         payment_date, payment_amount, payment_status, created_by, issued_by, issued_at
       ) VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE, 4000.00,
         'Issued', $4, $4, NOW())
       RETURNING id`,
      [`TEST-V-${suffix}-1`, transactionId, supplierId, userId]
    );

    await client.query(
      `INSERT INTO payments (
         voucher_id, supplier_transaction_id, supplier_id, amount,
         payment_date, recorded_by
       ) VALUES ($1, $2, $3, 4000.00, CURRENT_DATE, $4)`,
      [firstVoucher.rows[0].id, transactionId, supplierId, userId]
    );

    const partialResult = await client.query(
      `UPDATE supplier_transactions
       SET balance = balance - 4000.00, payment_date = CURRENT_DATE
       WHERE id = $1
       RETURNING balance, billing_status`,
      [transactionId]
    );
    assert.equal(partialResult.rows[0].balance, "6000.00");
    assert.equal(partialResult.rows[0].billing_status, "Partially Paid");

    await expectDatabaseError(client, "overpayment_test", "23514", () =>
      client.query(
        "UPDATE supplier_transactions SET balance = balance - 7000.00 WHERE id = $1",
        [transactionId]
      )
    );

    await expectDatabaseError(client, "duplicate_voucher_test", "23505", () =>
      client.query(
        `INSERT INTO vouchers (
           voucher_number, supplier_transaction_id, supplier_id, voucher_date,
           payment_amount, payment_status, created_by
         ) VALUES ($1, $2, $3, CURRENT_DATE, 1000.00, 'Draft', $4)`,
        [`test-v-${suffix}-1`, transactionId, supplierId, userId]
      )
    );

    const secondVoucher = await client.query(
      `INSERT INTO vouchers (
         voucher_number, supplier_transaction_id, supplier_id, voucher_date,
         payment_date, payment_amount, payment_status, created_by, issued_by, issued_at
       ) VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE, 6000.00,
         'Issued', $4, $4, NOW())
       RETURNING id`,
      [`TEST-V-${suffix}-2`, transactionId, supplierId, userId]
    );

    await client.query(
      `INSERT INTO payments (
         voucher_id, supplier_transaction_id, supplier_id, amount,
         payment_date, recorded_by
       ) VALUES ($1, $2, $3, 6000.00, CURRENT_DATE, $4)`,
      [secondVoucher.rows[0].id, transactionId, supplierId, userId]
    );

    const paidResult = await client.query(
      `UPDATE supplier_transactions
       SET balance = balance - 6000.00, payment_date = CURRENT_DATE
       WHERE id = $1
       RETURNING balance, billing_status`,
      [transactionId]
    );
    assert.equal(paidResult.rows[0].balance, "0.00");
    assert.equal(paidResult.rows[0].billing_status, "Paid");

    const finalPayable = await client.query(
      "SELECT COUNT(*)::INTEGER AS count FROM payable_records WHERE transaction_id = $1",
      [transactionId]
    );
    assert.equal(finalPayable.rows[0].count, 0);

    const paymentHistory = await client.query(
      `SELECT amount FROM payments
       WHERE supplier_transaction_id = $1
       ORDER BY created_at, id`,
      [transactionId]
    );
    assert.deepEqual(paymentHistory.rows.map((row) => row.amount), ["4000.00", "6000.00"]);

    await client.query(
      `UPDATE payments SET reversed_at = NOW(), reversed_by = $1,
         reversal_reason = 'Automated cancellation test'
       WHERE voucher_id = $2`,
      [userId, secondVoucher.rows[0].id]
    );
    await client.query(
      `UPDATE vouchers SET payment_status = 'Cancelled', cancelled_at = NOW()
       WHERE id = $1`,
      [secondVoucher.rows[0].id]
    );
    const reversedResult = await client.query(
      `UPDATE supplier_transactions SET balance = LEAST(amount, balance + 6000.00)
       WHERE id = $1 RETURNING balance, billing_status`,
      [transactionId]
    );
    assert.equal(reversedResult.rows[0].balance, "6000.00");
    assert.equal(reversedResult.rows[0].billing_status, "Partially Paid");

    const voucherCounts = await client.query(
      `SELECT COUNT(*)::INTEGER AS total,
         COUNT(*) FILTER (WHERE payment_status = 'Cancelled')::INTEGER AS cancelled
       FROM vouchers WHERE supplier_id = $1 AND deleted_at IS NULL`,
      [supplierId]
    );
    assert.equal(voucherCounts.rows[0].total, 2);
    assert.equal(voucherCounts.rows[0].cancelled, 1);

    await client.query("ROLLBACK");
    console.log("Supplier schema test passed; all temporary test data was rolled back.");
    console.log("Verified: Not Paid -> Partially Paid -> Paid.");
    console.log("Verified: Payables view, payment history, overpayment rejection, and duplicate voucher rejection.");
    console.log("Verified: Voucher cancellation restores the balance while remaining in the voucher count.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

runTest()
  .catch((error) => {
    console.error("Supplier schema test failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
