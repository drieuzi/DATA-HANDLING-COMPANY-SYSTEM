# Current migration status

The frontend is a React/Vite application. The Supplier workflow has now moved from browser-only records to the Express/PostgreSQL API.

## PostgreSQL-backed features

- JWT login through an HTTP-only cookie
- Admin/User account management
- suppliers and recoverable supplier deletion
- supplier transactions and recoverable transaction deletion
- live Payables derived from transaction balances
- vouchers with unique voucher numbers
- partial payment history
- voucher cancellation and payment reversal
- recoverable voucher deletion
- live purchase/payable/dashboard expense calculations
- audit logs

## Client workflow now connected

- clients and recoverable client deletion
- client transactions and recoverable transaction deletion
- live Receivables derived from transaction balances
- partial/full client payments with exact payment dates
- Total Sales and dashboard sales totals from the same transactions
- audit logging for client changes and payments

Uploaded hardcopy file contents are still not stored; the current UI records filenames only.

## Important behavior changes

- A Draft voucher does not change a transaction balance.
- Issuing a voucher creates a payment and reduces the balance atomically.
- Partial voucher amounts are allowed.
- Cancelling an Issued voucher reverses its payment and restores the balance.
- Cancelled vouchers remain part of the active voucher count.
- An Issued voucher cannot be deleted until it is cancelled.
- Only Admins manage suppliers, issue/cancel/delete vouchers, delete transactions, manage accounts, and view audit logs.
- Users do not self-register; an Admin creates their accounts in the Account Management page.

Run `npm run db:init` after installing this update so existing databases receive the new soft-delete, payment-reversal, and JWT-revocation fields.
