require("dotenv").config();

const pool = require("../config/db");

const REQUIRED_TABLES = [
  "users",
  "clients",
  "client_transactions",
  "client_payments",
  "suppliers",
  "supplier_transactions",
  "vouchers",
  "payments",
  "audit_logs",
  "system_counters"
];

async function verifyDatabase() {
  const tableResult = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::TEXT[])
     ORDER BY table_name`,
    [REQUIRED_TABLES]
  );

  const foundTables = tableResult.rows.map((row) => row.table_name);
  const missingTables = REQUIRED_TABLES.filter((table) => !foundTables.includes(table));

  const viewResult = await pool.query(
    `SELECT table_name
     FROM information_schema.views
     WHERE table_schema = 'public'
       AND table_name IN ('payable_records', 'receivable_records')`
  );

  const generatedStatusResult = await pool.query(
    `SELECT table_name, is_generated
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('supplier_transactions', 'client_transactions')
       AND column_name = 'billing_status'`
  );

  const voucherAccountingResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vouchers'
       AND column_name IN ('withholding_tax_rate', 'withholding_tax_amount', 'net_cheque_amount', 'bank_name')`
  );

  const voucherCounterResult = await pool.query(
    `SELECT current_value FROM system_counters WHERE counter_name = 'voucher_number'`
  );

  if (missingTables.length > 0) {
    throw new Error(`Missing required tables: ${missingTables.join(", ")}`);
  }
  const views = viewResult.rows.map((row) => row.table_name);
  if (!views.includes("payable_records") || !views.includes("receivable_records")) {
    throw new Error("Missing required Payables or Receivables view");
  }
  if (generatedStatusResult.rows.length !== 2
    || generatedStatusResult.rows.some((row) => row.is_generated !== "ALWAYS")) {
    throw new Error("Supplier or client billing_status is not generated automatically");
  }
  if (voucherAccountingResult.rows.length !== 4) {
    throw new Error("Voucher withholding-tax or bank fields are missing");
  }
  if (!voucherCounterResult.rows[0]) {
    throw new Error("Voucher number series is not initialized");
  }

  console.log("Database verification passed.");
  console.log(`Tables: ${foundTables.join(", ")}`);
  console.log("Views: payable_records, receivable_records");
  console.log("Generated fields: supplier_transactions.billing_status, client_transactions.billing_status");
  console.log("Voucher accounting fields: 1% withholding tax, net cheque amount, and bank name");
  console.log(`Next voucher number: ${String(Number(voucherCounterResult.rows[0].current_value) + 1).padStart(6, "0")}`);
}

verifyDatabase()
  .catch((error) => {
    console.error("Database verification failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
