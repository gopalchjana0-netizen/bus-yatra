CREATE TABLE portal_credentials (
    role TEXT NOT NULL CHECK (role IN ('admin', 'owner', 'captain')),
    identifier TEXT NOT NULL,
    bus_id TEXT REFERENCES buses(id) ON DELETE CASCADE,
    pin_salt TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    security_question TEXT,
    security_answer_salt TEXT,
    security_answer_hash TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (role, identifier)
);

CREATE TABLE portal_sessions (
    token_hash TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('admin', 'owner', 'captain')),
    identifier TEXT NOT NULL,
    bus_id TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX portal_sessions_expiry ON portal_sessions (expires_at);

CREATE TABLE portal_login_attempts (
    role TEXT NOT NULL,
    identifier TEXT NOT NULL,
    failed_attempts INTEGER NOT NULL,
    first_failed_at TEXT NOT NULL,
    locked_until TEXT,
    PRIMARY KEY (role, identifier)
);
