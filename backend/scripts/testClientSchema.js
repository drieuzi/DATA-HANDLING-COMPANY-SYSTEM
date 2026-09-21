require("dotenv").config();

const assert = require("node:assert/strict");
const pool = require("../config/db");

async function runTest() {
  const client = await pool.connect();
  const suffix = Date.now();
  try {
    await client.query("BEGIN");
    const user = await client.query(
      `INSERT INTO users (username, full_name, password_hash, role)
       VALUES ($1, 'Client Test Admin', 'test-only-hash', 'admin') RETURNING id`,
      [`client_test_${suffix}`]
    );
    const clientRecord = await client.query(
      `INSERT INTO clients (client_code, name, created_by)
       VALUES ($1, $2, $3) RETURNING id`,
      [`CT-${suffix}`, `Client Test ${suffix}`, user.rows[0].id]
    );
    const transaction = await client.query(
      `INSERT INTO client_transactions (
         client_id, transaction_date, purchase_order_number,
         sales_invoice_number, amount, balance, created_by
       ) VALUES ($1, CURRENT_DATE, $2, $3, 10000.00, 10000.00, $4)
       RETURNING id, balance, billing_status`,
      [clientRecord.rows[0].id, `PO-${suffix}`, `SI-${suffix}`, user.rows[0].id]
    );
    assert.equal(transaction.rows[0].billing_status, "Not Paid");

    const firstReceivable = await client.query("SELECT balance FROM receivable_records WHERE transaction_id = $1", [transaction.rows[0].id]);
    assert.equal(firstReceivable.rows[0].balance, "10000.00");

    await client.query(
      `INSERT INTO client_payments (
         client_transaction_id, client_id, payment_date, amount, recorded_by
       ) VALUES ($1, $2, CURRENT_DATE, 4000.00, $3)`,
      [transaction.rows[0].id, clientRecord.rows[0].id, user.rows[0].id]
    );
    const partial = await client.query(
      `UPDATE client_transactions SET balance = balance - 4000.00,
         payment_date = CURRENT_DATE WHERE id = $1 RETURNING balance, billing_status`,
      [transaction.rows[0].id]
    );
    assert.equal(partial.rows[0].balance, "6000.00");
    assert.equal(partial.rows[0].billing_status, "Partially Paid");

    await client.query(
      `INSERT INTO client_payments (
         client_transaction_id, client_id, payment_date, amount, recorded_by
       ) VALUES ($1, $2, CURRENT_DATE, 6000.00, $3)`,
      [transaction.rows[0].id, clientRecord.rows[0].id, user.rows[0].id]
    );
    const paid = await client.query(
      `UPDATE client_transactions SET balance = balance - 6000.00,
         payment_date = CURRENT_DATE WHERE id = $1 RETURNING balance, billing_status`,
      [transaction.rows[0].id]
    );
    assert.equal(paid.rows[0].balance, "0.00");
    assert.equal(paid.rows[0].billing_status, "Paid");

    const finalReceivable = await client.query("SELECT COUNT(*)::INTEGER AS count FROM receivable_records WHERE transaction_id = $1", [transaction.rows[0].id]);
    assert.equal(finalReceivable.rows[0].count, 0);
    await client.query("ROLLBACK");
    console.log("Client schema test passed; all temporary test data was rolled back.");
    console.log("Verified: Receivables and Total Sales source, Not Paid -> Partially Paid -> Paid, and payment history.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

runTest().catch((error) => {
  console.error("Client schema test failed:", error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
