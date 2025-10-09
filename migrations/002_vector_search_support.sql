-- Migration: Vector Search Support
-- Created: 2025-01-11T00:00:00Z

-- UP
-- Create vector embeddings table (using regular table since sqlite-vec is not available with sql.js)
CREATE TABLE pattern_embeddings (
  pattern_id TEXT PRIMARY KEY,
  embedding TEXT NOT NULL,
  model TEXT NOT NULL,
  strategy TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create search queries table for analytics
CREATE TABLE search_queries (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  user_id TEXT,
  results_count INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create pattern usage analytics table
CREATE TABLE pattern_usage (
  id TEXT PRIMARY KEY,
  pattern_id TEXT NOT NULL,
  user_id TEXT,
  context TEXT,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_search_queries_created_at ON search_queries(created_at);
CREATE INDEX idx_pattern_usage_pattern_id ON pattern_usage(pattern_id);
CREATE INDEX idx_pattern_usage_created_at ON pattern_usage(created_at);

-- DOWN
DROP TABLE IF EXISTS pattern_usage;
DROP TABLE IF EXISTS search_queries;
-- IMPORTANT: Preserve embeddings data by renaming instead of dropping
-- This prevents data loss if migration is accidentally rolled back
ALTER TABLE pattern_embeddings RENAME TO pattern_embeddings_backup_migration_002;