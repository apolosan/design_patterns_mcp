/**
 * Tests for Pattern Composition Engine
 * Validates pattern composition rules and anti-pattern detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PatternCompositionEngine } from '../../src/services/pattern-composition-engine';
import { Pattern } from '../../src/models/pattern';

describe('PatternCompositionEngine', () => {
  let compositionEngine: PatternCompositionEngine;

  beforeEach(() => {
    compositionEngine = new PatternCompositionEngine();
  });

  describe('analyzeComposition', () => {
    it('should validate compatible pattern combinations', () => {
      const patterns = createMockPatterns(['Factory Method', 'Abstract Factory']);
      const result = compositionEngine.analyzeComposition(patterns);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(80);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect incompatible pattern combinations', () => {
      const patterns = createMockPatterns(['Singleton', 'Prototype']);
      const result = compositionEngine.analyzeComposition(patterns);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].severity).toBe('high');
    });

    it('should provide recommendations for pattern improvements', () => {
      const patterns = createMockPatterns(['Factory Method']);
      const result = compositionEngine.analyzeComposition(patterns);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0].type).toBe('add');
    });

    it('should identify pattern synergies', () => {
      const patterns = createMockPatterns(['Observer', 'Mediator']);
      const result = compositionEngine.analyzeComposition(patterns);

      expect(result.synergies.length).toBeGreaterThan(0);
      expect(result.synergies[0].patterns).toContain('Observer');
      expect(result.synergies[0].patterns).toContain('Mediator');
    });

    it('should calculate composition score correctly', () => {
      const compatiblePatterns = createMockPatterns(['Factory Method', 'Abstract Factory']);
      const incompatiblePatterns = createMockPatterns(['Singleton', 'Prototype']);

      const compatibleResult = compositionEngine.analyzeComposition(compatiblePatterns);
      const incompatibleResult = compositionEngine.analyzeComposition(incompatiblePatterns);

      expect(compatibleResult.score).toBeGreaterThan(incompatibleResult.score);
    });
  });

  describe('detectAntiPatterns', () => {
    it('should detect pattern overload', () => {
      const patterns = createMockPatterns([
        'Singleton', 'Factory Method', 'Abstract Factory', 'Builder', 'Prototype',
        'Adapter', 'Decorator', 'Facade', 'Observer'
      ]);

      const antiPatterns = compositionEngine.detectAntiPatterns(patterns);

      expect(antiPatterns.some(ap => ap.antiPattern === 'Pattern Overload')).toBe(true);
      expect(antiPatterns.some(ap => ap.severity === 'high')).toBe(true);
    });

    it('should detect pattern conflicts', () => {
      const patterns = createMockPatterns(['Singleton', 'Prototype', 'Factory Method']);

      const antiPatterns = compositionEngine.detectAntiPatterns(patterns);

      expect(antiPatterns.some(ap => ap.antiPattern === 'Pattern Conflict')).toBe(true);
    });

    it('should detect pattern redundancy', () => {
      const patterns = createMockPatterns(['Factory Method', 'Abstract Factory', 'Builder']);

      const antiPatterns = compositionEngine.detectAntiPatterns(patterns);

      expect(antiPatterns.some(ap => ap.antiPattern === 'Pattern Redundancy')).toBe(true);
    });

    it('should detect pattern misuse', () => {
      const patterns = createMockPatterns(['Singleton']);
      patterns[0].description = 'Singleton pattern for testing purposes';

      const antiPatterns = compositionEngine.detectAntiPatterns(patterns);

      expect(antiPatterns.some(ap => ap.antiPattern === 'Singleton in Tests')).toBe(true);
    });
  });

  describe('suggestPatternCombinations', () => {
    it('should suggest patterns for object creation problems', () => {
      const suggestions = compositionEngine.suggestPatternCombinations(
        'object creation',
        'performance'
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].patterns.length).toBeGreaterThan(1);
      expect(suggestions[0].confidence).toBeGreaterThan(0.7);
    });

    it('should suggest patterns for structural organization', () => {
      const suggestions = compositionEngine.suggestPatternCombinations(
        'structural organization',
        'legacy integration'
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.patterns.includes('Adapter'))).toBe(true);
      expect(suggestions.some(s => s.patterns.includes('Facade'))).toBe(true);
    });

    it('should suggest patterns for behavioral coordination', () => {
      const suggestions = compositionEngine.suggestPatternCombinations(
        'behavior coordination',
        'event handling'
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.patterns.includes('Observer'))).toBe(true);
      expect(suggestions.some(s => s.patterns.includes('Command'))).toBe(true);
    });

    it('should provide context-aware suggestions', () => {
      const performanceSuggestions = compositionEngine.suggestPatternCombinations(
        'memory management',
        'performance'
      );

      expect(performanceSuggestions.some(s => 
        s.patterns.includes('Flyweight') || s.patterns.includes('Object Pool')
      )).toBe(true);
    });
  });

  describe('validatePatternSequence', () => {
    it('should validate correct pattern sequence', () => {
      const patterns = createMockPatterns(['Factory Method', 'Abstract Factory', 'Builder']);
      const result = compositionEngine.validatePatternSequence(patterns);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect prerequisite violations', () => {
      const patterns = createMockPatterns(['Abstract Factory']); // Missing Factory Method prerequisite
      const result = compositionEngine.validatePatternSequence(patterns);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should suggest optimal ordering', () => {
      const patterns = createMockPatterns(['Builder', 'Factory Method', 'Abstract Factory']);
      const result = compositionEngine.validatePatternSequence(patterns);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]).toContain('Factory Method');
    });
  });

  describe('edge cases', () => {
    it('should handle empty pattern list', () => {
      const result = compositionEngine.analyzeComposition([]);

      expect(result.isValid).toBe(true);
      expect(result.score).toBe(100);
      expect(result.violations).toHaveLength(0);
    });

    it('should handle single pattern', () => {
      const patterns = createMockPatterns(['Singleton']);
      const result = compositionEngine.analyzeComposition(patterns);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should handle unknown patterns', () => {
      const patterns = createMockPatterns(['Unknown Pattern']);
      const result = compositionEngine.analyzeComposition(patterns);

      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('composition rules', () => {
    it('should apply singleton-prototype conflict rule', () => {
      const patterns = createMockPatterns(['Singleton', 'Prototype']);
      const result = compositionEngine.analyzeComposition(patterns);

      expect(result.violations.some(v => 
        v.rule.id === 'singleton-prototype-conflict'
      )).toBe(true);
    });

    it('should apply factory-abstract-factory recommendation', () => {
      const patterns = createMockPatterns(['Factory Method', 'Abstract Factory']);
      const result = compositionEngine.analyzeComposition(patterns);

      expect(result.synergies.some(s => 
        s.patterns.includes('Factory Method') && s.patterns.includes('Abstract Factory')
      )).toBe(true);
    });
  });

  describe('performance and scalability', () => {
    it('should handle large pattern sets efficiently', () => {
      const patterns = createMockPatterns([
        'Singleton', 'Factory Method', 'Abstract Factory', 'Builder', 'Prototype',
        'Adapter', 'Bridge', 'Composite', 'Decorator', 'Facade', 'Flyweight', 'Proxy',
        'Chain of Responsibility', 'Command', 'Iterator', 'Mediator', 'Memento', 'Observer',
        'State', 'Strategy', 'Template Method', 'Visitor'
      ]);

      const startTime = performance.now();
      const result = compositionEngine.analyzeComposition(patterns);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
      expect(result).toBeDefined();
    });

    it('should cache results for repeated analysis', () => {
      const patterns = createMockPatterns(['Factory Method', 'Abstract Factory']);

      const startTime1 = performance.now();
      const result1 = compositionEngine.analyzeComposition(patterns);
      const endTime1 = performance.now();

      const startTime2 = performance.now();
      const result2 = compositionEngine.analyzeComposition(patterns);
      const endTime2 = performance.now();

      // Second call should be faster (cached)
      expect(endTime2 - startTime2).toBeLessThanOrEqual(endTime1 - startTime1);
      expect(result1.score).toBe(result2.score);
    });
  });
});

/**
 * Helper function to create mock patterns for testing
 */
