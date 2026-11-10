CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    sender_role TEXT NOT NULL,
    sender_identifier TEXT NOT NULL,
    target_group TEXT NOT NULL,
    bus_id TEXT,
    owner_phone TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_target_status ON notifications(target_group, status);
CREATE INDEX IF NOT EXISTS idx_notifications_owner_phone ON notifications(owner_phone);

