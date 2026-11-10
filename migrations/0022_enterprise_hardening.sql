-- Migration 0022: Enterprise Security, Soft-Hide Ledger Protection & Coupon Controls
-- 1. Soft-hide flags so Customers, Captains, and Owners clearing their UI history
--    NEVER destroy financial ledgers (booking_financials) or unlock live paid seats.
ALTER TABLE bookings ADD COLUMN hidden_for_customer INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN hidden_for_captain INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN hidden_for_owner INTEGER NOT NULL DEFAULT 0;

-- 2. Enterprise coupon validation rules (minimum fare, usage limits, expiry date)
ALTER TABLE coupons ADD COLUMN min_fare REAL NOT NULL DEFAULT 0;
ALTER TABLE coupons ADD COLUMN max_uses INTEGER;
ALTER TABLE coupons ADD COLUMN used_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE coupons ADD COLUMN expires_at TEXT;

-- 3. Unguessable client token for anonymous/guest support tickets (prevents enumeration)
ALTER TABLE support_tickets ADD COLUMN ticket_secret TEXT;
