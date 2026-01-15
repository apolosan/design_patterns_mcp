-- Migration: Hybrid Search - Sparse Index Support
-- Adds TF-IDF sparse search capabilities for Blended RAG
-- Created: 2026-01-14
-- Patterns Applied: Blended RAG (arXiv 2404.07220), VectorSearch (arXiv 2409.17383)

-- UP

-- Sparse Terms Table for TF-IDF keyword search
-- Supports hybrid search with dense (vector) + sparse (keyword) retrieval
CREATE TABLE IF NOT EXISTS sparse_terms (
  pattern_id TEXT NOT NULL,
  term TEXT NOT NULL,
  term_frequency INTEGER NOT NULL DEFAULT 1,
  document_frequency INTEGER NOT NULL DEFAULT 0,
  idf_weight REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (pattern_id, term),
  FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
);

-- Index for term lookups (used in sparse search scoring)
CREATE INDEX IF NOT EXISTS idx_sparse_terms_term 
  ON sparse_terms(term);

-- Index for pattern-based queries
CREATE INDEX IF NOT EXISTS idx_sparse_terms_pattern_id 
  ON sparse_terms(pattern_id);

-- Composite index for efficient term-pattern joins
CREATE INDEX IF NOT EXISTS idx_sparse_terms_term_pattern 
  ON sparse_terms(term, pattern_id);

-- User Search Preferences Table for Adaptive Search Weights
-- Stores per-user search preferences learned from feedback
CREATE TABLE IF NOT EXISTS user_search_preferences (
  user_id TEXT NOT NULL,
  query_pattern TEXT NOT NULL,
  dense_weight REAL NOT NULL DEFAULT 0.6,
  sparse_weight REAL NOT NULL DEFAULT 0.4,
  last_updated TEXT NOT NULL,
  PRIMARY KEY (user_id, query_pattern)
);

-- Index for user preference lookups
CREATE INDEX IF NOT EXISTS idx_user_prefs_user_id 
  ON user_search_preferences(user_id);

-- DOWN

DROP TABLE IF EXISTS sparse_terms;
DROP TABLE IF EXISTS user_search_preferences;
