/**
 * Shared interfaces for test utilities
 * Provides common interfaces used across multiple test files
 */

export interface PatternRow {
  id: number;
  name: string;
  category: string;
  description: string;
  examples?: string[];
  context?: string;
  implementation?: string;
  benefits?: string[];
  tradeoffs?: string[];
  related_patterns?: string[];
}

export interface PatternColumnInfo {
  name: string;
  type: string;
  nullable: number;
  dflt_value: unknown;
}

export interface ExamplesField {
  [patternId: string]: unknown;
}

export interface TableInfo {
  name: string;
  type: string;
  tbl_name: string;
  rootpage: number;
  sql: string;
  columns?: PatternColumnInfo[];
}

// Test result interfaces for different pattern types
export interface TestResultBase<T> {
  id: number;
  name: string;
  description?: string;
  examples?: string | string[] | T;
}

export interface SimplePatternResult extends TestResultBase<void> {
  category: string;
  context?: string;
}

export interface ComplexPatternResult extends TestResultBase<Record<string, unknown>> {
  category: string;
  context?: string;
  implementation?: string;
  benefits?: string[];
  tradeoffs?: string[];
  related_patterns?: string[];
}

export interface AIPatternResult extends ComplexPatternResult {
  ai_type?: string;
}

export interface ArchitecturalPatternResult extends ComplexPatternResult {
  layer?: string;
}

export interface CloudPatternResult extends ComplexPatternResult {
  cloud_provider?: string;
  service_category?: string;
}

export interface MCPServerInstance {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  initialize: () => Promise<void>;
}

export interface MigrationRecord {
  id: string;
  checksum: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface TableName {
  name: string;
}