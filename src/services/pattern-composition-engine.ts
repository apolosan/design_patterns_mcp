/**
 * Pattern Composition Engine
 * Validates pattern composition rules and detects anti-patterns
 * Provides intelligent pattern combination recommendations
 */

import { Pattern } from '../models/pattern';
import { PatternAnalyzer } from './pattern-analyzer';

export interface CompositionRule {
  id: string;
  name: string;
  description: string;
  patterns: string[];
  relationship: 'compatible' | 'incompatible' | 'recommended' | 'cautionary';
  reason: string;
  severity: 'low' | 'medium' | 'high';
  category: 'structural' | 'behavioral' | 'creational' | 'architectural';
}

export interface CompositionResult {
  isValid: boolean;
  score: number;
  violations: RuleViolation[];
  recommendations: CompositionRecommendation[];
  warnings: CompositionWarning[];
  synergies: PatternSynergy[];
}

export interface RuleViolation {
  rule: CompositionRule;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export interface CompositionRecommendation {
  type: 'add' | 'remove' | 'replace' | 'reorder';
  pattern: string;
  reason: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
}

export interface CompositionWarning {
  pattern: string;
  warning: string;
  severity: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface PatternSynergy {
  patterns: string[];
  benefit: string;
  confidence: number;
  examples: string[];
}

export interface AntiPatternDetection {
  antiPattern: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  location?: string;
  fix: string;
  prevention: string;
}

export class PatternCompositionEngine {
  private readonly patternAnalyzer: PatternAnalyzer;
  private readonly compositionRules: CompositionRule[];
  private readonly compatibilityMatrix: Map<string, Map<string, number>>;

  constructor() {
    this.patternAnalyzer = new PatternAnalyzer();
    this.compositionRules = this.initializeCompositionRules();
    this.compatibilityMatrix = this.initializeCompatibilityMatrix();
  }

  /**
   * Analyze pattern composition for validity and recommendations
   */
  analyzeComposition(patterns: Pattern[]): CompositionResult {
    const patternNames = patterns.map(p => p.name);
    const violations = this.detectViolations(patternNames);
    const recommendations = this.generateRecommendations(patterns);
    const warnings = this.detectWarnings(patterns);
    const synergies = this.identifySynergies(patternNames);
    const score = this.calculateCompositionScore(patterns, violations, synergies);

    return {
      isValid: violations.filter(v => v.severity === 'high').length === 0,
      score,
      violations,
      recommendations,
      warnings,
      synergies,
    };
  }

  /**
   * Detect anti-patterns in pattern composition
   */
  detectAntiPatterns(patterns: Pattern[]): AntiPatternDetection[] {
    const antiPatterns: AntiPatternDetection[] = [];
    const patternNames = patterns.map(p => p.name);

    // Check for pattern overload
    if (patterns.length > 8) {
      antiPatterns.push({
        antiPattern: 'Pattern Overload',
        severity: 'high',
        description: 'Too many patterns applied simultaneously',
        location: 'Architecture',
        fix: 'Reduce to 3-5 essential patterns',
        prevention: 'Focus on core problems each pattern solves',
      });
    }

    // Check for conflicting patterns
    const conflictingPairs = this.findConflictingPatterns(patternNames);
    for (const [pattern1, pattern2] of conflictingPairs) {
      antiPatterns.push({
        antiPattern: 'Pattern Conflict',
        severity: 'medium',
        description: `${pattern1} and ${pattern2} may conflict`,
        location: `${pattern1} + ${pattern2}`,
        fix: 'Choose one or refactor to avoid conflict',
        prevention: 'Validate pattern compatibility before implementation',
      });
    }

    // Check for redundant patterns
    const redundantPatterns = this.findRedundantPatterns(patterns);
    for (const pattern of redundantPatterns) {
      antiPatterns.push({
        antiPattern: 'Pattern Redundancy',
        severity: 'low',
        description: `${pattern} may be redundant with other patterns`,
        location: pattern,
        fix: 'Consider removing or consolidating',
        prevention: 'Ensure each pattern serves a unique purpose',
      });
    }

    // Check for pattern misuse
    for (const pattern of patterns) {
      const misuse = this.detectPatternMisuse(pattern);
      if (misuse) {
        antiPatterns.push(misuse);
      }
    }

    return antiPatterns;
  }

