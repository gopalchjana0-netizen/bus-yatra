CREATE TABLE IF NOT EXISTS portal_credentials (
    role TEXT NOT NULL,
    identifier TEXT NOT NULL,
    bus_id TEXT,
    pin_salt TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    security_question TEXT,
    security_answer_salt TEXT,
    security_answer_hash TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role, identifier)
);

CREATE TABLE IF NOT EXISTS portal_sessions (
    token_hash TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    identifier TEXT NOT NULL,
    bus_id TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    identifier TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    failed_attempts INTEGER NOT NULL DEFAULT 1,
    first_failed_at TEXT,
    last_attempt TEXT,
    locked_until TEXT
);

CREATE TABLE IF NOT EXISTS booking_financials (
    booking_id TEXT PRIMARY KEY,
    owner_phone TEXT NOT NULL,
    company_name TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    commission_amount REAL NOT NULL DEFAULT 0,
    operator_amount REAL NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS owner_requests (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    bus_number TEXT NOT NULL,
    owner_phone TEXT NOT NULL UNIQUE,
    license_doc TEXT,
    pin TEXT NOT NULL,
    security_question TEXT NOT NULL,
    security_answer TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reject_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operator_financial_settings (
    owner_phone TEXT PRIMARY KEY,
    commission_mode TEXT NOT NULL DEFAULT 'percentage',
    commission_value REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
    phone TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_identifier TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);

