-- Migration 0018: Bus Photo Approval Workflow & Gallery Management
ALTER TABLE buses ADD COLUMN pending_images TEXT DEFAULT '[]';
ALTER TABLE buses ADD COLUMN photo_approval_status TEXT DEFAULT 'approved';
ALTER TABLE buses ADD COLUMN photo_rejection_reason TEXT DEFAULT '';

