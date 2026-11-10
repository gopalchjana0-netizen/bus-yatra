-- Migration 0017: Pan-India Round-Trip (Up & Return) and Multi-Bus Admin Approval Workflow

ALTER TABLE buses ADD COLUMN approval_status TEXT DEFAULT 'approved';
ALTER TABLE buses ADD COLUMN rejection_reason TEXT DEFAULT '';
ALTER TABLE buses ADD COLUMN return_route_enabled INTEGER DEFAULT 0;
ALTER TABLE buses ADD COLUMN return_time TEXT DEFAULT '';
ALTER TABLE buses ADD COLUMN return_route TEXT DEFAULT '';
ALTER TABLE buses ADD COLUMN return_stoppages TEXT DEFAULT '[]';
ALTER TABLE buses ADD COLUMN return_stoppage_timings TEXT DEFAULT '{}';
ALTER TABLE buses ADD COLUMN return_fare REAL DEFAULT 0;

ALTER TABLE bookings ADD COLUMN trip_direction TEXT DEFAULT 'UP';
CREATE TABLE IF NOT EXISTS seat_holds (
    id TEXT PRIMARY KEY,
    bus_id TEXT,
    service_date TEXT,
    seat_number TEXT,
    held_by TEXT,
    expires_at TEXT,
    trip_direction TEXT DEFAULT 'UP'
);

