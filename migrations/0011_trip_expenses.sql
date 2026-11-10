CREATE TABLE IF NOT EXISTS trip_expenses (
    id TEXT PRIMARY KEY,
    owner_phone TEXT NOT NULL,
    bus_id TEXT NOT NULL,
    journey_date TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trip_expenses_owner_bus_date ON trip_expenses (owner_phone, bus_id, journey_date);

