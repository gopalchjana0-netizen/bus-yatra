-- Migration 0024: Customer Custom Profile Photo & Male/Female Avatar Preference
ALTER TABLE customers ADD COLUMN profile_photo TEXT NOT NULL DEFAULT '';
ALTER TABLE customers ADD COLUMN avatar_preference TEXT NOT NULL DEFAULT 'auto';

