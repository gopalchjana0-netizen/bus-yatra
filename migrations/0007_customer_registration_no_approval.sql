UPDATE customers
SET status = 'active', reviewed_at = NULL, reviewed_by = NULL
WHERE status = 'pending';
