require("dotenv").config();

const pool = require("../config/db");

const REQUIRED_TABLES = [
  "users",
  "user_deletion_requests",
  "clients",
  "client_transactions",
  "client_payments",
  "suppliers",
  "supplier_transactions",
  "vouchers",
  "payments",
  "outside_services",
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
    `SELECT table_name, is_generated, generation_expression
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

  const voucherDeletionResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vouchers'
       AND column_name IN ('restore_allowed', 'permanently_deleted_by', 'permanently_deleted_at')`
  );

  const voucherCascadeResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'vouchers'
       AND column_name = 'deleted_with_transaction'`
  );

  const activePaymentIndexResult = await pool.query(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'payments'
       AND indexname = 'payments_one_active_voucher_unique'
       AND indexdef ILIKE '%WHERE (reversed_at IS NULL)%'`
  );

  const voucherCounterResult = await pool.query(
    `SELECT current_value FROM system_counters WHERE counter_name = 'voucher_number'`
  );

  const deletionPolicyResult = await pool.query(
    `SELECT table_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::TEXT[])
       AND column_name = 'restore_allowed'`,
    [["suppliers", "supplier_transactions", "clients", "client_transactions", "vouchers", "outside_services"]]
  );

  const companyCascadeResult = await pool.query(
    `SELECT table_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('supplier_transactions', 'client_transactions')
       AND column_name = 'deleted_with_company'`
  );

  const transactionTinResult = await pool.query(
    `SELECT table_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('supplier_transactions', 'client_transactions')
       AND column_name = 'tin_number'`
  );

  const clientChequeWorkflowResult = await pool.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (
         (table_name = 'client_transactions' AND column_name = 'collection_date')
         OR
         (table_name = 'client_payments' AND column_name IN (
           'collection_date', 'cheque_date', 'payment_date',
           'deposit_status', 'confirmed_by', 'confirmed_at'
         ))
       )`
  );

  const clientChequeIndexResult = await pool.query(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'client_payments'
       AND indexname IN (
         'client_payments_due_cheque_index',
         'client_payments_one_current_transaction_unique'
       )`
  );

  const supplierAttachmentResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'supplier_transactions'
       AND column_name IN ('attachment_name', 'attachment_mime_type', 'attachment_data')`
  );

  const outsideServiceAttachmentResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'outside_services'
       AND column_name IN (
         'payee', 'receipt_invoice_number', 'tin_number',
         'attachment_path', 'attachment_original_name',
         'attachment_mime_type', 'attachment_size'
       )`
  );

  const accountProtectionResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'
       AND column_name IN (
         'is_primary_admin', 'deleted_by', 'deleted_at',
         'deletion_reason', 'restore_allowed'
       )`
  );

  const primaryAdminResult = await pool.query(
    "SELECT username, full_name FROM users WHERE is_primary_admin = TRUE"
  );

  if (missingTables.length > 0) {
    throw new Error(`Missing required tables: ${missingTables.join(", ")}`);
  }
  const views = viewResult.rows.map((row) => row.table_name);
  if (!views.includes("payable_records") || !views.includes("receivable_records")) {
    throw new Error("Missing required Payables or Receivables view");
  }
  if (generatedStatusResult.rows.length !== 2
    || generatedStatusResult.rows.some((row) => row.is_generated !== "ALWAYS"
      || row.generation_expression.includes("Partially Paid"))) {
    throw new Error("Supplier or client billing_status is not generated automatically");
  }
  if (voucherAccountingResult.rows.length !== 4) {
    throw new Error("Voucher withholding-tax or bank fields are missing");
  }
  if (voucherDeletionResult.rows.length !== 3) {
    throw new Error("Voucher historical or permanent-deletion fields are missing");
  }
  if (voucherCascadeResult.rows.length !== 1) {
    throw new Error("Voucher transaction-deletion tracking field is missing");
  }
  if (activePaymentIndexResult.rows.length !== 1) {
    throw new Error("Active voucher payment uniqueness rule is missing");
  }
  if (!voucherCounterResult.rows[0]) {
    throw new Error("Voucher number series is not initialized");
  }
  if (deletionPolicyResult.rows.length !== 6) {
    throw new Error("Role-aware deletion policy fields are missing");
  }
  if (companyCascadeResult.rows.length !== 2) {
    throw new Error("Company cascade-deletion tracking fields are missing");
  }
  if (transactionTinResult.rows.length !== 2) {
    throw new Error("Supplier or client transaction TIN field is missing");
  }
  if (clientChequeWorkflowResult.rows.length !== 7) {
    throw new Error("Client collection or pending-cheque fields are missing");
  }
  if (clientChequeIndexResult.rows.length !== 2) {
    throw new Error("Client pending-cheque indexes are missing");
  }
  if (supplierAttachmentResult.rows.length !== 3) {
    throw new Error("Supplier transaction Excel attachment fields are missing");
  }
  if (outsideServiceAttachmentResult.rows.length !== 7) {
    throw new Error("Other expense BIR or attachment fields are missing");
  }
  if (accountProtectionResult.rows.length !== 5) {
    throw new Error("Protected account deletion fields are missing");
  }

  console.log("Database verification passed.");
  console.log(`Tables: ${foundTables.join(", ")}`);
  console.log("Views: payable_records, receivable_records");
  console.log("Generated fields: supplier_transactions.billing_status, client_transactions.billing_status");
  console.log("Billing states: Not Paid or Paid; partial payments are blocked");
  console.log("Transaction tax fields: supplier and client TIN numbers are available");
  console.log("Client collections: received cheques remain Pending Deposit until manually confirmed on or after the cheque date");
  console.log("Deletion policy: company and Other Expense deletions are recoverable; Admins can restore or permanently delete them");
  console.log("Supplier P.O. import: Excel attachment storage fields are available");
  console.log("Voucher accounting fields: 1% withholding tax, net cheque amount, and bank name");
  console.log("Voucher deletion: historical Deleted status plus Admin-only irreversible removal");
  console.log("Voucher lifecycle: linked vouchers follow supplier transaction deletion and restored vouchers can be reissued");
  console.log("Other expenses: BIR details, amount, date, and optional PDF/image attachment are available");
  console.log("Account deletion: deactivation, Primary Admin approval, restoration, and permanent deletion are available");
  console.log(primaryAdminResult.rows[0]
    ? `Primary Admin: ${primaryAdminResult.rows[0].username} (${primaryAdminResult.rows[0].full_name})`
    : "Primary Admin: not selected; run npm run set-primary-admin -- <username>");
  console.log(`Next voucher number: ${String(Number(voucherCounterResult.rows[0].current_value) + 1).padStart(6, "0")}`);
}

verifyDatabase()
  .catch((error) => {
    console.error("Database verification failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
