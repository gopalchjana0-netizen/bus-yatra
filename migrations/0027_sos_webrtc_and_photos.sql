-- Migration: Smooth 30FPS WebRTC SOS Live Video Signaling & Captured HD Photos
ALTER TABLE emergency_sos_alerts ADD COLUMN webrtc_offer TEXT DEFAULT '';
ALTER TABLE emergency_sos_alerts ADD COLUMN webrtc_offer_ice TEXT DEFAULT '[]';
ALTER TABLE emergency_sos_alerts ADD COLUMN webrtc_answer TEXT DEFAULT '';
ALTER TABLE emergency_sos_alerts ADD COLUMN webrtc_answer_ice TEXT DEFAULT '[]';
ALTER TABLE emergency_sos_alerts ADD COLUMN webrtc_session_nonce TEXT DEFAULT '';
ALTER TABLE emergency_sos_alerts ADD COLUMN webrtc_renegotiate INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sos_captured_photos (
    id TEXT PRIMARY KEY,
    sos_id TEXT NOT NULL,
    captured_by TEXT NOT NULL DEFAULT 'customer',
    photo_data TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sos_photos_sos ON sos_captured_photos(sos_id, created_at DESC);
