# Current migration status

The frontend is a React/Vite application. The Supplier workflow has now moved from browser-only records to the Express/PostgreSQL API.

## PostgreSQL-backed features

- JWT login through an HTTP-only cookie
- Admin/User account management
- suppliers and recoverable supplier deletion
- supplier transactions and recoverable transaction deletion
- live Payables derived from transaction balances
- vouchers with unique voucher numbers
- full-payment history
- voucher cancellation and payment reversal
- recoverable voucher deletion
- live purchase/payable/dashboard expense calculations
- audit logs

## Client workflow now connected

- clients and recoverable client deletion
- client transactions and recoverable transaction deletion
- live Receivables derived from transaction balances
- full-balance client payments with exact payment dates
- Total Sales and dashboard sales totals from the same transactions
- audit logging for client changes and payments

Uploaded hardcopy file contents are still not stored; the current UI records filenames only.

## Important behavior changes

- A Draft voucher does not change a transaction balance.
- Issuing a voucher creates a payment and reduces the balance atomically.
- Partial voucher and client payments are rejected; payments must equal the full remaining balance.
- Cancelling an Issued voucher reverses its payment and restores the balance.
- Cancelled vouchers remain part of the active voucher count.
- Deleting an Issued voucher cancels and reverses it first.
- Admins and Users can add and edit business records. Admins additionally manage accounts and audit logs.
- User deletions are restorable by an Admin; Admin deletions are permanently hidden while audit history remains.
- Voucher deletion is handled separately: Draft/Issued vouchers become historical `Deleted` records, while Recent Audit Activity provides Restore and irreversible Delete controls.
- Admin voucher cancellation controls and API permission were removed; Admins use the historical Delete workflow instead.
- Users do not self-register; an Admin creates their accounts in the Account Management page.

Run `npm run db:init` after installing this update so existing databases receive the new soft-delete, payment-reversal, and JWT-revocation fields.
