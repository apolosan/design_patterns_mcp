/**
 * T3: Formatter surfaces fuzzy fields — RED test.
 * Asserts that formatFindPatternsResult includes fuzzyReasoning and
 * fuzzyConfidence in its rendered text when present on the recommendation.
 */
import { describe, it, expect } from 'vitest';
import { formatFindPatternsResult } from '../../src/mcp/tool-formatters.js';
import type { PatternRecommendation } from '../../src/models/recommendation.js';

function buildRecommendation(overrides: Partial<PatternRecommendation> = {}): PatternRecommendation {
  return {
    id: 'rec-1',
    requestId: 'req-1',
    pattern: {
      id: 'p-1',
      name: 'Factory Method',
      category: 'Creational',
      description: 'Creational pattern for object instantiation.',
      complexity: 'Medium',
      tags: ['creational'],
    },
    rank: 1,
    confidence: 0.78,
    justification: {
      primaryReason: 'Matches query about factories',
      supportingReasons: ['contains keyword factory'],
      problemFit: 'Good fit for object creation.',
      benefits: ['Decouples creation', 'Single point of control'],
      drawbacks: ['Indirection'],
      fuzzyReasoning: ['Strong semantic and keyword alignment (87.3% confidence)'],
      fuzzyConfidence: 0.87,
    },
    implementation: {
      steps: [],
      examples: [],
      dependencies: [],
      configuration: [],
      testing: { unitTests: [], integrationTests: [], testScenarios: [] },
      performance: {
        impact: 'low',
        memoryUsage: 'low',
        cpuUsage: 'low',
        optimizations: [],
        monitoring: [],
      },
    },
    alternatives: [],
    context: {
      projectContext: '',
      teamContext: '',
      technologyFit: { fitScore: 0.8, reasons: [] },
    },
    ...overrides,
  };
}

describe('formatFindPatternsResult — fuzzy surface', () => {
  it('includes fuzzyReasoning in the rendered output', () => {
    const rec = buildRecommendation();
    const out = formatFindPatternsResult([rec]);
    expect(out).toContain('Strong semantic and keyword alignment');
  });

  it('includes fuzzyConfidence percentage in the rendered output', () => {
    const rec = buildRecommendation();
    const out = formatFindPatternsResult([rec]);
    expect(out).toContain('87.0%');
    expect(out).toMatch(/fuzzy.*confidence/i);
  });

  it('omits fuzzy block when fuzzyReasoning is empty/absent', () => {
    const rec = buildRecommendation();
    rec.justification.fuzzyReasoning = undefined;
    rec.justification.fuzzyConfidence = undefined;
    const out = formatFindPatternsResult([rec]);
    expect(out).not.toMatch(/fuzzy.*confidence/i);
  });
});
