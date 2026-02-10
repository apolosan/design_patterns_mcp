/**
 * Domain Type Guards Utility
 * Provides type guards for domain models in the Design Patterns MCP Server
 * Micro-utility: Type-safe runtime validation for domain objects
 */

import {
  PatternSummary,
  MatchResult,
  DetailedPattern,
  PatternImplementation,
  PatternRequest,
  QueryAnalysis,
  DynamicAlphaResult,
} from '../types/search-types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => isString(item));
}

export function isPatternSummary(value: unknown): value is PatternSummary {
  if (!isRecord(value)) return false;
  const r = value;
  return isString(r.id) &&
    isString(r.name) &&
    isString(r.category) &&
    isString(r.description) &&
    (r.complexity === undefined || isString(r.complexity)) &&
    (r.tags === undefined || isStringArray(r.tags));
}

export function isMatchResult(value: unknown): value is MatchResult {
  if (!isRecord(value)) return false;
  const r = value;
  return isPatternSummary(r.pattern) &&
    isNumber(r.confidence) &&
    isString(r.matchType) &&
    ['semantic', 'keyword', 'hybrid'].includes(r.matchType) &&
    isStringArray(r.reasons) &&
    isRecord(r.metadata) &&
    isNumber(r.metadata.finalScore);
}

export function isDetailedPattern(value: unknown): value is DetailedPattern {
  if (!isRecord(value)) return false;
  const r = value;
  return isString(r.id) &&
    isString(r.name) &&
    isString(r.category) &&
    isString(r.description) &&
    isStringArray(r.when_to_use) &&
    isStringArray(r.benefits) &&
    isStringArray(r.drawbacks) &&
    isStringArray(r.use_cases) &&
    isString(r.complexity) &&
    isStringArray(r.tags) &&
    isString(r.created_at) &&
    isString(r.updated_at);
}

export function isPatternImplementation(value: unknown): value is PatternImplementation {
  if (!isRecord(value)) return false;
  const r = value;
  return isString(r.id) &&
    isString(r.language) &&
    isString(r.code) &&
    isString(r.explanation);
}

export function isPatternRequest(value: unknown): value is PatternRequest {
  if (!isRecord(value)) return false;
  const r = value;
  return isString(r.id) &&
    isString(r.query) &&
    (r.categories === undefined || isStringArray(r.categories)) &&
    (r.maxResults === undefined || isNumber(r.maxResults)) &&
    (r.programmingLanguage === undefined || isString(r.programmingLanguage));
}

export function isQueryAnalysis(value: unknown): value is QueryAnalysis {
  if (!isRecord(value)) return false;
  const r = value;
  return isNumber(r.queryLength) &&
    isNumber(r.wordCount) &&
    isNumber(r.technicalTermCount) &&
    isNumber(r.exploratoryScore) &&
    isNumber(r.specificityScore) &&
    isBoolean(r.hasCodeSnippet) &&
    isNumber(r.entropy);
}

export function isDynamicAlphaResult(value: unknown): value is DynamicAlphaResult {
  if (!isRecord(value)) return false;
  const r = value;
  return isNumber(r.semanticAlpha) &&
    isNumber(r.keywordAlpha) &&
    isString(r.queryType) &&
    ['exploratory', 'specific', 'balanced'].includes(r.queryType) &&
    isNumber(r.confidence) &&
    isQueryAnalysis(r.analysis);
}

export function isMatchResultArray(value: unknown): value is MatchResult[] {
  return Array.isArray(value) && value.every(item => isMatchResult(item));
}

export function isDetailedPatternArray(value: unknown): value is DetailedPattern[] {
  return Array.isArray(value) && value.every(item => isDetailedPattern(item));
}

export function isPatternImplementationArray(value: unknown): value is PatternImplementation[] {
  return Array.isArray(value) && value.every(item => isPatternImplementation(item));
}
