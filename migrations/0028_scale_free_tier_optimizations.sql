-- Free-tier scaling optimizations: indexes for date/UTR/session queries + GPS-skipping replica trigger
CREATE INDEX IF NOT EXISTS idx_bsl_date ON booking_seat_legs (journey_date, bus_id);
CREATE INDEX IF NOT EXISTS idx_booking_seats_date ON booking_seats (journey_date, bus_id);
CREATE INDEX IF NOT EXISTS idx_bookings_utr ON bookings (utr_number);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires ON portal_sessions (expires_at);

DROP TRIGGER IF EXISTS firebase_outbox_buses_update;
CREATE TRIGGER firebase_outbox_buses_update
AFTER UPDATE OF name, bus_number, owner_name, owner_phone, owner_email, route,
    active_routes, stoppages, fare_per_stop, fare_per_km, window_seat_extra,
    time, fare, total_seats, image, upi_id, qr_image, allow_online_payment,
    allow_cash_payment, driver_phone, company_name, gst_number, ticket_terms,
    emergency_phone, driver_name ON buses
BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('buses', NEW.id, 'upsert', json_object(
        'id', NEW.id, 'name', NEW.name, 'bus_number', NEW.bus_number, 'owner_name', NEW.owner_name,
        'owner_phone', NEW.owner_phone, 'owner_email', NEW.owner_email, 'route', NEW.route,
        'active_routes', NEW.active_routes, 'stoppages', NEW.stoppages, 'fare_per_stop', NEW.fare_per_stop,
        'fare_per_km', NEW.fare_per_km, 'window_seat_extra', NEW.window_seat_extra, 'time', NEW.time,
        'fare', NEW.fare, 'total_seats', NEW.total_seats, 'image', NEW.image, 'upi_id', NEW.upi_id,
        'qr_image', NEW.qr_image, 'allow_online_payment', NEW.allow_online_payment,
        'allow_cash_payment', NEW.allow_cash_payment, 'driver_phone', NEW.driver_phone,
        'company_name', NEW.company_name, 'gst_number', NEW.gst_number, 'ticket_terms', NEW.ticket_terms,
        'emergency_phone', NEW.emergency_phone, 'lat', NEW.lat, 'lng', NEW.lng,
        'location_updated_at', NEW.location_updated_at, 'driver_name', NEW.driver_name
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
