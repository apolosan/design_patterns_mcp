-- Migration: Core Tables (sql.js compatible)
-- Created: 2025-01-11T00:00:00Z

-- UP
-- Create pattern_implementations table
CREATE TABLE IF NOT EXISTS pattern_implementations (
  id TEXT PRIMARY KEY,
  pattern_id TEXT NOT NULL,
  language TEXT NOT NULL,
  approach TEXT NOT NULL,
  code TEXT NOT NULL,
  explanation TEXT NOT NULL,
  dependencies TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
);

-- Create pattern_relationships table
CREATE TABLE IF NOT EXISTS pattern_relationships (
  id TEXT PRIMARY KEY,
  source_pattern_id TEXT NOT NULL,
  target_pattern_id TEXT NOT NULL,
  type TEXT NOT NULL,
  strength REAL DEFAULT 1.0,
  description TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_pattern_id) REFERENCES patterns(id) ON DELETE CASCADE,
  FOREIGN KEY (target_pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  preferences TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create search queries table for analytics
CREATE TABLE IF NOT EXISTS search_queries (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  user_id TEXT,
  results_count INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create pattern usage analytics table
CREATE TABLE IF NOT EXISTS pattern_usage (
  id TEXT PRIMARY KEY,
  pattern_id TEXT NOT NULL,
  user_id TEXT,
  context TEXT,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_pattern_implementations_pattern_id ON pattern_implementations(pattern_id);
CREATE INDEX idx_pattern_implementations_language ON pattern_implementations(language);
CREATE INDEX idx_pattern_relationships_source ON pattern_relationships(source_pattern_id);
CREATE INDEX idx_pattern_relationships_target ON pattern_relationships(target_pattern_id);
CREATE INDEX idx_pattern_relationships_type ON pattern_relationships(type);
CREATE INDEX idx_search_queries_created_at ON search_queries(created_at);
CREATE INDEX idx_pattern_usage_pattern_id ON pattern_usage(pattern_id);
CREATE INDEX idx_pattern_usage_created_at ON pattern_usage(created_at);

-- Additional performance indexes for common query patterns
CREATE INDEX idx_patterns_name ON patterns(name);
CREATE INDEX idx_patterns_category_name ON patterns(category, name);
CREATE INDEX idx_pattern_embeddings_model ON pattern_embeddings(model);
CREATE INDEX idx_search_queries_query ON search_queries(query);
CREATE INDEX idx_search_queries_user_id ON search_queries(user_id);

-- DOWN
DROP TABLE IF EXISTS pattern_usage;
DROP TABLE IF EXISTS search_queries;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS pattern_relationships;
DROP TABLE IF EXISTS pattern_implementations;