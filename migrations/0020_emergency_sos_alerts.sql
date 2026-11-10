-- Migration 0020: Passenger Emergency SOS Alerts System
CREATE TABLE IF NOT EXISTS emergency_sos_alerts (
    id TEXT PRIMARY KEY,
    alert_number TEXT UNIQUE,
    customer_phone TEXT,
    customer_name TEXT,
    emergency_type TEXT,
    description TEXT,
    latitude REAL,
    longitude REAL,
    maps_url TEXT,
    current_location_text TEXT,
    bus_id TEXT,
    bus_name TEXT,
    status TEXT DEFAULT 'Active',
    resolved_at TEXT,
    resolved_by TEXT,
    resolution_notes TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_status ON emergency_sos_alerts(status);
CREATE INDEX IF NOT EXISTS idx_sos_alerts_created ON emergency_sos_alerts(created_at);

