/**
 * Shared types for MCP server tool handlers and formatters.
 */

export interface PatternRow {
  id: string;
  name: string;
  category: string;
  description?: string;
  when_to_use?: string;
  benefits?: string;
  drawbacks?: string;
  use_cases?: string;
  complexity?: string;
  /**
   * JSON-encoded string array of tags (database representation).
   * Use `parseTags()` to convert to `string[]` for display or filtering.
   * Other list-shaped fields (when_to_use, benefits, drawbacks, use_cases)
   * follow the same JSON-string convention.
   */
  tags?: string;
  examples?: string;
  created_at?: string;
}

export interface PatternExample {
  language: string;
  code: string;
  description?: string;
  explanation?: string;
}

export interface PatternImplementation {
  language: string;
  code: string;
  explanation?: string;
}

export interface CountResult {
  count: number;
}

export interface SearchPatternResult {
  pattern: {
    id: string;
    name: string;
    category: string;
    description: string;
    complexity?: string;
    tags?: string[];
  };
  score: number;
}
