-- Migration 0012: Add stoppage_timings JSON column to buses table
ALTER TABLE buses ADD COLUMN stoppage_timings TEXT DEFAULT '{}';