  /**
   * Suggest optimal pattern combinations for specific problems
   */
  suggestPatternCombinations(problem: string, context: string): PatternSynergy[] {
    const suggestions: PatternSynergy[] = [];

    // Problem-specific pattern combinations
    const problemMappings = {
      'object creation': [
        {
          patterns: ['Factory Method', 'Abstract Factory'],
          benefit: 'Flexible object creation with families of related objects',
          confidence: 0.9,
          examples: ['UI widget creation', 'Database connection management'],
        },
        {
          patterns: ['Builder', 'Prototype'],
          benefit: 'Complex object construction with cloning capabilities',
          confidence: 0.8,
          examples: ['Configuration objects', 'Document builders'],
        },
      ],
      'structural organization': [
        {
          patterns: ['Adapter', 'Facade'],
          benefit: 'Legacy system integration with simplified interface',
          confidence: 0.85,
          examples: ['API integration', 'Legacy code wrapping'],
        },
        {
          patterns: ['Decorator', 'Composite'],
          benefit: 'Dynamic feature addition with tree structures',
          confidence: 0.8,
          examples: ['UI components', 'File system operations'],
        },
      ],
      'behavior coordination': [
        {
          patterns: ['Observer', 'Command'],
          benefit: 'Event-driven architecture with undoable actions',
          confidence: 0.9,
          examples: ['GUI applications', 'Transaction systems'],
        },
        {
          patterns: ['Strategy', 'State'],
          benefit: 'Algorithm selection with state-based behavior',
          confidence: 0.85,
          examples: ['Game AI', 'Workflow engines'],
        },
      ],
    };

    // Context-aware suggestions
    if (context.includes('performance')) {
      suggestions.push({
        patterns: ['Flyweight', 'Object Pool'],
        benefit: 'Memory optimization for large numbers of similar objects',
        confidence: 0.8,
        examples: ['Game entities', 'Text characters'],
      });
    }

    if (context.includes('scalability')) {
      suggestions.push({
        patterns: ['Proxy', 'Observer'],
        benefit: 'Lazy loading with reactive updates',
        confidence: 0.75,
        examples: ['Image loading', 'Data synchronization'],
      });
    }

    // Add problem-specific suggestions
    const problemLower = problem.toLowerCase();
    for (const [key, mappings] of Object.entries(problemMappings)) {
      if (problemLower.includes(key)) {
        suggestions.push(...mappings);
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Validate pattern sequence and dependencies
   */
  validatePatternSequence(patterns: Pattern[]): {
    isValid: boolean;
    errors: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const suggestions: string[] = [];
    const patternNames = patterns.map(p => p.name);

    // Check for prerequisite patterns
    const prerequisites = this.getPatternPrerequisites();
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const required = prerequisites.get(pattern.name) ?? [];
      
      for (const req of required) {
        if (!patternNames.slice(0, i).includes(req)) {
          errors.push(`${pattern.name} requires ${req} to be implemented first`);
        }
      }
    }

    // Check for optimal ordering
    const optimalOrder = this.getOptimalPatternOrder(patternNames);
    if (!this.arraysEqual(patternNames, optimalOrder)) {
      suggestions.push(`Consider reordering: ${optimalOrder.join(' → ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions,
    };
  }

  /**
   * Private helper methods
   */
  private detectViolations(patternNames: string[]): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const rule of this.compositionRules) {
      if (this.ruleApplies(rule, patternNames)) {
        violations.push({
          rule,
          severity: rule.severity,
          description: rule.description,
          suggestion: this.generateSuggestion(rule),
        });
      }
    }

    return violations;
  }

  private generateRecommendations(patterns: Pattern[]): CompositionRecommendation[] {
    const recommendations: CompositionRecommendation[] = [];
    const patternNames = patterns.map(p => p.name);

    // Check for missing complementary patterns
    for (const pattern of patterns) {
      const complementary = this.getComplementaryPatterns(pattern.name);
      for (const comp of complementary) {
        if (!patternNames.includes(comp)) {
          recommendations.push({
            type: 'add',
            pattern: comp,
            reason: `${comp} complements ${pattern.name} for better design`,
            confidence: 0.7,
            impact: 'medium',
          });
        }
      }
    }

    return recommendations;
  }

  private detectWarnings(patterns: Pattern[]): CompositionWarning[] {
    const warnings: CompositionWarning[] = [];

    // Complexity warnings
    if (patterns.length > 5) {
      warnings.push({
        pattern: 'Architecture',
        warning: 'High pattern complexity may impact maintainability',
        severity: 'medium',
        mitigation: 'Consider simplifying or documenting thoroughly',
      });
    }

    // Category imbalance warnings
    const categories = this.countPatternCategories(patterns);
    const maxCategory = Math.max(...Object.values(categories));
    if (maxCategory > patterns.length * 0.6) {
      warnings.push({
        pattern: 'Category Balance',
        warning: 'Imbalanced pattern categories detected',
        severity: 'low',
        mitigation: 'Consider patterns from other categories',
      });
    }

    return warnings;
  }

  private identifySynergies(patternNames: string[]): PatternSynergy[] {
    const synergies: PatternSynergy[] = [];

    // Known synergistic combinations
    const knownSynergies = [
      {
        patterns: ['Factory Method', 'Abstract Factory'],
        benefit: 'Hierarchical object creation with family support',
        confidence: 0.9,
        examples: ['UI frameworks', 'Database access layers'],
      },
      {
        patterns: ['Observer', 'Mediator'],
        benefit: 'Decoupled communication with central coordination',
        confidence: 0.85,
        examples: ['Chat systems', 'Event brokers'],
      },
      {
        patterns: ['Adapter', 'Decorator'],
        benefit: 'Interface adaptation with dynamic feature addition',
        confidence: 0.8,
        examples: ['Plugin systems', 'Legacy modernization'],
      },
    ];

    for (const synergy of knownSynergies) {
      if (synergy.patterns.every(p => patternNames.includes(p))) {
        synergies.push(synergy);
      }
    }

    return synergies;
  }

  private calculateCompositionScore(
    patterns: Pattern[],
    violations: RuleViolation[],
    synergies: PatternSynergy[]
  ): number {
    let score = 100;

    // Deduct points for violations
    for (const violation of violations) {
      switch (violation.severity) {
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    // Add points for synergies
    score += synergies.length * 10;

    // Bonus for balanced categories
    const categories = this.countPatternCategories(patterns);
    const balance = 1 - Math.max(...Object.values(categories)) / patterns.length;
    score += balance * 10;

    return Math.max(0, Math.min(100, score));
  }

  private ruleApplies(rule: CompositionRule, patternNames: string[]): boolean {
    if (rule.relationship === 'incompatible') {
      return rule.patterns.every(p => patternNames.includes(p));
    }
    return false;
  }

  private generateSuggestion(rule: CompositionRule): string {
    switch (rule.relationship) {
      case 'incompatible':
        return `Avoid combining ${rule.patterns.join(' and ')}. Consider using ${rule.patterns[0]} or ${rule.patterns[1]} instead.`;
      default:
        return rule.reason;
    }
  }

  private getComplementaryPatterns(patternName: string): string[] {
    const complementary: Record<string, string[]> = {
      'Factory Method': ['Abstract Factory', 'Prototype'],
      'Observer': ['Mediator', 'Command'],
      'Adapter': ['Decorator', 'Facade'],
      'Strategy': ['State', 'Template Method'],
      'Builder': ['Prototype', 'Flyweight'],
    };

    return complementary[patternName] || [];
  }

  private countPatternCategories(patterns: Pattern[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    for (const pattern of patterns) {
      const category = pattern.category || 'other';
      categories[category] = (categories[category] || 0) + 1;
    }

    return categories;
  }

  private findConflictingPatterns(patternNames: string[]): [string, string][] {
    const conflicts: [string, string][] = [];
    
    // Known conflicting pattern pairs
    const conflictingPairs = [
      ['Singleton', 'Prototype'],
      ['Flyweight', 'Singleton'],
    ];

    for (const [pattern1, pattern2] of conflictingPairs) {
      if (patternNames.includes(pattern1) && patternNames.includes(pattern2)) {
        conflicts.push([pattern1, pattern2]);
      }
    }

    return conflicts;
  }

  private findRedundantPatterns(patterns: Pattern[]): string[] {
    const redundant: string[] = [];
    
    // Check for patterns with similar purposes
    const similarPatterns = [
      ['Factory Method', 'Abstract Factory'],
      ['Adapter', 'Decorator'],
    ];

    for (const [pattern1, pattern2] of similarPatterns) {
      const hasPattern1 = patterns.some(p => p.name === pattern1);
      const hasPattern2 = patterns.some(p => p.name === pattern2);
      
      if (hasPattern1 && hasPattern2) {
        redundant.push(pattern2); // Mark second as potentially redundant
      }
    }

    return redundant;
  }

  private detectPatternMisuse(pattern: Pattern): AntiPatternDetection | null {
    // Check for common pattern misuses
    if (pattern.name === 'Singleton' && pattern.description.includes('testing')) {
      return {
        antiPattern: 'Singleton in Tests',
        severity: 'medium',
        description: 'Singleton pattern can make testing difficult',
        location: pattern.name,
        fix: 'Use dependency injection instead',
        prevention: 'Avoid Singleton in testable code',
      };
    }

    if (pattern.name === 'Observer' && pattern.description.includes('performance')) {
      return {
        antiPattern: 'Observer Performance Issue',
        severity: 'low',
        description: 'Observer pattern may impact performance with many subscribers',
        location: pattern.name,
        fix: 'Consider event batching or filtering',
        prevention: 'Profile observer performance in production',
      };
    }

    return null;
  }

  private getPatternPrerequisites(): Map<string, string[]> {
    const prerequisites = new Map<string, string[]>();
    
    // Define pattern prerequisites
    prerequisites.set('Abstract Factory', ['Factory Method']);
    prerequisites.set('Decorator', ['Component']);
    prerequisites.set('Composite', ['Component']);

    return prerequisites;
  }

  private getOptimalPatternOrder(patternNames: string[]): string[] {
    // Define optimal ordering for common pattern combinations
    const orderings: Record<string, string[]> = {
      'creational': ['Singleton', 'Factory Method', 'Abstract Factory', 'Builder', 'Prototype'],
      'structural': ['Adapter', 'Bridge', 'Composite', 'Decorator', 'Facade', 'Flyweight', 'Proxy'],
      'behavioral': ['Chain of Responsibility', 'Command', 'Iterator', 'Mediator', 'Memento', 'Observer', 'State', 'Strategy', 'Template Method', 'Visitor'],
    };

    // Simple ordering by category
    const ordered: string[] = [];
    for (const category of ['creational', 'structural', 'behavioral']) {
      const categoryPatterns = orderings[category] || [];
      for (const pattern of categoryPatterns) {
        if (patternNames.includes(pattern)) {
          ordered.push(pattern);
        }
      }
    }

    // Add any remaining patterns
    for (const pattern of patternNames) {
      if (!ordered.includes(pattern)) {
        ordered.push(pattern);
      }
    }

    return ordered;
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((val, index) => val === b[index]);
  }

  private initializeCompositionRules(): CompositionRule[] {
    return [
      {
        id: 'singleton-prototype-conflict',
        name: 'Singleton-Prototype Conflict',
        description: 'Singleton and Prototype patterns have conflicting object management approaches',
        patterns: ['Singleton', 'Prototype'],
        relationship: 'incompatible',
        reason: 'Singleton ensures single instance while Prototype creates multiple instances through cloning',
        severity: 'high',
        category: 'creational',
      },
      {
        id: 'flyweight-singleton-caution',
        name: 'Flyweight-Singleton Caution',
        description: 'Flyweight and Singleton may conflict in object sharing strategy',
        patterns: ['Flyweight', 'Singleton'],
        relationship: 'cautionary',
        reason: 'Both patterns manage object instances differently - ensure clear separation of concerns',
        severity: 'medium',
        category: 'structural',
      },
      {
        id: 'factory-abstract-factory-recommended',
        name: 'Factory-Abstract Factory Recommendation',
        description: 'Factory Method and Abstract Factory work well together',
        patterns: ['Factory Method', 'Abstract Factory'],
        relationship: 'recommended',
        reason: 'Factory Method creates individual objects while Abstract Factory creates families of related objects',
        severity: 'low',
        category: 'creational',
      },
    ];
  }

  private initializeCompatibilityMatrix(): Map<string, Map<string, number>> {
    const matrix = new Map<string, Map<string, number>>();

    // Initialize compatibility scores between patterns
    const compatibilityScores: Record<string, Record<string, number>> = {
      'Factory Method': {
        'Abstract Factory': 0.9,
        'Builder': 0.7,
        'Prototype': 0.8,
        'Singleton': 0.6,
      },
      'Abstract Factory': {
        'Factory Method': 0.9,
        'Builder': 0.8,
        'Prototype': 0.7,
      },
      'Observer': {
        'Mediator': 0.85,
        'Command': 0.9,
        'Strategy': 0.7,
      },
      'Adapter': {
        'Decorator': 0.8,
        'Facade': 0.85,
        'Proxy': 0.7,
      },
    };

    // Convert to Map structure
    for (const [pattern1, scores] of Object.entries(compatibilityScores)) {
      const patternMap = new Map<string, number>();
      for (const [pattern2, score] of Object.entries(scores)) {
        patternMap.set(pattern2, score);
      }
      matrix.set(pattern1, patternMap);
    }

    return matrix;
  }
}