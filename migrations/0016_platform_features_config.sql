-- Add config JSON column to platform_features for storing rich expansion hub settings
ALTER TABLE platform_features ADD COLUMN config TEXT;

