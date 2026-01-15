/** MCP Tool Argument Types & Guards */
import { PreferenceValue } from '../models/preference.js';

export interface SuggestPatternArgs {
  query: string;
  code_context?: string;
  programming_language?: string;
  max_results?: number;
  include_examples?: boolean;
  category_filter?: string[];
}

export function isSuggestPatternArgs(args: unknown): args is SuggestPatternArgs {
  if (typeof args !== 'object' || args === null) return false;
  const a = args as Record<string, unknown>;
  return typeof a.query === 'string' &&
    (a.code_context === undefined || typeof a.code_context === 'string') &&
    (a.programming_language === undefined || typeof a.programming_language === 'string') &&
    (a.max_results === undefined || typeof a.max_results === 'number') &&
    (a.include_examples === undefined || typeof a.include_examples === 'boolean') &&
    (a.category_filter === undefined || Array.isArray(a.category_filter));
}

export interface AnalyzeCodeArgs {
  code: string;
  language: string;
  analysis_type?: 'identify_patterns' | 'suggest_improvements' | 'both';
}

export function isAnalyzeCodeArgs(args: unknown): args is AnalyzeCodeArgs {
  if (typeof args !== 'object' || args === null) return false;
  const a = args as Record<string, unknown>;
  return typeof a.code === 'string' &&
    typeof a.language === 'string' &&
    (a.analysis_type === undefined || ['identify_patterns', 'suggest_improvements', 'both'].includes(a.analysis_type as string));
}

export interface SearchPatternsArgs {
  query: string;
  search_type?: 'keyword' | 'semantic' | 'hybrid';
  category_filter?: string[];
  limit?: number;
}

export function isSearchPatternsArgs(args: unknown): args is SearchPatternsArgs {
  if (typeof args !== 'object' || args === null) return false;
  const a = args as Record<string, unknown>;
  return typeof a.query === 'string' &&
    (a.search_type === undefined || ['keyword', 'semantic', 'hybrid'].includes(a.search_type as string)) &&
    (a.category_filter === undefined || Array.isArray(a.category_filter)) &&
    (a.limit === undefined || typeof a.limit === 'number');
}

export interface UpdatePatternArgs {
  pattern_id?: string;
  name: string;
  category: 'Creational' | 'Structural' | 'Behavioral' | 'Architectural' | 'Cloud-Native' | 'Microservices' | 'AI-ML' | 'Functional' | 'Reactive' | 'Anti-Pattern';
  description: string;
  problem: string;
  solution: string;
  use_cases: string;
  complexity: 'Beginner' | 'Intermediate' | 'Advanced';
}

export function isUpdatePatternArgs(args: unknown): args is UpdatePatternArgs {
  if (typeof args !== 'object' || args === null) return false;
  const a = args as Record<string, unknown>;
  return typeof a.name === 'string' &&
    typeof a.category === 'string' &&
    ['Creational', 'Structural', 'Behavioral', 'Architectural', 'Cloud-Native', 'Microservices', 'AI-ML', 'Functional', 'Reactive', 'Anti-Pattern'].includes(a.category) &&
    typeof a.description === 'string' &&
    typeof a.problem === 'string' &&
    typeof a.solution === 'string' &&
    typeof a.use_cases === 'string' &&
    ['Beginner', 'Intermediate', 'Advanced'].includes(a.complexity as string) &&
    (a.pattern_id === undefined || typeof a.pattern_id === 'string');
}

export interface GetConfigArgs {
  category?: 'all' | 'search' | 'display' | 'llm' | 'performance';
}

export function isGetConfigArgs(args: unknown): args is GetConfigArgs {
  if (typeof args !== 'object' || args === null) return false;
  const a = args as Record<string, unknown>;
  return a.category === undefined || ['all', 'search', 'display', 'llm', 'performance'].includes(a.category as string);
}

export interface SetConfigArgs {
  settings: Record<string, PreferenceValue>;
  category: 'search' | 'display' | 'llm' | 'performance';
}

