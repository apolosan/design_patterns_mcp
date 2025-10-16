-- Migration: Initial Schema
-- Created: 2025-01-11T00:00:00Z

-- UP
-- Create patterns table
CREATE TABLE IF NOT EXISTS patterns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  when_to_use TEXT,
  benefits TEXT,
  drawbacks TEXT,
  use_cases TEXT,
  complexity TEXT NOT NULL,
  tags TEXT,
  examples TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

-- Create indexes for better performance
CREATE INDEX idx_patterns_category ON patterns(category);
CREATE INDEX idx_patterns_complexity ON patterns(complexity);
CREATE INDEX idx_pattern_implementations_pattern_id ON pattern_implementations(pattern_id);
CREATE INDEX idx_pattern_implementations_language ON pattern_implementations(language);
CREATE INDEX idx_pattern_relationships_source ON pattern_relationships(source_pattern_id);
CREATE INDEX idx_pattern_relationships_target ON pattern_relationships(target_pattern_id);
CREATE INDEX idx_pattern_relationships_type ON pattern_relationships(type);

-- DOWN
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS pattern_relationships;
DROP TABLE IF EXISTS pattern_implementations;
DROP TABLE IF EXISTS patterns;