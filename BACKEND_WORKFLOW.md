# Supplier backend workflow

## Relationships

| Record | Relationship |
| --- | --- |
| Supplier | Has many supplier transactions |
| Supplier transaction | Belongs to one supplier and stores original amount plus remaining balance |
| Payable | A live view of a supplier transaction whose balance is greater than zero |
| Voucher | Links to one supplier transaction by database ID and has a unique voucher number |
| Payment | Created when a full-balance voucher is issued and preserved as history |
| Audit log | Identifies the acting user, action, record, details, IP address, and timestamp |

## Voucher state rules

| State | Balance effect | Can it be deleted after confirmation? | Counted in Total Vouchers? |
| --- | --- | --- | --- |
| Draft | None | Yes | Yes |
| Issued | Reduces the linked transaction balance | Yes; payment reverses automatically | Yes |
| Cancelled | Reverses any issued payment and restores balance | Yes | Yes until deleted |
| Deleted | Issued payment is reversed; voucher stays visible historically | Admin can restore it as Draft | No |
| Permanently unrestorable | No additional financial effect; audit remains | No | No |

Issuing and applying payment run inside one PostgreSQL transaction. If payment insertion, balance update, or audit insertion fails, the operation rolls back.

Editing an issued voucher recalculates its active payment and linked supplier-transaction balance in one PostgreSQL transaction. Deleting an issued voucher reverses its payment and marks the voucher Deleted atomically. Restore returns it as Draft without applying payment. The irreversible Delete beside Restore only disables restoration and records a second audit event.

## Permissions

| Feature | Admin | User |
| --- | --- | --- |
| View records and dashboard | Yes | Yes |
| Add supplier/client transactions | Yes | Yes |
| Edit financial transaction details | Yes | Yes |
| Delete supplier/client transactions | Yes | Yes |
| Add supplier/client names | Yes | Yes |
| Edit supplier/client names | Yes | Yes |
| Delete supplier/client names | Yes | Yes |
| Create and issue voucher cheques | Yes | Yes |
| Edit voucher details | Yes | Yes |
| Delete vouchers after confirmation | Yes | Yes |
| Record client payments | Yes | Yes |
| Restore deleted transactions or names | Yes | No |
| Change voucher status to Cancelled | No | Yes through Edit |
| Restore deleted vouchers | Yes | No |
| Manage accounts | Yes | No |
| View audit logs | Yes | No |

`User` means an employee account. Both roles can add and edit company names, transactions, and vouchers. Voucher deletion remains historical and restorable until an Admin uses the separate irreversible Delete beside Restore in Recent Audit Activity. Other record types keep their existing role-aware deletion rules.

Every protected API route checks the JWT and role on the server. Hiding a React button is only a usability measure, not the security control.

## Database setup and verification

From the project root:

```bash
npm install
npm run db:init
npm run db:verify
npm run db:test-supplier
npm run dev
```

`db:test-supplier` runs in a rollback-only database transaction. It verifies ₱10,000 → ₱0 through one full payment, Payables removal, overpayment rejection, duplicate voucher rejection, payment history, and cancellation reversal without leaving test records behind.

See `README.md` for environment settings, account creation, UI testing, and API routes.

## Client workflow

`clients` owns `client_transactions`. Receivables comes from the `receivable_records` view and therefore contains no duplicate records. Recording a row in `client_payments` and reducing the linked balance happen in one database transaction. The same transaction feeds Client Records, Receivables, Total Sales, and dashboard sales/receivable totals.