export function isSetConfigArgs(args: unknown): args is SetConfigArgs {
  if (typeof args !== 'object' || args === null) return false;
  const a = args as Record<string, unknown>;
  return typeof a.category === 'string' &&
    ['search', 'display', 'llm', 'performance'].includes(a.category) &&
    typeof a.settings === 'object' && a.settings !== null;
}

export interface CountPatternsArgs {
  includeDetails?: boolean;
}

export function isCountPatternsArgs(args: unknown): args is CountPatternsArgs {
  if (typeof args !== 'object' || args === null) return false;
  const a = args as Record<string, unknown>;
  return a.includeDetails === undefined || typeof a.includeDetails === 'boolean';
}

export interface CreateRelationshipArgs {
  source_pattern_id: string;
  target_pattern_id: string;
  type: 'related' | 'extends' | 'implements' | 'uses' | 'similar' | 'alternative' | 'complements' | 'conflicts' | 'prerequisite' | 'successor';
  strength?: number;
  description: string;
}

export function isCreateRelationshipArgs(args: unknown): args is CreateRelationshipArgs {
  if (typeof args !== 'object' || args === null) return false;
  const a = args as Record<string, unknown>;
  return typeof a.source_pattern_id === 'string' &&
    typeof a.target_pattern_id === 'string' &&
    ['related', 'extends', 'implements', 'uses', 'similar', 'alternative', 'complements', 'conflicts', 'prerequisite', 'successor'].includes(a.type as string) &&
    typeof a.description === 'string' &&
    (a.strength === undefined || typeof a.strength === 'number');
}

export interface GetRelationshipsArgs {
  pattern_id?: string;
  type?: 'related' | 'extends' | 'implements' | 'uses' | 'similar' | 'alternative' | 'complements' | 'conflicts' | 'prerequisite' | 'successor';
  min_strength?: number;
  include_pattern_details?: boolean;
  limit?: number;
}

export function isGetRelationshipsArgs(args: unknown): args is GetRelationshipsArgs {
  if (typeof args !== 'object' || args === null) return false;
  const a = args as Record<string, unknown>;
  return (a.pattern_id === undefined || typeof a.pattern_id === 'string') &&
    (a.type === undefined || ['related', 'extends', 'implements', 'uses', 'similar', 'alternative', 'complements', 'conflicts', 'prerequisite', 'successor'].includes(a.type as string)) &&
    (a.min_strength === undefined || typeof a.min_strength === 'number') &&
    (a.include_pattern_details === undefined || typeof a.include_pattern_details === 'boolean') &&
    (a.limit === undefined || typeof a.limit === 'number');
}

export interface UpdateRelationshipArgs {
  relationship_id: string;
  type?: 'related' | 'extends' | 'implements' | 'uses' | 'similar' | 'alternative' | 'complements' | 'conflicts' | 'prerequisite' | 'successor';
  strength?: number;
  description?: string;
}

export function isUpdateRelationshipArgs(args: unknown): args is UpdateRelationshipArgs {
  if (typeof args !== 'object' || args === null) return false;
  const a = args as Record<string, unknown>;
  return typeof a.relationship_id === 'string' &&
    (a.type === undefined || ['related', 'extends', 'implements', 'uses', 'similar', 'alternative', 'complements', 'conflicts', 'prerequisite', 'successor'].includes(a.type as string)) &&
    (a.strength === undefined || typeof a.strength === 'number') &&
    (a.description === undefined || typeof a.description === 'string');
}

export interface DeleteRelationshipArgs {
  source_pattern_id: string;
  target_pattern_id: string;
}

export function isDeleteRelationshipArgs(args: unknown): args is DeleteRelationshipArgs {
  if (typeof args !== 'object' || args === null) return false;
  const a = args as Record<string, unknown>;
  return typeof a.source_pattern_id === 'string' && typeof a.target_pattern_id === 'string';
}
