import { describe, test, expect } from 'vitest';
import {
  isPatternSummary,
  isMatchResult,
  isDetailedPattern,
  isPatternImplementation,
  isPatternRequest,
  isQueryAnalysis,
  isDynamicAlphaResult,
  isMatchResultArray,
  isDetailedPatternArray,
  isPatternImplementationArray,
} from '../../src/utils/domain-type-guards.js';

describe('Type Guards Utility', () => {
  describe('isPatternSummary', () => {
    test('validates correct PatternSummary', () => {
      const valid = {
        id: 'pattern-1',
        name: 'Singleton',
        category: 'Creational',
        description: 'Ensure a class has only one instance',
        complexity: 'Beginner',
        tags: ['pattern', 'creational'],
      };
      expect(isPatternSummary(valid)).toBe(true);
    });

    test('rejects invalid PatternSummary', () => {
      expect(isPatternSummary(null)).toBe(false);
      expect(isPatternSummary(undefined)).toBe(false);
      expect(isPatternSummary('string')).toBe(false);
      expect(isPatternSummary({ id: 123 })).toBe(false);
      expect(isPatternSummary({ id: '1', name: 123 })).toBe(false);
    });

    test('accepts missing optional fields', () => {
      const minimal = {
        id: 'pattern-1',
        name: 'Singleton',
        category: 'Creational',
        description: 'Description',
      };
      expect(isPatternSummary(minimal)).toBe(true);
    });
  });

  describe('isMatchResult', () => {
    test('validates correct MatchResult', () => {
      const valid = {
        pattern: {
          id: 'p1',
          name: 'Observer',
          category: 'Behavioral',
          description: 'Defines a one-to-many dependency',
        },
        confidence: 0.95,
        matchType: 'semantic' as const,
        reasons: ['High semantic similarity'],
        metadata: {
          semanticScore: 0.9,
          finalScore: 0.85,
        },
      };
      expect(isMatchResult(valid)).toBe(true);
    });

    test('rejects invalid match types', () => {
      const invalid = {
        pattern: { id: 'p1', name: 'Test', category: 'Test', description: 'Test' },
        confidence: 0.5,
        matchType: 'invalid' as const,
        reasons: [],
        metadata: { finalScore: 0.5 },
      };
      expect(isMatchResult(invalid)).toBe(false);
    });

    test('rejects non-objects', () => {
      expect(isMatchResult(null)).toBe(false);
      expect(isMatchResult([])).toBe(false);
      expect(isMatchResult('string')).toBe(false);
    });
  });

  describe('isDetailedPattern', () => {
    test('validates correct DetailedPattern', () => {
      const valid = {
        id: 'pattern-1',
        name: 'Factory Method',
        category: 'Creational',
        description: 'Define an interface for creating an object',
        when_to_use: ['When a class cannot anticipate the class of objects it must create'],
        benefits: ['Provides flexibility', 'Eliminates binding'],
        drawbacks: ['May introduce unnecessary complexity'],
        use_cases: ['Object creation', 'Plugin systems'],
        complexity: 'Intermediate',
        tags: ['creational', 'design'],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      expect(isDetailedPattern(valid)).toBe(true);
    });
  });

  describe('isPatternImplementation', () => {
    test('validates correct PatternImplementation', () => {
      const valid = {
        id: 'impl-1',
        language: 'TypeScript',
        code: 'class Singleton { }',
        explanation: 'TypeScript implementation example',
      };
      expect(isPatternImplementation(valid)).toBe(true);
    });
  });

  describe('isPatternRequest', () => {
    test('validates correct PatternRequest', () => {
      const valid = {
        id: 'req-1',
        query: 'How to create objects?',
        categories: ['Creational'],
        maxResults: 10,
        programmingLanguage: 'TypeScript',
      };
      expect(isPatternRequest(valid)).toBe(true);
    });

    test('accepts minimal request', () => {
      const minimal = {
        id: 'req-1',
        query: 'pattern search',
      };
      expect(isPatternRequest(minimal)).toBe(true);
    });
  });

  describe('isQueryAnalysis', () => {
    test('validates correct QueryAnalysis', () => {
      const valid = {
        queryLength: 50,
        wordCount: 8,
        technicalTermCount: 2,
        exploratoryScore: 0.3,
        specificityScore: 0.7,
        hasCodeSnippet: false,
        entropy: 0.5,
      };
      expect(isQueryAnalysis(valid)).toBe(true);
    });
  });

  describe('isDynamicAlphaResult', () => {
    test('validates correct DynamicAlphaResult', () => {
      const valid = {
        semanticAlpha: 0.7,
        keywordAlpha: 0.3,
        queryType: 'specific' as const,
        confidence: 0.85,
        analysis: {
          queryLength: 50,
          wordCount: 8,
          technicalTermCount: 2,
          exploratoryScore: 0.3,
          specificityScore: 0.7,
          hasCodeSnippet: false,
          entropy: 0.5,
        },
      };
      expect(isDynamicAlphaResult(valid)).toBe(true);
    });
  });

  describe('Array validators', () => {
    test('isMatchResultArray validates arrays', () => {
      const valid = [
        {
          pattern: { id: 'p1', name: 'Test', category: 'Test', description: 'Test' },
          confidence: 0.5,
          matchType: 'semantic' as const,
          reasons: [],
          metadata: { finalScore: 0.5 },
        },
      ];
      expect(isMatchResultArray(valid)).toBe(true);
      expect(isMatchResultArray([])).toBe(true);
      expect(isMatchResultArray([{ invalid: true }])).toBe(false);
    });

    test('isDetailedPatternArray validates arrays', () => {
      const valid = [
        {
          id: 'p1',
          name: 'Test',
          category: 'Test',
          description: 'Test',
          when_to_use: [],
          benefits: [],
          drawbacks: [],
          use_cases: [],
          complexity: 'Beginner',
          tags: [],
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      expect(isDetailedPatternArray(valid)).toBe(true);
      expect(isDetailedPatternArray([{}])).toBe(false);
    });

    test('isPatternImplementationArray validates arrays', () => {
      const valid = [
        { id: 'i1', language: 'TS', code: '', explanation: '' },
      ];
      expect(isPatternImplementationArray(valid)).toBe(true);
    });
  });
});
