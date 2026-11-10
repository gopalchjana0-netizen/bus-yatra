CREATE TABLE buses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bus_number TEXT NOT NULL UNIQUE,
    owner_name TEXT NOT NULL,
    owner_phone TEXT NOT NULL,
    owner_email TEXT NOT NULL DEFAULT '',
    route TEXT NOT NULL,
    active_routes TEXT NOT NULL,
    stoppages TEXT NOT NULL,
    fare_per_stop REAL NOT NULL DEFAULT 45,
    fare_per_km REAL NOT NULL DEFAULT 3.5,
    window_seat_extra REAL NOT NULL DEFAULT 30,
    time TEXT NOT NULL,
    fare REAL NOT NULL,
    total_seats INTEGER NOT NULL DEFAULT 65,
    image TEXT NOT NULL DEFAULT '',
    upi_id TEXT NOT NULL DEFAULT '',
    qr_image TEXT NOT NULL DEFAULT '',
    allow_online_payment INTEGER NOT NULL DEFAULT 1,
    allow_cash_payment INTEGER NOT NULL DEFAULT 1,
    driver_phone TEXT NOT NULL DEFAULT '',
    company_name TEXT NOT NULL DEFAULT '',
    gst_number TEXT NOT NULL DEFAULT '',
    ticket_terms TEXT NOT NULL DEFAULT '',
    emergency_phone TEXT NOT NULL DEFAULT '',
    lat REAL,
    lng REAL,
    location_updated_at TEXT
);

CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    bus_id TEXT NOT NULL REFERENCES buses(id),
    bus_name TEXT NOT NULL,
    bus_number TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    passenger_name TEXT NOT NULL,
    passenger_phone TEXT NOT NULL,
    seats TEXT NOT NULL,
    boarding TEXT NOT NULL,
    dropping TEXT NOT NULL,
    journey_date TEXT NOT NULL,
    fare REAL NOT NULL,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('UPI', 'Cash')),
    utr_number TEXT UNIQUE,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    payment_verified INTEGER NOT NULL DEFAULT 0,
    boarded INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE booking_seats (
    bus_id TEXT NOT NULL REFERENCES buses(id),
    journey_date TEXT NOT NULL,
    seat_number TEXT NOT NULL,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    PRIMARY KEY (bus_id, journey_date, seat_number)
);

CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE coupons (
    code TEXT PRIMARY KEY,
    discount REAL NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX bookings_phone_lookup ON bookings (passenger_phone, id);
