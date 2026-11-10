ALTER TABLE buses ADD COLUMN driver_name TEXT NOT NULL DEFAULT '';
ALTER TABLE portal_credentials ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1));

CREATE TABLE customers (
    phone TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pin_salt TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    security_question TEXT NOT NULL,
    security_answer_salt TEXT NOT NULL,
    security_answer_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'rejected')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    reviewed_at TEXT,
    reviewed_by TEXT
);

CREATE TABLE customer_sessions (
    token_hash TEXT PRIMARY KEY,
    phone TEXT NOT NULL REFERENCES customers(phone) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX customer_sessions_expiry ON customer_sessions (expires_at);

CREATE TABLE customer_login_attempts (
    phone TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL,
    first_failed_at TEXT NOT NULL,
    locked_until TEXT
);

CREATE TABLE operator_financial_settings (
    owner_phone TEXT PRIMARY KEY,
    commission_mode TEXT NOT NULL CHECK (commission_mode IN ('percentage', 'fixed')),
    commission_value REAL NOT NULL CHECK (commission_value >= 0),
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE TABLE booking_financials (
    booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
    owner_phone TEXT NOT NULL,
    company_name TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount >= 0),
    payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'received', 'refund_requested', 'refunded', 'settled')),
    commission_amount REAL NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
    operator_amount REAL NOT NULL DEFAULT 0 CHECK (operator_amount >= 0),
    note TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE INDEX booking_financials_owner_status ON booking_financials (owner_phone, payment_status);

CREATE TABLE admin_users (
    phone TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_identifier TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

CREATE INDEX admin_audit_log_created ON admin_audit_log (created_at DESC);
