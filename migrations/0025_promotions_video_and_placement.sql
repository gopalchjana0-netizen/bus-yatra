-- Migration 0025: Promotional Ads Video Support & Search-Below Placement
ALTER TABLE promotions ADD COLUMN media_type TEXT NOT NULL DEFAULT 'image';
ALTER TABLE promotions ADD COLUMN placement TEXT NOT NULL DEFAULT 'popup';

