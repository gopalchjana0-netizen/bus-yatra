ALTER TABLE buses ADD COLUMN rating REAL DEFAULT 4.8;
ALTER TABLE buses ADD COLUMN booking_mode TEXT DEFAULT 'active';
ALTER TABLE owners ADD COLUMN features TEXT DEFAULT '{"auto_pilot":true,"notifications":true,"captains":true,"finance":true,"live_tracking":true,"edit_bus":true}';

