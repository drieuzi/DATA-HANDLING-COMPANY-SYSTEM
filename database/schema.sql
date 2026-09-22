-- Illuminux Company Management System
-- Stage 1: users and the Supplier -> Payable -> Voucher -> Payment workflow
-- This script is safe to run more than once. It does not delete existing data.

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'user'
        CHECK (role IN ('admin', 'user')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- Adds JWT revocation support when upgrading an existing database.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_token_version_nonnegative'
          AND conrelid = 'users'::REGCLASS
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_token_version_nonnegative
            CHECK (token_version >= 0);
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
    ON users (LOWER(username));

CREATE TABLE IF NOT EXISTS suppliers (
    id BIGSERIAL PRIMARY KEY,
    supplier_code VARCHAR(40),
    name VARCHAR(160) NOT NULL,
    business_address TEXT,
    contact_person VARCHAR(120),
    contact_number VARCHAR(40),
    email VARCHAR(160),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    deletion_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (BTRIM(name) <> ''),
    CHECK (supplier_code IS NULL OR BTRIM(supplier_code) <> ''),
    CHECK (email IS NULL OR BTRIM(email) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_lower_unique
    ON suppliers (LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_code_lower_unique
    ON suppliers (LOWER(supplier_code))
    WHERE supplier_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS suppliers_active_name_index
    ON suppliers (is_active, name);

CREATE TABLE IF NOT EXISTS supplier_transactions (
    id BIGSERIAL PRIMARY KEY,
    supplier_id BIGINT NOT NULL
        REFERENCES suppliers(id) ON DELETE RESTRICT,
    voucher_date DATE,
    payment_date DATE,
    sales_invoice_number VARCHAR(80),
    purchase_order_number VARCHAR(80),
    collection_receipt_number VARCHAR(80),
    cheque_date DATE,
    amount NUMERIC(14, 2) NOT NULL,
    balance NUMERIC(14, 2) NOT NULL,
    billing_status VARCHAR(20) GENERATED ALWAYS AS (
        CASE
            WHEN balance = 0 THEN 'Paid'
            WHEN balance < amount THEN 'Partially Paid'
            ELSE 'Not Paid'
        END
    ) STORED,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    deletion_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT supplier_transactions_positive_amount
        CHECK (amount > 0),
    CONSTRAINT supplier_transactions_valid_balance
        CHECK (balance >= 0 AND balance <= amount),
    CONSTRAINT supplier_transactions_identification_required
        CHECK (
            COALESCE(BTRIM(sales_invoice_number), '') <> ''
            OR COALESCE(BTRIM(purchase_order_number), '') <> ''
        ),
    CONSTRAINT supplier_transactions_id_supplier_unique
        UNIQUE (id, supplier_id)
);

CREATE INDEX IF NOT EXISTS supplier_transactions_supplier_index
    ON supplier_transactions (supplier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS supplier_transactions_balance_index
    ON supplier_transactions (balance)
    WHERE balance > 0;

CREATE INDEX IF NOT EXISTS supplier_transactions_status_index
    ON supplier_transactions (billing_status);

CREATE INDEX IF NOT EXISTS supplier_transactions_purchase_order_index
    ON supplier_transactions (purchase_order_number)
    WHERE purchase_order_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS supplier_transactions_sales_invoice_index
    ON supplier_transactions (sales_invoice_number)
    WHERE sales_invoice_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS vouchers (
    id BIGSERIAL PRIMARY KEY,
    voucher_number VARCHAR(80) NOT NULL,
    supplier_transaction_id BIGINT NOT NULL,
    supplier_id BIGINT NOT NULL,
    voucher_date DATE NOT NULL,
    cheque_date DATE,
    cheque_number VARCHAR(80),
    particulars TEXT,
    attachment_name VARCHAR(255),
    payment_date DATE,
    payment_amount NUMERIC(14, 2) NOT NULL,
    withholding_tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
    withholding_tax_amount NUMERIC(14, 2)
        GENERATED ALWAYS AS (ROUND(payment_amount * withholding_tax_rate, 2)) STORED,
    net_cheque_amount NUMERIC(14, 2)
        GENERATED ALWAYS AS (payment_amount - ROUND(payment_amount * withholding_tax_rate, 2)) STORED,
    bank_name VARCHAR(120),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'Draft'
        CHECK (payment_status IN ('Draft', 'Issued', 'Cancelled')),
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    issued_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    issued_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    deletion_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT vouchers_positive_payment_amount
        CHECK (payment_amount > 0),
    CONSTRAINT vouchers_withholding_tax_rate_check
        CHECK (withholding_tax_rate IN (0, 0.0100)),
    CONSTRAINT vouchers_transaction_supplier_fk
        FOREIGN KEY (supplier_transaction_id, supplier_id)
        REFERENCES supplier_transactions (id, supplier_id)
        ON DELETE RESTRICT,
    CONSTRAINT vouchers_id_transaction_supplier_unique
        UNIQUE (id, supplier_transaction_id, supplier_id),
    CONSTRAINT vouchers_issued_fields_check
        CHECK (
            payment_status <> 'Issued'
            OR (
                issued_by IS NOT NULL
                AND issued_at IS NOT NULL
                AND payment_date IS NOT NULL
            )
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS vouchers_number_lower_unique
    ON vouchers (LOWER(voucher_number));

CREATE INDEX IF NOT EXISTS vouchers_transaction_index
    ON vouchers (supplier_transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vouchers_supplier_index
    ON vouchers (supplier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vouchers_status_index
    ON vouchers (payment_status, voucher_date DESC);

-- Keeps voucher numbers continuous even when multiple users create vouchers.
-- The counter update and voucher insert happen in the same database transaction,
-- so a failed voucher does not consume a number.
CREATE TABLE IF NOT EXISTS system_counters (
    counter_name VARCHAR(80) PRIMARY KEY,
    current_value BIGINT NOT NULL CHECK (current_value >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_counters (counter_name, current_value)
SELECT
    'voucher_number',
    GREATEST(
        COALESCE(MAX(voucher_number::BIGINT)
            FILTER (WHERE voucher_number ~ '^[0-9]+$'), 0),
        140
    )
FROM vouchers
ON CONFLICT (counter_name) DO UPDATE
SET current_value = GREATEST(system_counters.current_value, EXCLUDED.current_value),
    updated_at = NOW();

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    voucher_id BIGINT NOT NULL UNIQUE,
    supplier_transaction_id BIGINT NOT NULL,
    supplier_id BIGINT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    payment_date DATE NOT NULL,
    recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reversed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payments_positive_amount
        CHECK (amount > 0),
    CONSTRAINT payments_voucher_transaction_supplier_fk
        FOREIGN KEY (voucher_id, supplier_transaction_id, supplier_id)
        REFERENCES vouchers (id, supplier_transaction_id, supplier_id)
        ON DELETE RESTRICT,
    CONSTRAINT payments_transaction_supplier_fk
        FOREIGN KEY (supplier_transaction_id, supplier_id)
        REFERENCES supplier_transactions (id, supplier_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS payments_transaction_index
    ON payments (supplier_transaction_id, payment_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_supplier_index
    ON payments (supplier_id, payment_date DESC);

CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,
    client_code VARCHAR(40),
    name VARCHAR(160) NOT NULL,
    business_address TEXT,
    contact_person VARCHAR(120),
    contact_number VARCHAR(40),
    email VARCHAR(160),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    deletion_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (BTRIM(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_name_lower_unique
    ON clients (LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS clients_code_lower_unique
    ON clients (LOWER(client_code)) WHERE client_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_active_name_index
    ON clients (is_active, name);

CREATE TABLE IF NOT EXISTS client_transactions (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    transaction_date DATE NOT NULL,
    sales_invoice_number VARCHAR(80),
    purchase_order_number VARCHAR(80),
    collection_receipt_number VARCHAR(80),
    payment_date DATE,
    cheque_date DATE,
    amount NUMERIC(14, 2) NOT NULL,
    balance NUMERIC(14, 2) NOT NULL,
    billing_status VARCHAR(20) GENERATED ALWAYS AS (
        CASE
            WHEN balance = 0 THEN 'Paid'
            WHEN balance < amount THEN 'Partially Paid'
            ELSE 'Not Paid'
        END
    ) STORED,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMPTZ,
    deletion_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT client_transactions_positive_amount CHECK (amount > 0),
    CONSTRAINT client_transactions_valid_balance CHECK (balance >= 0 AND balance <= amount),
    CONSTRAINT client_transactions_identification_required CHECK (
        COALESCE(BTRIM(sales_invoice_number), '') <> ''
        OR COALESCE(BTRIM(purchase_order_number), '') <> ''
    ),
    CONSTRAINT client_transactions_id_client_unique UNIQUE (id, client_id)
);

CREATE INDEX IF NOT EXISTS client_transactions_client_index
    ON client_transactions (client_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS client_transactions_balance_index
    ON client_transactions (balance) WHERE balance > 0;

CREATE INDEX IF NOT EXISTS client_transactions_status_index
    ON client_transactions (billing_status);

CREATE TABLE IF NOT EXISTS client_payments (
    id BIGSERIAL PRIMARY KEY,
    client_transaction_id BIGINT NOT NULL,
    client_id BIGINT NOT NULL,
    collection_receipt_number VARCHAR(80),
    payment_date DATE NOT NULL,
    cheque_date DATE,
    amount NUMERIC(14, 2) NOT NULL,
    recorded_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT client_payments_positive_amount CHECK (amount > 0),
    CONSTRAINT client_payments_transaction_client_fk
        FOREIGN KEY (client_transaction_id, client_id)
        REFERENCES client_transactions (id, client_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS client_payments_transaction_index
    ON client_payments (client_transaction_id, payment_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS client_payments_client_index
    ON client_payments (client_id, payment_date DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (BTRIM(action) <> ''),
    CHECK (BTRIM(entity_type) <> '')
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_index
    ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_index
    ON audit_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_entity_index
    ON audit_logs (entity_type, entity_id, created_at DESC);

-- Adds recoverable-deletion and payment-reversal fields when upgrading an
-- existing Stage 1 database. No current records are removed.
ALTER TABLE suppliers
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE supplier_transactions
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE vouchers
    ADD COLUMN IF NOT EXISTS cheque_number VARCHAR(80),
    ADD COLUMN IF NOT EXISTS particulars TEXT,
    ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS withholding_tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS withholding_tax_amount NUMERIC(14, 2)
        GENERATED ALWAYS AS (ROUND(payment_amount * withholding_tax_rate, 2)) STORED,
    ADD COLUMN IF NOT EXISTS net_cheque_amount NUMERIC(14, 2)
        GENERATED ALWAYS AS (payment_amount - ROUND(payment_amount * withholding_tax_rate, 2)) STORED,
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'vouchers_withholding_tax_rate_check'
    ) THEN
        ALTER TABLE vouchers
            ADD CONSTRAINT vouchers_withholding_tax_rate_check
            CHECK (withholding_tax_rate IN (0, 0.0100));
    END IF;
END $$;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS reversed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

CREATE INDEX IF NOT EXISTS suppliers_deleted_at_index
    ON suppliers (deleted_at);

CREATE INDEX IF NOT EXISTS supplier_transactions_deleted_at_index
    ON supplier_transactions (deleted_at);

CREATE INDEX IF NOT EXISTS vouchers_deleted_at_index
    ON vouchers (deleted_at);

CREATE INDEX IF NOT EXISTS payments_reversed_at_index
    ON payments (reversed_at);

CREATE INDEX IF NOT EXISTS clients_deleted_at_index
    ON clients (deleted_at);

CREATE INDEX IF NOT EXISTS client_transactions_deleted_at_index
    ON client_transactions (deleted_at);

-- Kept temporarily so the existing Admin-account controller continues to work
-- until it is moved to the unified audit_logs table in the API stage.
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    target_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_activity_logs_created_at_index
    ON user_activity_logs (created_at DESC);

-- Payables are a live query over supplier transactions. This view stores no
-- duplicate financial data and automatically excludes fully paid transactions.
CREATE OR REPLACE VIEW payable_records AS
SELECT
    st.id AS transaction_id,
    st.supplier_id,
    supplier.supplier_code,
    supplier.name AS supplier_name,
    st.voucher_date,
    st.payment_date,
    st.sales_invoice_number,
    st.purchase_order_number,
    st.collection_receipt_number,
    st.cheque_date,
    st.amount,
    st.balance,
    st.amount - st.balance AS paid_amount,
    st.billing_status,
    st.created_by,
    st.created_at,
    st.updated_at
FROM supplier_transactions AS st
JOIN suppliers AS supplier ON supplier.id = st.supplier_id
WHERE st.balance > 0
  AND st.deleted_at IS NULL
  AND supplier.deleted_at IS NULL;

-- Receivables are calculated from active client transactions with a balance.
CREATE OR REPLACE VIEW receivable_records AS
SELECT
    ct.id AS transaction_id,
    ct.client_id,
    client.client_code,
    client.name AS client_name,
    client.business_address,
    ct.transaction_date,
    ct.sales_invoice_number,
    ct.purchase_order_number,
    ct.collection_receipt_number,
    ct.payment_date,
    ct.cheque_date,
    ct.amount,
    ct.balance,
    ct.amount - ct.balance AS paid_amount,
    ct.billing_status,
    ct.created_by,
    ct.created_at,
    ct.updated_at
FROM client_transactions AS ct
JOIN clients AS client ON client.id = ct.client_id
WHERE ct.balance > 0
  AND ct.deleted_at IS NULL
  AND client.deleted_at IS NULL;

-- Keeps updated_at correct without depending on every API route to remember it.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS suppliers_set_updated_at ON suppliers;
CREATE TRIGGER suppliers_set_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS supplier_transactions_set_updated_at ON supplier_transactions;
CREATE TRIGGER supplier_transactions_set_updated_at
BEFORE UPDATE ON supplier_transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS vouchers_set_updated_at ON vouchers;
CREATE TRIGGER vouchers_set_updated_at
BEFORE UPDATE ON vouchers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS clients_set_updated_at ON clients;
CREATE TRIGGER clients_set_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS client_transactions_set_updated_at ON client_transactions;
CREATE TRIGGER client_transactions_set_updated_at
BEFORE UPDATE ON client_transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE suppliers IS
    'Supplier master records. Deactivate suppliers instead of deleting financial history.';
COMMENT ON TABLE supplier_transactions IS
    'Purchase transactions. Payables are rows whose balance is greater than zero.';
COMMENT ON COLUMN supplier_transactions.billing_status IS
    'Generated automatically from amount and balance.';
COMMENT ON TABLE vouchers IS
    'Voucher instructions linked to one supplier transaction by database ID.';
COMMENT ON TABLE payments IS
    'Immutable payment history. One issued voucher creates one payment row.';
COMMENT ON TABLE clients IS
    'Client master records with recoverable deletion.';
COMMENT ON TABLE client_transactions IS
    'Sales transactions. Receivables are rows whose balance is greater than zero.';
COMMENT ON TABLE client_payments IS
    'Client payment history that reduces client transaction balances.';
COMMENT ON TABLE audit_logs IS
    'Security and business activity history identifying the acting user.';
COMMENT ON VIEW payable_records IS
    'Live unpaid/partially-paid supplier transactions; contains no duplicated payable data.';
COMMENT ON VIEW receivable_records IS
    'Live unpaid/partially-paid client transactions; contains no duplicated receivable data.';
