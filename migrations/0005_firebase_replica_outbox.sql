CREATE TABLE firebase_replica_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection TEXT NOT NULL,
    document_key TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
    payload TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT NOT NULL,
    last_error TEXT
);

CREATE INDEX firebase_replica_outbox_pending
    ON firebase_replica_outbox (next_attempt_at, id);

CREATE TABLE firebase_replica_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_success_at TEXT,
    last_error TEXT,
    lease_token TEXT,
    lease_expires_at TEXT
);

INSERT INTO firebase_replica_state (id) VALUES (1);

CREATE TABLE firebase_replica_backfill (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    table_index INTEGER NOT NULL DEFAULT 0,
    row_cursor INTEGER NOT NULL DEFAULT 0,
    complete INTEGER NOT NULL DEFAULT 0 CHECK (complete IN (0, 1))
);

INSERT INTO firebase_replica_backfill (id) VALUES (1);

CREATE TRIGGER firebase_outbox_buses_insert AFTER INSERT ON buses BEGIN
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
CREATE TRIGGER firebase_outbox_buses_update AFTER UPDATE ON buses BEGIN
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
CREATE TRIGGER firebase_outbox_buses_delete AFTER DELETE ON buses BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('buses', OLD.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_bookings_insert AFTER INSERT ON bookings BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('bookings', NEW.id, 'upsert', json_object(
        'id', NEW.id, 'bus_id', NEW.bus_id, 'bus_name', NEW.bus_name, 'bus_number', NEW.bus_number,
        'owner_name', NEW.owner_name, 'passenger_name', NEW.passenger_name,
        'passenger_phone', NEW.passenger_phone, 'seats', NEW.seats, 'boarding', NEW.boarding,
        'dropping', NEW.dropping, 'journey_date', NEW.journey_date, 'fare', NEW.fare,
        'payment_mode', NEW.payment_mode, 'utr_number', NEW.utr_number, 'status', NEW.status,
        'created_at', NEW.created_at, 'payment_verified', NEW.payment_verified, 'boarded', NEW.boarded
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_bookings_update AFTER UPDATE ON bookings BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('bookings', NEW.id, 'upsert', json_object(
        'id', NEW.id, 'bus_id', NEW.bus_id, 'bus_name', NEW.bus_name, 'bus_number', NEW.bus_number,
        'owner_name', NEW.owner_name, 'passenger_name', NEW.passenger_name,
        'passenger_phone', NEW.passenger_phone, 'seats', NEW.seats, 'boarding', NEW.boarding,
        'dropping', NEW.dropping, 'journey_date', NEW.journey_date, 'fare', NEW.fare,
        'payment_mode', NEW.payment_mode, 'utr_number', NEW.utr_number, 'status', NEW.status,
        'created_at', NEW.created_at, 'payment_verified', NEW.payment_verified, 'boarded', NEW.boarded
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_bookings_delete AFTER DELETE ON bookings BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('bookings', OLD.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_booking_seats_insert AFTER INSERT ON booking_seats BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('booking_seats', NEW.bus_id || ':' || NEW.journey_date || ':' || NEW.seat_number, 'upsert',
        json_object('bus_id', NEW.bus_id, 'journey_date', NEW.journey_date, 'seat_number', NEW.seat_number, 'booking_id', NEW.booking_id),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_booking_seats_update AFTER UPDATE ON booking_seats BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('booking_seats', NEW.bus_id || ':' || NEW.journey_date || ':' || NEW.seat_number, 'upsert',
        json_object('bus_id', NEW.bus_id, 'journey_date', NEW.journey_date, 'seat_number', NEW.seat_number, 'booking_id', NEW.booking_id),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_booking_seats_delete AFTER DELETE ON booking_seats BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('booking_seats', OLD.bus_id || ':' || OLD.journey_date || ':' || OLD.seat_number, 'delete',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_reviews_insert AFTER INSERT ON reviews BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('reviews', NEW.id, 'upsert', json_object(
        'id', NEW.id, 'booking_id', NEW.booking_id, 'rating', NEW.rating, 'comment', NEW.comment, 'created_at', NEW.created_at
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_reviews_update AFTER UPDATE ON reviews BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('reviews', NEW.id, 'upsert', json_object(
        'id', NEW.id, 'booking_id', NEW.booking_id, 'rating', NEW.rating, 'comment', NEW.comment, 'created_at', NEW.created_at
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_reviews_delete AFTER DELETE ON reviews BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('reviews', OLD.id, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_coupons_insert AFTER INSERT ON coupons BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('coupons', NEW.code, 'upsert', json_object('code', NEW.code, 'discount', NEW.discount, 'active', NEW.active),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_coupons_update AFTER UPDATE ON coupons BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('coupons', NEW.code, 'upsert', json_object('code', NEW.code, 'discount', NEW.discount, 'active', NEW.active),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_coupons_delete AFTER DELETE ON coupons BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('coupons', OLD.code, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_bus_service_dates_insert AFTER INSERT ON bus_service_dates BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('bus_service_dates', NEW.bus_id || ':' || NEW.journey_date, 'upsert',
        json_object('bus_id', NEW.bus_id, 'journey_date', NEW.journey_date, 'enabled', NEW.enabled),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_bus_service_dates_update AFTER UPDATE ON bus_service_dates BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('bus_service_dates', NEW.bus_id || ':' || NEW.journey_date, 'upsert',
        json_object('bus_id', NEW.bus_id, 'journey_date', NEW.journey_date, 'enabled', NEW.enabled),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_bus_service_dates_delete AFTER DELETE ON bus_service_dates BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('bus_service_dates', OLD.bus_id || ':' || OLD.journey_date, 'delete',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_platform_features_insert AFTER INSERT ON platform_features BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('platform_features', NEW.feature_key, 'upsert', json_object('feature_key', NEW.feature_key, 'enabled', NEW.enabled),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_platform_features_update AFTER UPDATE ON platform_features BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('platform_features', NEW.feature_key, 'upsert', json_object('feature_key', NEW.feature_key, 'enabled', NEW.enabled),
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_platform_features_delete AFTER DELETE ON platform_features BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('platform_features', OLD.feature_key, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_portal_credentials_insert AFTER INSERT ON portal_credentials BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('portal_credentials', NEW.role || ':' || NEW.identifier, 'upsert', json_object(
        'role', NEW.role, 'identifier', NEW.identifier, 'bus_id', NEW.bus_id, 'pin_salt', NEW.pin_salt,
        'pin_hash', NEW.pin_hash, 'security_question', NEW.security_question,
        'security_answer_salt', NEW.security_answer_salt, 'security_answer_hash', NEW.security_answer_hash,
        'updated_at', NEW.updated_at, 'active', NEW.active
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_portal_credentials_update AFTER UPDATE ON portal_credentials BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('portal_credentials', NEW.role || ':' || NEW.identifier, 'upsert', json_object(
        'role', NEW.role, 'identifier', NEW.identifier, 'bus_id', NEW.bus_id, 'pin_salt', NEW.pin_salt,
        'pin_hash', NEW.pin_hash, 'security_question', NEW.security_question,
        'security_answer_salt', NEW.security_answer_salt, 'security_answer_hash', NEW.security_answer_hash,
        'updated_at', NEW.updated_at, 'active', NEW.active
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_portal_credentials_delete AFTER DELETE ON portal_credentials BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('portal_credentials', OLD.role || ':' || OLD.identifier, 'delete',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_customers_insert AFTER INSERT ON customers BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('customers', NEW.phone, 'upsert', json_object(
        'phone', NEW.phone, 'name', NEW.name, 'pin_salt', NEW.pin_salt, 'pin_hash', NEW.pin_hash,
        'security_question', NEW.security_question, 'security_answer_salt', NEW.security_answer_salt,
        'security_answer_hash', NEW.security_answer_hash, 'status', NEW.status, 'created_at', NEW.created_at,
        'updated_at', NEW.updated_at, 'reviewed_at', NEW.reviewed_at, 'reviewed_by', NEW.reviewed_by
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_customers_update AFTER UPDATE ON customers BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('customers', NEW.phone, 'upsert', json_object(
        'phone', NEW.phone, 'name', NEW.name, 'pin_salt', NEW.pin_salt, 'pin_hash', NEW.pin_hash,
        'security_question', NEW.security_question, 'security_answer_salt', NEW.security_answer_salt,
        'security_answer_hash', NEW.security_answer_hash, 'status', NEW.status, 'created_at', NEW.created_at,
        'updated_at', NEW.updated_at, 'reviewed_at', NEW.reviewed_at, 'reviewed_by', NEW.reviewed_by
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_customers_delete AFTER DELETE ON customers BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('customers', OLD.phone, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_operator_financial_settings_insert AFTER INSERT ON operator_financial_settings BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('operator_financial_settings', NEW.owner_phone, 'upsert', json_object(
        'owner_phone', NEW.owner_phone, 'commission_mode', NEW.commission_mode,
        'commission_value', NEW.commission_value, 'updated_at', NEW.updated_at, 'updated_by', NEW.updated_by
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_operator_financial_settings_update AFTER UPDATE ON operator_financial_settings BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('operator_financial_settings', NEW.owner_phone, 'upsert', json_object(
        'owner_phone', NEW.owner_phone, 'commission_mode', NEW.commission_mode,
        'commission_value', NEW.commission_value, 'updated_at', NEW.updated_at, 'updated_by', NEW.updated_by
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_operator_financial_settings_delete AFTER DELETE ON operator_financial_settings BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('operator_financial_settings', OLD.owner_phone, 'delete',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_booking_financials_insert AFTER INSERT ON booking_financials BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('booking_financials', NEW.booking_id, 'upsert', json_object(
        'booking_id', NEW.booking_id, 'owner_phone', NEW.owner_phone, 'company_name', NEW.company_name,
        'amount', NEW.amount, 'payment_status', NEW.payment_status, 'commission_amount', NEW.commission_amount,
        'operator_amount', NEW.operator_amount, 'note', NEW.note, 'updated_at', NEW.updated_at, 'updated_by', NEW.updated_by
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_booking_financials_update AFTER UPDATE ON booking_financials BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('booking_financials', NEW.booking_id, 'upsert', json_object(
        'booking_id', NEW.booking_id, 'owner_phone', NEW.owner_phone, 'company_name', NEW.company_name,
        'amount', NEW.amount, 'payment_status', NEW.payment_status, 'commission_amount', NEW.commission_amount,
        'operator_amount', NEW.operator_amount, 'note', NEW.note, 'updated_at', NEW.updated_at, 'updated_by', NEW.updated_by
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_booking_financials_delete AFTER DELETE ON booking_financials BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('booking_financials', OLD.booking_id, 'delete',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_admin_users_insert AFTER INSERT ON admin_users BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('admin_users', NEW.phone, 'upsert', json_object(
        'phone', NEW.phone, 'name', NEW.name, 'permissions', NEW.permissions, 'active', NEW.active,
        'created_at', NEW.created_at, 'created_by', NEW.created_by, 'updated_at', NEW.updated_at
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_admin_users_update AFTER UPDATE ON admin_users BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('admin_users', NEW.phone, 'upsert', json_object(
        'phone', NEW.phone, 'name', NEW.name, 'permissions', NEW.permissions, 'active', NEW.active,
        'created_at', NEW.created_at, 'created_by', NEW.created_by, 'updated_at', NEW.updated_at
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_admin_users_delete AFTER DELETE ON admin_users BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('admin_users', OLD.phone, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER firebase_outbox_admin_audit_log_insert AFTER INSERT ON admin_audit_log BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('admin_audit_log', CAST(NEW.id AS TEXT), 'upsert', json_object(
        'id', NEW.id, 'actor_identifier', NEW.actor_identifier, 'action', NEW.action,
        'target', NEW.target, 'details', NEW.details, 'created_at', NEW.created_at
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_admin_audit_log_update AFTER UPDATE ON admin_audit_log BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, payload, created_at, next_attempt_at)
    VALUES ('admin_audit_log', CAST(NEW.id AS TEXT), 'upsert', json_object(
        'id', NEW.id, 'actor_identifier', NEW.actor_identifier, 'action', NEW.action,
        'target', NEW.target, 'details', NEW.details, 'created_at', NEW.created_at
    ), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER firebase_outbox_admin_audit_log_delete AFTER DELETE ON admin_audit_log BEGIN
    INSERT INTO firebase_replica_outbox (collection, document_key, operation, created_at, next_attempt_at)
    VALUES ('admin_audit_log', CAST(OLD.id AS TEXT), 'delete',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