function createMockPatterns(patternNames: string[]): Pattern[] {
  return patternNames.map((name, index) => ({
    id: `pattern-${index}`,
    name,
    category: getPatternCategory(name),
    description: `Mock ${name} pattern for testing`,
    problem: `Test problem for ${name}`,
    solution: `Test solution for ${name}`,
    when_to_use: [`When you need ${name.toLowerCase()}`],
    benefits: [`Benefit 1 of ${name}`, `Benefit 2 of ${name}`],
    drawbacks: [`Drawback 1 of ${name}`],
    use_cases: [`Use case 1 for ${name}`],
    implementations: [],
    complexity: 'Medium',
    tags: [name.toLowerCase(), 'test'],
    createdAt: new Date(),
    updatedAt: new Date(),
    relationships: [],
    examples: '',
    popularity: 0.5,
    relatedPatterns: [],
    related_patterns: [],
    structure: '',
    participants: [],
    collaborations: [],
    consequences: [],
    implementation: '',
    useCases: [],
    alsoKnownAs: [],
    metadata: {},
  }));
}

/**
 * Helper function to get pattern category by name
 */
function getPatternCategory(patternName: string): string {
  const creational = ['Singleton', 'Factory Method', 'Abstract Factory', 'Builder', 'Prototype'];
  const structural = ['Adapter', 'Bridge', 'Composite', 'Decorator', 'Facade', 'Flyweight', 'Proxy'];
  const behavioral = [
    'Chain of Responsibility', 'Command', 'Iterator', 'Mediator', 'Memento',
    'Observer', 'State', 'Strategy', 'Template Method', 'Visitor'
  ];

  if (creational.includes(patternName)) return 'creational';
  if (structural.includes(patternName)) return 'structural';
  if (behavioral.includes(patternName)) return 'behavioral';
  
  return 'other';
}