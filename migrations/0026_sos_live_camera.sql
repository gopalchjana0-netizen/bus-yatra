-- Migration: Opt-in Consent-Based SOS Live Camera Feed
ALTER TABLE emergency_sos_alerts ADD COLUMN camera_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE emergency_sos_alerts ADD COLUMN camera_active INTEGER NOT NULL DEFAULT 0;
ALTER TABLE emergency_sos_alerts ADD COLUMN camera_frame TEXT DEFAULT '';
ALTER TABLE emergency_sos_alerts ADD COLUMN camera_updated_at TEXT;
ALTER TABLE emergency_sos_alerts ADD COLUMN camera_expires_at TEXT;
ALTER TABLE emergency_sos_alerts ADD COLUMN camera_session_token TEXT DEFAULT '';
