-- Migration 0014: Add features column to portal_credentials for Captain / Conductor feature flags
ALTER TABLE portal_credentials ADD COLUMN features TEXT DEFAULT '{"qr_scanner":true,"offline_validation":true,"cash_collection":true,"gps_broadcast":true,"passenger_manifest":true,"driver_safety_alerts":true}';

