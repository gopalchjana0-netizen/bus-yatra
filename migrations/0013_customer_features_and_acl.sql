-- Migration 0013: Add features column to customers table for granular Next-Gen feature toggles
ALTER TABLE customers ADD COLUMN features TEXT DEFAULT '{"offline_tickets":true,"referral_rewards":true,"voice_search":true,"parcel_booking":true,"meal_preorder":true,"women_safety":true}';
