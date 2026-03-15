ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS performance_rating text;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS performance_score integer;
