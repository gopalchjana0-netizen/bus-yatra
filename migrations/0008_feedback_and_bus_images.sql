-- Bus Yatra - Migration 0008: Customer Feedback & Multi-Image Bus Support
ALTER TABLE reviews ADD COLUMN passenger_name TEXT;
ALTER TABLE reviews ADD COLUMN passenger_phone TEXT;
ALTER TABLE reviews ADD COLUMN bus_id TEXT;
ALTER TABLE reviews ADD COLUMN bus_name TEXT;

