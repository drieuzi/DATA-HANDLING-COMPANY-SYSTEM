# Illuminux Company Management System

React/Vite frontend with a Node.js/Express API and PostgreSQL database. The completed backend workflow in this stage is:

**Supplier → Supplier Transaction → Payables → Voucher → Payment → Dashboard Analytics**

**Client → Client Transaction → Receivables → Client Payment → Total Sales**

## Requirements

- Node.js 20.19+ or 22.12+
- PostgreSQL 14+
- npm

## First-time setup

Run all commands from the project root—the folder containing this README and the root `package.json`.

1. Install dependencies:

```bash
npm install
```

2. Create a PostgreSQL database named `illuminux_company_system` in pgAdmin.

3. Copy `backend/.env.example` to `backend/.env` and set your own PostgreSQL password and JWT secret:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/illuminux_company_system
DATABASE_SSL=false
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
JWT_EXPIRES_IN=8h
CLIENT_ORIGIN=http://localhost:5173
```

Generate a safe JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

4. Create or upgrade the database tables:

```bash
npm run db:init
npm run db:verify
npm run db:test-supplier
npm run db:test-client
```

5. Create the first Admin account (or reset it if the username already exists):

```bash
npm run create-admin -- admin "ChangeThisPassword123!" "System Administrator"
```

6. Start the backend and frontend together:

```bash
npm run dev
```

Open `http://localhost:5173/`. Keep that terminal running while using the site.

## Where Users create accounts

There is intentionally no public Sign Up page because the system is company-exclusive. An Admin creates accounts in:

**Dashboard → Manage User Accounts → + Add Account**

The Admin can create either an `Admin` or `User`, change roles, activate/deactivate accounts, and reset passwords. Passwords are hashed with bcrypt and never stored as plain text.

## Employee and Admin data control

`User` accounts are the company's employees. They perform the daily transaction work and can:

- add, edit, and delete suppliers and supplier transactions;
- add, edit, and delete clients and client transactions;
- create and issue voucher cheques;
- edit voucher-cheque details, including issued voucher payments;
- delete vouchers after confirming the action;
- record full-balance client payments;
- view records and dashboard analytics.

Admins have full data control. They can add and edit supplier/client details, transactions, and vouchers; move Draft or Issued vouchers to historical Deleted status; restore those vouchers as Draft; make a deleted voucher permanently unrestorable; manage employee accounts; and view audit activity.

Admin accounts do not have a Cancel action or cancellation permission. The dedicated Admin cancellation endpoint was removed, and the Admin voucher editor cannot change an active voucher to `Cancelled`.

For supplier, client, and transaction records, an employee deletion is recoverable by an Admin while an Admin deletion is permanently hidden with audit history retained. Vouchers use two separate Admin actions: deleting a Draft or Issued voucher keeps it visible with `Deleted` status and makes it restorable; the Delete button beside Restore in Recent Audit Activity makes that voucher permanently unrestorable. Deleting an Issued voucher reverses its payment first. Restoring returns it as Draft without automatically reapplying payment.

The React interface hides controls that a role cannot use, and the Express authorization middleware enforces the same permissions even if someone calls the API directly.

Supplier and client forms collect only the company name, contact person, and contact number. Company Edit/Delete controls appear inside the selected company track record rather than beside Billing Status. Payables and Receivables remain calculated, read-only summaries.

## Financial data rules

- `supplier_transactions` is the single source for Payables; there is no duplicate Payables table.
- `payable_records` is a PostgreSQL view containing active transactions with a balance greater than zero.
- `client_transactions` is the single source for Receivables and Total Sales.
- `receivable_records` is a PostgreSQL view containing active client transactions with a balance greater than zero.
- `client_payments` preserves each completed client payment and automatically settles the transaction balance.
- Money uses `NUMERIC(14,2)`.
- Billing status is generated from amount and balance: `Not Paid` or `Paid`.
- A voucher links to a transaction by database ID and has a unique voucher number.
- Issuing a voucher and inserting its payment happen in one PostgreSQL transaction.
- Partial, excessive, zero/negative payments, duplicate voucher numbers, and invalid relationships are rejected.
- Payment rows are preserved as history. Cancellation marks the payment reversed instead of overwriting it.
- Important authentication, account, supplier, transaction, voucher, and payment actions are recorded in `audit_logs`.

## Test the ₱10,000 workflow

1. Log in as Admin.
2. Open **Suppliers Track Records → Supplier Names and Records**.
3. Add a supplier and open it.
4. Add a transaction with amount `10000` and a P.O. and S.I. number.
5. Open the **Payables** tab. It shows `Not Paid` and ₱10,000 balance.
6. Open **Voucher Cheque**, create the automatically numbered voucher for the full `10000`, and choose `Issued`.
7. The transaction becomes `Paid` with zero balance and disappears from unpaid Payables.
8. Supplier records, voucher history, dashboard totals, monthly analytics, and Admin audit activity reflect the changes.

Also verify that the UI/API reject an overpayment, zero/negative payment, duplicate voucher number, missing/expired login, and nonexistent transaction. Log in as a normal User to confirm Admin-only controls and endpoints are unavailable.

## Main API routes

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `/api/admin/users` — Admin account management
- `/api/suppliers` — supplier management
- `/api/suppliers/transactions` — supplier transactions
- `/api/clients` — client management
- `/api/clients/transactions` — client transactions
- `POST /api/clients/transactions/:id/payments` — receive a client payment
- `GET /api/clients/receivables` — live unpaid/partially-paid client transactions
- `GET /api/payables` — live unpaid/partially-paid transactions
- `/api/vouchers` — voucher issue, cancellation, deletion, and restore
- `GET /api/transactions/:id/payments` — payment history
- `GET /api/dashboard?year=YYYY` — live totals and chart values
- `GET /api/audit-logs` — Admin-only audit activity

## Useful commands

```bash
npm run dev
npm run dev:backend
npm run dev:frontend
npm run build
npm run db:init
npm run db:verify
npm run db:test-supplier
npm run db:test-client
```

Client, Receivables, client payments, Total Sales, Supplier, Payables, Voucher, supplier payments, dashboard analytics, authentication, accounts, and audit activity now use PostgreSQL.
