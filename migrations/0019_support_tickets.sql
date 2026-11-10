-- Migration 0019: Enterprise AI Support & Ticket System
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    ticket_number TEXT UNIQUE,
    customer_phone TEXT,
    customer_name TEXT,
    subject TEXT,
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'Open',
    priority TEXT DEFAULT 'Medium',
    messages TEXT,
    last_message TEXT,
    last_sender TEXT,
    resolved_at TEXT,
    resolution_notes TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_phone ON support_tickets(customer_phone);
CREATE INDEX IF NOT EXISTS idx_support_tickets_updated ON support_tickets(updated_at);
