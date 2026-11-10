CREATE TABLE bus_service_dates (
    bus_id TEXT NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    journey_date TEXT NOT NULL,
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    PRIMARY KEY (bus_id, journey_date)
);

CREATE TABLE platform_features (
    feature_key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1))
);
