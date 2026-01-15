-- Migration: SQL Pattern-Based Optimizations
-- Applies SQL Query Design Patterns from the pattern catalog
-- Created: 2025-10-07
-- Patterns Applied: Indexing Strategies, Query Optimization

-- UP

-- Covering Index Pattern: Include frequently accessed columns
-- Benefits: Eliminates table lookups for common queries
CREATE INDEX IF NOT EXISTS idx_patterns_category_name_covering 
  ON patterns(category, name);

-- Composite Index Pattern: Multi-column index for common filter combinations
-- Optimizes: WHERE category = ? AND complexity = ? queries
CREATE INDEX IF NOT EXISTS idx_patterns_category_complexity 
  ON patterns(category, complexity);

-- Partial/Filtered Index Pattern: Index only active/relevant patterns
-- Benefits: Smaller index size, faster queries on filtered subset
CREATE INDEX IF NOT EXISTS idx_patterns_with_examples 
  ON patterns(category)
  WHERE examples IS NOT NULL AND examples != '';

-- JSON Path Index Pattern: Enable fast JSON querying
-- Optimizes: JSON_EXTRACT queries on metadata
-- Note: metadata column not present in current schema, skipping index creation
-- CREATE INDEX IF NOT EXISTS idx_patterns_metadata_complexity
--   ON patterns(json_extract(metadata, '$.complexity'))
--   WHERE metadata IS NOT NULL;

-- Full-Text Search Preparation: Index for text search on description
-- Benefits: Faster LIKE queries and potential FTS upgrade
CREATE INDEX IF NOT EXISTS idx_patterns_description_prefix
  ON patterns(substr(description, 1, 100));

-- Covering Index for Common Search Query
-- Optimizes: SELECT id, name, category, complexity FROM patterns
CREATE INDEX IF NOT EXISTS idx_patterns_search_covering
  ON patterns(category, complexity, name);

-- Composite Index for Tag Queries
-- Optimizes: WHERE tags LIKE '%tag%' with category filter
CREATE INDEX IF NOT EXISTS idx_patterns_category_tags
  ON patterns(category, tags);

-- Pattern Implementations Optimization
-- Covering index for language-specific queries
CREATE INDEX IF NOT EXISTS idx_implementations_lang_pattern_covering
  ON pattern_implementations(language, pattern_id, approach);

-- Pattern Relationships Optimization
-- Composite index for bidirectional relationship queries
CREATE INDEX IF NOT EXISTS idx_relationships_source_target_type
  ON pattern_relationships(source_pattern_id, target_pattern_id, type);

-- Reverse relationship lookup optimization
CREATE INDEX IF NOT EXISTS idx_relationships_target_source_type
  ON pattern_relationships(target_pattern_id, source_pattern_id, type);

-- Statistics Update (Query Optimization Pattern)
-- Ensures query optimizer has current statistics
ANALYZE patterns;
ANALYZE pattern_implementations;
ANALYZE pattern_relationships;

-- DOWN

-- Drop all optimization indexes
DROP INDEX IF EXISTS idx_patterns_category_name_covering;
DROP INDEX IF EXISTS idx_patterns_category_complexity;
DROP INDEX IF EXISTS idx_patterns_with_examples;
DROP INDEX IF EXISTS idx_patterns_metadata_complexity;
DROP INDEX IF EXISTS idx_patterns_description_prefix;
DROP INDEX IF EXISTS idx_patterns_search_covering;
DROP INDEX IF EXISTS idx_patterns_category_tags;
DROP INDEX IF EXISTS idx_implementations_lang_pattern_covering;
DROP INDEX IF EXISTS idx_relationships_source_target_type;
DROP INDEX IF EXISTS idx_relationships_target_source_type;
