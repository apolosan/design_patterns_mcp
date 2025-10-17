/**
 * Pattern Analyzer Service
 * Analyzes code snippets to detect design patterns and suggest improvements
 */

interface DetectedPattern {
  pattern: string;
  category: string;
  confidence: number;
  location?: {
    line?: number;
    column?: number;
    snippet?: string;
  };
  indicators: string[];
}

interface CodeAnalysisResult {
  identifiedPatterns: DetectedPattern[];
  suggestedPatterns: {
    pattern: string;
    reason: string;
    confidence: number;
  }[];
  improvements: string[];
  antiPatterns?: {
    pattern: string;
    reason: string;
    severity: 'low' | 'medium' | 'high';
  }[];
}

export class PatternAnalyzer {
  // Pattern detection rules for various languages
  private readonly patternIndicators = {
    // Creational Patterns
    Singleton: {
      keywords: ['getInstance', 'instance', 'private constructor', '_instance', 'singleton'],
      patterns: [
        /private\s+static\s+\w+\s+instance/i,
        /getInstance\s*\(\s*\)/i,
        /private\s+constructor\s*\(/i,
        /_instance\s*=\s*null/i,
      ],
    },
    'Factory Method': {
      keywords: ['createProduct', 'create', 'factory', 'makeProduct'],
      patterns: [
        /create\w+\s*\([^)]*\)\s*:\s*\w+/i,
        /factory\s*\([^)]*\)\s*{/i,
        /abstract\s+\w+\s+create/i,
        /make\w+\s*\([^)]*\)/i,
      ],
    },
    'Abstract Factory': {
      keywords: ['createProductA', 'createProductB', 'AbstractFactory'],
      patterns: [
        /abstract\s+class\s+\w*Factory/i,
        /createProduct[AB]\s*\(/i,
        /interface\s+\w*Factory/i,
      ],
    },
    Builder: {
      keywords: ['build', 'Builder', 'withField', 'addPart'],
      patterns: [
        /class\s+\w+Builder/i,
        /\.build\s*\(\s*\)/i,
        /with\w+\s*\([^)]*\)\s*:\s*this/i,
        /return\s+this/i,
      ],
    },
    Prototype: {
      keywords: ['clone', 'copy', 'duplicate', 'prototype'],
      patterns: [
        /clone\s*\(\s*\)\s*:/i,
        /Object\.create\(/i,
        /\.prototype\./i,
        /copy\s*\(\s*\)\s*:/i,
      ],
    },

    // Structural Patterns
    Adapter: {
      keywords: ['adapt', 'Adapter', 'wrapper', 'convert'],
      patterns: [/class\s+\w+Adapter/i, /implements\s+\w+Interface/i, /this\.\w+\s*=\s*new\s+\w+/i],
    },
    Decorator: {
      keywords: ['Decorator', 'wrapper', 'enhance', 'decorate'],
      patterns: [/class\s+\w+Decorator/i, /extends\s+\w+Decorator/i, /super\.\w+\(/i, /@\w+/],
    },
    Proxy: {
      keywords: ['Proxy', 'surrogate', 'placeholder'],
      patterns: [/class\s+\w+Proxy/i, /new\s+Proxy\(/i, /realSubject/i, /this\.\w+\.\w+\(/i],
    },
    Facade: {
      keywords: ['Facade', 'simplify', 'interface'],
      patterns: [/class\s+\w+Facade/i, /this\.\w+\s*=\s*new/i, /simplify\w+\(/i],
    },

    // Behavioral Patterns
    Observer: {
      keywords: ['subscribe', 'notify', 'observer', 'listener', 'addEventListener'],
      patterns: [
        /subscribe\s*\([^)]*\)/i,
        /notify\w*\s*\([^)]*\)/i,
        /addEventListener\s*\(/i,
        /on\w+\s*\([^)]*\)/i,
        /emit\s*\([^)]*\)/i,
      ],
    },
    Strategy: {
      keywords: ['Strategy', 'algorithm', 'setStrategy', 'execute'],
      patterns: [
        /class\s+\w+Strategy/i,
        /setStrategy\s*\(/i,
        /execute\w*\s*\(/i,
        /interface\s+Strategy/i,
      ],
    },
    Command: {
      keywords: ['Command', 'execute', 'undo', 'redo'],
      patterns: [
        /class\s+\w+Command/i,
        /execute\s*\(\s*\)/i,
        /undo\s*\(\s*\)/i,
        /interface\s+Command/i,
      ],
    },
    Iterator: {
      keywords: ['Iterator', 'next', 'hasNext', 'current'],
      patterns: [
        /class\s+\w+Iterator/i,
        /hasNext\s*\(\s*\)/i,
        /next\s*\(\s*\)/i,
        /\[Symbol\.iterator\]/i,
      ],
    },
    'Template Method': {
      keywords: ['template', 'abstract', 'hook', 'algorithm'],
      patterns: [/abstract\s+\w+\s*\(/i, /protected\s+abstract/i, /final\s+\w+\s*\(/i],
    },
  };

  // Anti-patterns to detect
  private readonly antiPatternIndicators = {
    'God Object': {
      indicators: ['too many methods', 'too many properties', 'high complexity'],
      threshold: { methods: 20, properties: 30 },
    },
    'Spaghetti Code': {
      indicators: ['deeply nested', 'goto', 'no structure'],
      threshold: { nestingLevel: 5 },
    },
    'Copy-Paste Programming': {
      indicators: ['duplicate code', 'similar blocks'],
      threshold: { duplicateLines: 10 },
    },
  };

  /**
   * Analyze code to detect patterns
   */
  async analyzeCode(code: string, language: string): Promise<CodeAnalysisResult> {
    const identifiedPatterns = this.detectPatterns(code, language);
    const suggestedPatterns = this.suggestPatterns(code, language, identifiedPatterns);
    const improvements = this.generateImprovements(code, language, identifiedPatterns);
    const antiPatterns = this.detectAntiPatterns(code, language);

    return {
      identifiedPatterns,
      suggestedPatterns,
      improvements,
      antiPatterns,
    };
  }

  /**
   * Detect existing patterns in code
   */
  private detectPatterns(code: string, language: string): DetectedPattern[] {
    const detected: DetectedPattern[] = [];
    const codeLines = code.split('\n');

    for (const [patternName, indicators] of Object.entries(this.patternIndicators)) {
      let confidence = 0;
      const foundIndicators: string[] = [];

      // Check keywords
      for (const keyword of indicators.keywords) {
        if (code.toLowerCase().includes(keyword.toLowerCase())) {
          confidence += 0.2;
          foundIndicators.push(`Found keyword: ${keyword}`);
        }
      }

      // Check regex patterns
      for (const pattern of indicators.patterns) {
        const match = code.match(pattern);
        if (match) {
          confidence += 0.3;
          foundIndicators.push(`Matched pattern: ${pattern.source}`);

          // Find line number
          const lineNum = this.findLineNumber(code, match.index || 0);
          if (lineNum > -1) {
            const location = {
              line: lineNum,
              snippet: codeLines[lineNum - 1]?.trim(),
            };

            if (confidence > 0.4) {
              detected.push({
                pattern: patternName,
                category: this.getPatternCategory(patternName),
                confidence: Math.min(confidence, 1.0),
                location,
                indicators: foundIndicators,
              });
            }
          }
        }
      }
    }

    return detected;
  }

  /**
   * Suggest patterns that could improve the code
   */
  private suggestPatterns(
    code: string,
    language: string,
    identifiedPatterns: DetectedPattern[]
  ): Array<{ pattern: string; reason: string; confidence: number }> {
    const suggestions = [];
    const identifiedNames = identifiedPatterns.map(p => p.pattern);

    // Suggest Singleton if there's global state management
    if (!identifiedNames.includes('Singleton')) {
      if (/global|static|instance/i.test(code)) {
        suggestions.push({
          pattern: 'Singleton',
          reason: 'Consider Singleton pattern for managing global state',
          confidence: 0.6,
        });
      }
    }

    // Suggest Factory if there's object creation logic
    if (!identifiedNames.includes('Factory Method')) {
      if (/new\s+\w+\(/g.test(code) && (code.match(/new\s+\w+\(/g) || []).length > 3) {
        suggestions.push({
          pattern: 'Factory Method',
          reason: 'Multiple object instantiations detected - consider Factory pattern',
          confidence: 0.7,
        });
      }
    }

    // Suggest Observer for event handling
    if (!identifiedNames.includes('Observer')) {
      if (/event|listener|callback|subscribe/i.test(code)) {
        suggestions.push({
          pattern: 'Observer',
          reason: 'Event handling code detected - Observer pattern could improve decoupling',
          confidence: 0.6,
        });
      }
    }

    // Suggest Strategy for conditional algorithms
    if (!identifiedNames.includes('Strategy')) {
      const ifCount = (code.match(/if\s*\(/g) || []).length;
      const switchCount = (code.match(/switch\s*\(/g) || []).length;
      if (ifCount > 5 || switchCount > 0) {
        suggestions.push({
          pattern: 'Strategy',
          reason: 'Complex conditional logic detected - Strategy pattern could simplify',
          confidence: 0.5,
        });
      }
    }

    // Suggest Builder for complex object construction
    if (!identifiedNames.includes('Builder')) {
      if (/constructor\s*\([^)]{50,}\)/i.test(code)) {
        suggestions.push({
          pattern: 'Builder',
          reason: 'Complex constructor detected - Builder pattern could improve readability',
          confidence: 0.7,
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovements(
    code: string,
    language: string,
    identifiedPatterns: DetectedPattern[]
  ): string[] {
    const improvements: string[] = [];

    // Check for missing error handling
    if (!/try\s*{|catch\s*\(|\.catch\s*\(/i.test(code)) {
      improvements.push('Add error handling to improve robustness');
    }

    // Check for missing comments
    const codeLines = code.split('\n').length;
    const commentLines = (code.match(/\/\/|\/\*|\*/g) || []).length;
    if (commentLines < codeLines * 0.1) {
      improvements.push('Add more comments to improve code documentation');
    }

    // Check for long methods
    const methodMatches = code.match(/function\s+\w+|[\w]+\s*\([^)]*\)\s*{/g) || [];
    if (methodMatches.length > 0) {
      const avgMethodLength = codeLines / methodMatches.length;
      if (avgMethodLength > 50) {
        improvements.push('Consider breaking down large methods into smaller, focused functions');
      }
    }

    // Pattern-specific improvements
    for (const pattern of identifiedPatterns) {
      if (pattern.pattern === 'Singleton' && pattern.confidence < 0.8) {
        improvements.push('Singleton implementation could be improved with thread safety');
      }
      if (pattern.pattern === 'Observer' && !/unsubscribe|removeListener/i.test(code)) {
        improvements.push('Observer pattern should include cleanup/unsubscribe mechanism');
      }
    }

    // Check for hardcoded values
    if (/["']\d+["']|["']\w+@\w+\.\w+["']/g.test(code)) {
      improvements.push('Consider extracting hardcoded values to configuration');
    }

    return improvements;
  }

  /**
   * Detect anti-patterns in code
   */
  private detectAntiPatterns(
    code: string,
    language: string
  ): Array<{ pattern: string; reason: string; severity: 'low' | 'medium' | 'high' }> {
    const antiPatterns: Array<{
      pattern: string;
      reason: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // Check for God Object
    const methodCount = (code.match(/function\s+\w+|[\w]+\s*\([^)]*\)\s*{/g) || []).length;
    const propertyCount = (code.match(/this\.\w+\s*=/g) || []).length;

    if (methodCount > 20 || propertyCount > 30) {
      antiPatterns.push({
        pattern: 'God Object',
        reason: `Class has ${methodCount} methods and ${propertyCount} properties - consider splitting responsibilities`,
        severity: 'high' as const,
      });
    }

    // Check for deeply nested code (Spaghetti Code indicator)
    const maxNesting = this.calculateMaxNesting(code);
    if (maxNesting > 5) {
      antiPatterns.push({
        pattern: 'Spaghetti Code',
        reason: `Code has nesting level of ${maxNesting} - consider refactoring to reduce complexity`,
        severity: maxNesting > 7 ? 'high' : ('medium' as const),
      });
    }

    // Check for duplicate code blocks
    const duplicates = this.findDuplicateBlocks(code);
    if (duplicates.length > 0) {
      antiPatterns.push({
        pattern: 'Copy-Paste Programming',
        reason: `Found ${duplicates.length} duplicate code blocks - consider extracting common functionality`,
        severity: duplicates.length > 3 ? 'high' : 'medium',
      });
    }

    return antiPatterns;
  }

  /**
   * Helper: Get pattern category
   */
  private getPatternCategory(patternName: string): string {
    const categories: Record<string, string[]> = {
      Creational: ['Singleton', 'Factory Method', 'Abstract Factory', 'Builder', 'Prototype'],
      Structural: ['Adapter', 'Bridge', 'Composite', 'Decorator', 'Facade', 'Flyweight', 'Proxy'],
      Behavioral: [
        'Chain of Responsibility',
        'Command',
        'Iterator',
        'Mediator',
        'Memento',
        'Observer',
        'State',
        'Strategy',
        'Template Method',
        'Visitor',
      ],
    };

    for (const [category, patterns] of Object.entries(categories)) {
      if (patterns.includes(patternName)) {
        return category;
      }
    }
    return 'Unknown';
  }

  /**
   * Helper: Find line number for match
   */
  private findLineNumber(code: string, index: number): number {
    const lines = code.substring(0, index).split('\n');
    return lines.length;
  }

  /**
   * Helper: Calculate maximum nesting level
   */
  private calculateMaxNesting(code: string): number {
    let maxNesting = 0;
    let currentNesting = 0;

    for (const char of code) {
      if (char === '{') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (char === '}') {
        currentNesting = Math.max(0, currentNesting - 1);
      }
    }

    return maxNesting;
  }

  /**
   * Helper: Find duplicate code blocks
   */
  private findDuplicateBlocks(code: string): string[] {
    const lines = code
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 10);
    const duplicates: string[] = [];
    const seen = new Map<string, number>();

    // Simple duplicate detection - could be improved with more sophisticated algorithms
    for (let i = 0; i < lines.length - 3; i++) {
      const block = lines.slice(i, i + 3).join('\n');
      if (seen.has(block)) {
        duplicates.push(block);
      } else {
        seen.set(block, i);
      }
    }

    return [...new Set(duplicates)];
  }
}
