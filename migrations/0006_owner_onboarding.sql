CREATE TABLE owners (
    phone TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    bus_number TEXT NOT NULL UNIQUE,
    license_file_name TEXT NOT NULL,
    license_mime_type TEXT NOT NULL CHECK (license_mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
    license_data TEXT NOT NULL,
    pin_salt TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    security_question TEXT NOT NULL,
    security_answer_salt TEXT NOT NULL,
    security_answer_hash TEXT NOT NULL,
    route TEXT NOT NULL,
    active_routes TEXT NOT NULL,
    stoppages TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    fare REAL NOT NULL CHECK (fare > 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    reviewed_at TEXT,
    reviewed_by TEXT
);

CREATE INDEX owners_review_queue ON owners (status, created_at);
