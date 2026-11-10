-- Migration 0021: Enterprise RedBus-Grade Atomic Seat Hold & Booking Idempotency
-- 1. Purge any stale expired holds and ensure no duplicate active holds remain
DELETE FROM seat_holds WHERE expires_at <= datetime('now');
DELETE FROM seat_holds WHERE id NOT IN (SELECT MIN(id) FROM seat_holds GROUP BY bus_id, journey_date, seat_number);

-- 2. Enforce strict database-level exclusivity: only ONE active session can hold (bus_id, journey_date, seat_number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_seat_holds_unique ON seat_holds (bus_id, journey_date, seat_number);

-- 3. Add idempotency_key to bookings to prevent duplicate bookings on network retries or double-taps
ALTER TABLE bookings ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency ON bookings (idempotency_key) WHERE idempotency_key IS NOT NULL;
