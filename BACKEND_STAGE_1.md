# Backend Stage 1: PostgreSQL Foundation

This stage prepares the database for the first complete business workflow:

`Supplier -> Supplier Transaction -> Payable -> Voucher -> Payment`

It does not connect the React supplier pages yet. That happens only after this
schema passes verification on the local PostgreSQL database.

## Existing code that is being reused

- `backend/config/db.js` already provides a PostgreSQL connection pool.
- `backend/scripts/createAdmin.js` already hashes passwords with bcrypt.
- The existing `users` table and Admin account are preserved.
- The React supplier, payable, voucher, and dashboard pages will be connected
  to the API later without redesigning them.

The current authentication implementation uses PostgreSQL-backed server
sessions. It will be changed to JWT in the authentication/API stage after the
database foundation is verified.

## Proposed backend structure

```text
backend/
├── config/
│   └── db.js
├── controllers/
│   ├── authcontrollers.js
│   ├── suppliercontroller.js
│   ├── suppliertransactioncontroller.js
│   ├── vouchercontroller.js
│   ├── dashboardcontroller.js
│   └── auditcontroller.js
├── middleware/
│   ├── authmiddleware.js
│   ├── rolemiddleware.js
│   ├── validationmiddleware.js
│   └── errormiddleware.js
├── routes/
│   ├── authroutes.js
│   ├── supplierRoutes.js
│   ├── suppliertransactionroutes.js
│   ├── paymentroutes.js
│   ├── reportRoutes.js
│   └── auditRoutes.js
├── services/
│   ├── auditservice.js
│   └── voucherservice.js
├── validators/
│   ├── suppliervalidator.js
│   ├── transactionvalidator.js
│   └── vouchervalidator.js
├── scripts/
│   ├── createAdmin.js
│   ├── initDatabase.js
│   └── verifyDatabase.js
└── server.js
```

Controllers will handle HTTP requests. Services will hold multi-step business
logic such as issuing a voucher. Validators will reject invalid input before a
query runs. Middleware will enforce authentication and roles.

## Table relationships

- One `user` can create many suppliers, transactions, vouchers, and payments.
- One `supplier` can have many `supplier_transactions`.
- One supplier transaction can have many vouchers over time.
- One issued voucher creates exactly one payment.
- Multiple vouchers allow one transaction to preserve a complete partial-
  payment history.
- `audit_logs` records the user, action, affected record, and details.

There is no Payables table. `payable_records` is a PostgreSQL view over
`supplier_transactions` where `balance > 0`. A fully paid transaction therefore
disappears from Payables automatically without deleting its history.

## Automatic billing status

`supplier_transactions.billing_status` is a generated PostgreSQL column:

- `balance = amount` -> `Not Paid`
- `0 < balance < amount` -> `Partially Paid`
- `balance = 0` -> `Paid`

The database also rejects an amount at or below zero, a negative balance, and a
balance greater than the original amount. The voucher API will additionally
lock the transaction row and reject overpayments before changing any data.

## Setup commands

Open Git Bash or the VS Code terminal in the project root—the folder containing
the root `package.json`.

Install dependencies if this computer has not installed them yet:

```bash
npm install
```

Check that `backend/.env` contains the correct local PostgreSQL connection. Do
not commit this file.

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/illuminux_company_system
DATABASE_SSL=false
SESSION_SECRET=YOUR_EXISTING_RANDOM_SECRET
JWT_SECRET=A_DIFFERENT_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=8h
```

Initialize the schema:

```bash
npm run db:init
```

Expected result:

```text
Database schema initialized successfully.
```

Verify the required tables, Payables view, and generated status field:

```bash
npm run db:verify
```

Expected result:

```text
Database verification passed.
Tables: audit_logs, payments, supplier_transactions, suppliers, users, vouchers
View: payable_records
Generated field: supplier_transactions.billing_status
```

Run the rollback-only supplier workflow test:

```bash
npm run db:test-supplier
```

Expected result:

```text
Supplier schema test passed; all temporary test data was rolled back.
Verified: Not Paid -> Partially Paid -> Paid.
Verified: Payables view, payment history, overpayment rejection, and duplicate voucher rejection.
```

This test does not leave a supplier, transaction, voucher, payment, or test user
in the database because it finishes with `ROLLBACK`.

## Optional pgAdmin verification

Open the Query Tool for `illuminux_company_system` and run:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT * FROM payable_records;
```

The second query should currently return zero rows. That is correct because API
test records have not been created yet.
