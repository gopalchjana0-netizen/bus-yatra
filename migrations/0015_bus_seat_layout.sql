-- Add dynamic seat layout JSON configuration to buses table
ALTER TABLE buses ADD COLUMN seat_layout TEXT;

