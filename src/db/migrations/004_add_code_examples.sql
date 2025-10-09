-- Migration: Add Code Examples Support
-- Created: 2025-01-11T12:00:00Z
-- Description: Adds optional code examples field to patterns table

-- UP
-- Add examples column to patterns table (JSON format for multiple language examples)
ALTER TABLE patterns ADD COLUMN examples TEXT;

-- Create index for patterns with examples
CREATE INDEX idx_patterns_has_examples ON patterns(id) WHERE examples IS NOT NULL;

-- Create a new table for structured code examples (normalized approach)
CREATE TABLE IF NOT EXISTS pattern_code_examples (
  id TEXT PRIMARY KEY,
  pattern_id TEXT NOT NULL,
  language TEXT NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE,
  UNIQUE(pattern_id, language)
);

-- Create indexes for code examples
CREATE INDEX idx_pattern_code_examples_pattern_id ON pattern_code_examples(pattern_id);
CREATE INDEX idx_pattern_code_examples_language ON pattern_code_examples(language);

-- DOWN
DROP INDEX IF EXISTS idx_patterns_has_examples;
DROP TABLE IF EXISTS pattern_code_examples;
-- Note: Cannot easily drop column in SQLite without recreating table
-- For rollback, would need to recreate patterns table without examples column
