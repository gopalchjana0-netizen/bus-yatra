-- Migration 0023: Enterprise Stoppage From->To Fare Matrix, Segment Seat Inventory, En-Route Running Bus Tracking & 8h Cancellation Cutoff
-- All DDL is strictly additive (zero destructive DROP TABLE on live production tables).

-- 1. Stoppage-to-stoppage fare maps & live current stoppage tracking on buses
ALTER TABLE buses ADD COLUMN stoppage_fares TEXT NOT NULL DEFAULT '{}';
ALTER TABLE buses ADD COLUMN return_stoppage_fares TEXT NOT NULL DEFAULT '{}';
ALTER TABLE buses ADD COLUMN current_stoppage TEXT NOT NULL DEFAULT '';
ALTER TABLE buses ADD COLUMN current_stoppage_updated_at TEXT NOT NULL DEFAULT '';

-- 2. Hop-level atomic seat reservation table (allows non-overlapping segments like Pingla->Moyna + Moyna->Kolkata on the same seat)
CREATE TABLE IF NOT EXISTS booking_seat_legs (
    bus_id TEXT NOT NULL,
    journey_date TEXT NOT NULL,
    seat_number TEXT NOT NULL,
    hop_idx INTEGER NOT NULL,
    booking_id TEXT NOT NULL,
    boarding_idx INTEGER NOT NULL DEFAULT 0,
    dropping_idx INTEGER NOT NULL DEFAULT 999,
    boarding TEXT NOT NULL DEFAULT '',
    dropping TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (bus_id, journey_date, seat_number, hop_idx)
);
CREATE INDEX IF NOT EXISTS idx_bsl_booking ON booking_seat_legs (booking_id);

-- 3. Hop-level atomic temporary seat hold table
CREATE TABLE IF NOT EXISTS seat_hold_legs (
    bus_id TEXT NOT NULL,
    journey_date TEXT NOT NULL,
    seat_number TEXT NOT NULL,
    hop_idx INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    customer_phone TEXT,
    boarding_idx INTEGER NOT NULL DEFAULT 0,
    dropping_idx INTEGER NOT NULL DEFAULT 999,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    trip_direction TEXT DEFAULT 'UP',
    PRIMARY KEY (bus_id, journey_date, seat_number, hop_idx)
);
CREATE INDEX IF NOT EXISTS idx_shl_expiry ON seat_hold_legs (expires_at);
CREATE INDEX IF NOT EXISTS idx_shl_session ON seat_hold_legs (bus_id, journey_date, session_id);
