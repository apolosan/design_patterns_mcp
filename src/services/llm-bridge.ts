/**
 * LLM Bridge Service for Design Patterns MCP Server
 * Provides integration with Large Language Models for enhanced pattern recommendations
 */
import { DatabaseManager } from './database-manager.js';
import { parseTags, parseArrayProperty } from '../utils/parse-tags.js';
import type { Pattern } from '../models/pattern.js';

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'local';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

interface UserContext {
  projectType?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'expert';
  preferredLanguages?: string[];
  teamSize?: number;
  projectComplexity?: 'simple' | 'medium' | 'complex';
  timeConstraints?: string;
  budget?: string;
  existingPatterns?: string[];
  domain?: string;
  requirements?: string[];
}

interface LLMRequest {
  prompt: string;
  context?: UserContext;
  examples?: string[];
  constraints?: string[];
  format?: 'json' | 'text' | 'markdown';
}

interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata: {
    model: string;
    provider: string;
    processingTime: number;
    timestamp: Date;
  };
}

interface PatternRecommendation {
  patternName: string;
  confidence: number;
  reasoning: string;
  benefits?: string[];
  drawbacks?: string[];
  useCases?: string[];
  tags?: string[];
  enhanced?: boolean;
}

interface LLMEnhancement {
  patternName: string;
  additionalBenefits?: string[];
  additionalDrawbacks?: string[];
  additionalUseCases?: string[];
  enhancedReasoning?: string;
}

interface PatternAnalysisRequest {
  codeSnippet?: string;
  problemDescription: string;
  programmingLanguage?: string;
  context?: {
    existingPatterns?: string[];
    constraints?: string[];
    preferences?: string[];
  };
}

interface PatternAnalysisResponse {
  detectedPatterns: Array<{
    name: string;
    confidence: number;
    reasoning: string;
    category: string;
  }>;
  recommendations: Array<{
    pattern: string;
    rationale: string;
    implementation: string;
    benefits: string[];
  }>;
  alternatives: Array<{
    pattern: string;
    comparison: string;
    when_to_use: string;
  }>;
}

export class LLMBridgeService {
  private db: DatabaseManager;
  private config: LLMConfig;

  constructor(db: DatabaseManager, config: LLMConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * Analyze code and problem description for pattern recommendations
   */
  async analyzePatterns(request: PatternAnalysisRequest): Promise<PatternAnalysisResponse> {
    try {
      const prompt = this.buildAnalysisPrompt(request);
      const llmRequest: LLMRequest = {
        prompt,
        context: request.context ? {
          existingPatterns: request.context.existingPatterns,
          requirements: request.context.constraints,
        } : undefined,
        format: 'json',
      };

      const response = await Promise.resolve(this.callLLM(llmRequest));
      return this.parseAnalysisResponse(response.content);
    } catch (error) {
      console.error('Pattern analysis failed:', error);
      return this.getFallbackAnalysis(request);
    }
  }

  /**
   * Generate implementation guidance for a pattern
   */
  async generateImplementationGuidance(
    patternName: string,
    language: string,
    context?: UserContext
  ): Promise<string> {
    try {
      const pattern = this.getPatternInfo(patternName);
      const prompt = this.buildImplementationPrompt(pattern, language, context);

      const response = await Promise.resolve(this.callLLM({ prompt, format: 'markdown' }));
      return response.content;
    } catch (error) {
      console.error('Implementation guidance generation failed:', error);
      return this.getFallbackImplementationGuidance(patternName, language);
    }
  }

  /**
   * Explain pattern relationships and trade-offs
   */
  async explainPatternRelationships(
    pattern1: string,
    pattern2: string,
    context?: string
  ): Promise<string> {
    try {
      const patternInfo1 = this.getPatternInfo(pattern1);
      const patternInfo2 = this.getPatternInfo(pattern2);

      const prompt = this.buildRelationshipPrompt(patternInfo1, patternInfo2, context);
      const response = await Promise.resolve(this.callLLM({ prompt, format: 'markdown' }));

      return response.content;
    } catch (error) {
      console.error('Pattern relationship explanation failed:', error);
      return this.getFallbackRelationshipExplanation(pattern1, pattern2);
    }
  }

  /**
   * Generate code examples with explanations
   */
  async generateCodeExample(
    patternName: string,
    language: string,
    scenario: string
  ): Promise<{ code: string; explanation: string }> {
    try {
      const pattern = this.getPatternInfo(patternName);
      const prompt = this.buildCodeExamplePrompt(pattern, language, scenario);

      const response = await Promise.resolve(this.callLLM({ prompt, format: 'markdown' }));

      return this.parseCodeExampleResponse(response.content);
    } catch (error) {
      console.error('Code example generation failed:', error);
      return this.getFallbackCodeExample(patternName, language);
    }
  }

  /**
   * Enhance pattern recommendations with LLM insights
   */
  async enhanceRecommendations(baseRecommendations: PatternRecommendation[], userContext: UserContext): Promise<PatternRecommendation[]> {
    try {
      const prompt = this.buildEnhancementPrompt(baseRecommendations, userContext);
      const response = await Promise.resolve(this.callLLM({ prompt, format: 'json' }));

      const enhancements = JSON.parse(response.content) as LLMEnhancement[];
      return this.mergeEnhancements(baseRecommendations, enhancements);
    } catch (error) {
      console.error('Recommendation enhancement failed:', error);
      return baseRecommendations;
    }
  }

  /**
   * Build analysis prompt for LLM
   */
  private buildAnalysisPrompt(request: PatternAnalysisRequest): string {
    return `
You are an expert software architect analyzing code and requirements to recommend design patterns.

PROBLEM DESCRIPTION:
${request.problemDescription}

${request.codeSnippet ? `CODE SNIPPET:\n${request.codeSnippet}\n` : ''}

${request.programmingLanguage ? `PROGRAMMING LANGUAGE: ${request.programmingLanguage}\n` : ''}

${request.context?.existingPatterns ? `EXISTING PATTERNS: ${request.context.existingPatterns.join(', ')}\n` : ''}

${request.context?.constraints ? `CONSTRAINTS: ${request.context.constraints.join(', ')}\n` : ''}

${request.context?.preferences ? `PREFERENCES: ${request.context.preferences.join(', ')}\n` : ''}

Based on the above, please analyze and recommend appropriate design patterns. Respond in the following JSON format:

{
  "detectedPatterns": [
    {
      "name": "Pattern Name",
      "confidence": 0.85,
      "reasoning": "Why this pattern fits",
      "category": "GoF/Architectural/Cloud-Native/etc"
    }
  ],
  "recommendations": [
    {
      "pattern": "Recommended Pattern",
      "rationale": "Why this pattern is recommended",
      "implementation": "High-level implementation approach",
      "benefits": ["Benefit 1", "Benefit 2"]
    }
  ],
  "alternatives": [
    {
      "pattern": "Alternative Pattern",
      "comparison": "How it compares to main recommendation",
      "when_to_use": "When to choose this alternative"
    }
  ]
}

Focus on practical, implementable recommendations with clear reasoning.`;
  }

  /**
   * Build implementation guidance prompt
   */
  private buildImplementationPrompt(pattern: Partial<Pattern>, language: string, context?: UserContext): string {
    return `
You are an expert software engineer providing detailed implementation guidance for the ${pattern.name} design pattern.

PATTERN: ${pattern.name}
CATEGORY: ${pattern.category}
DESCRIPTION: ${pattern.description}

TARGET LANGUAGE: ${language}

${context ? `CONTEXT: ${JSON.stringify(context)}\n` : ''}

Please provide comprehensive implementation guidance including:

1. **Key Components**: Main classes/interfaces needed
2. **Step-by-step Implementation**: Clear implementation steps
3. **Code Structure**: How to organize the code
4. **Common Pitfalls**: What to avoid
5. **Testing Approach**: How to test the implementation
6. **Best Practices**: Language-specific recommendations

Format your response in clear, actionable markdown with code examples where appropriate.`;
  }

  /**
   * Build relationship explanation prompt
   */
  private buildRelationshipPrompt(pattern1: Partial<Pattern>, pattern2: Partial<Pattern>, context?: string): string {
    return `
You are an expert software architect explaining the relationship between two design patterns.

PATTERN 1: ${pattern1.name} (${pattern1.category})
${pattern1.description}

PATTERN 2: ${pattern2.name} (${pattern2.category})
${pattern2.description}

${context ? `CONTEXT: ${context}\n` : ''}

Please explain:

1. **Relationship Type**: How these patterns relate (complementary, alternative, conflicting, etc.)
2. **When to Use Together**: Scenarios where both patterns work well together
3. **Trade-offs**: Benefits and drawbacks of combining them
4. **Implementation Considerations**: How to implement both patterns
5. **Common Mistakes**: What to avoid when using both

Provide practical examples and clear guidance for developers.`;
  }

  /**
   * Build code example prompt
   */
  private buildCodeExamplePrompt(pattern: Partial<Pattern>, language: string, scenario: string): string {
    return `
You are an expert software engineer creating a practical code example for the ${pattern.name} design pattern.

PATTERN: ${pattern.name}
LANGUAGE: ${language}
SCENARIO: ${scenario}

Please provide:

1. **Complete Code Example**: Working implementation
2. **Detailed Explanation**: How the code works
3. **Key Design Decisions**: Why certain choices were made
4. **Usage Example**: How to use the implementation

Format as markdown with clear code blocks and comprehensive explanations.

The example should be production-ready and demonstrate best practices for the ${language} language.`;
  }

  /**
   * Build enhancement prompt
   */
  private buildEnhancementPrompt(recommendations: PatternRecommendation[], userContext: UserContext): string {
    return `
You are an AI assistant enhancing design pattern recommendations with additional insights.

CURRENT RECOMMENDATIONS:
${JSON.stringify(recommendations, null, 2)}

USER CONTEXT:
${JSON.stringify(userContext, null, 2)}

Please enhance these recommendations by:

1. **Adding Context**: Consider user's experience level and project context
2. **Improving Explanations**: Make technical concepts more accessible
3. **Adding Practical Tips**: Include implementation tips and gotchas
4. **Considering Alternatives**: Suggest when alternatives might be better
5. **Learning Path**: Suggest learning progression if applicable

Respond with enhanced recommendations in the same JSON format, maintaining all existing data while adding value through better explanations and additional insights.`;
  }

  /**
   * Call LLM with request
   */
  private callLLM(request: LLMRequest): LLMResponse {
    const startTime = Date.now();

    try {
      let response: LLMResponse;

      switch (this.config.provider) {
        case 'openai':
          response = this.callOpenAI(request);
          break;
        case 'anthropic':
          response = this.callAnthropic(request);
          break;
        case 'ollama':
          response = this.callOllama(request);
          break;
        default:
          response = this.callLocal(request);
      }

      response.metadata.processingTime = Date.now() - startTime;
      response.metadata.timestamp = new Date();

      return response;
    } catch (error) {
      console.error('LLM call failed:', error);
      throw error;
    }
  }

  /**
   * Call OpenAI API
   */
  private callOpenAI(_request: LLMRequest): LLMResponse {
    // Placeholder implementation
    return {
      content: 'OpenAI response placeholder',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      metadata: {
        model: this.config.model,
        provider: 'openai',
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Call Anthropic API
   */
  private callAnthropic(_request: LLMRequest): LLMResponse {
    // Placeholder implementation
    return {
      content: 'Anthropic response placeholder',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      metadata: {
        model: this.config.model,
        provider: 'anthropic',
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Call Ollama API
   */
  private callOllama(_request: LLMRequest): LLMResponse {
    // Placeholder implementation
    return {
      content: 'Ollama response placeholder',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      metadata: {
        model: this.config.model,
        provider: 'ollama',
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Call local model
   */
  private callLocal(_request: LLMRequest): LLMResponse {
    // Placeholder implementation
    return {
      content: 'Local model response placeholder',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      metadata: {
        model: this.config.model,
        provider: 'local',
        processingTime: 0,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Parse analysis response from LLM
   */
  private parseAnalysisResponse(content: string): PatternAnalysisResponse {
    try {
      const parsed = JSON.parse(content) as PatternAnalysisResponse;
      return parsed;
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      return this.getFallbackAnalysis({ problemDescription: 'Unknown' });
    }
  }

  /**
   * Parse code example response
   */
  private parseCodeExampleResponse(content: string): { code: string; explanation: string } {
    // Simple parsing - in production, use more sophisticated parsing
    const parts = content.split('```');
    if (parts.length >= 3) {
      return {
        code: parts[1].replace(/^[\w]*\n/, ''), // Remove language identifier
        explanation: parts[2] || content,
      };
    }

    return {
      code: '// Code example not available',
      explanation: content,
    };
  }

  /**
   * Get pattern information from database
   */
  private getPatternInfo(patternName: string): Partial<Pattern> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const pattern = this.db.queryOne('SELECT * FROM patterns WHERE name = ?', [patternName]);

    if (!pattern) {
      return {
        name: patternName,
        category: 'Unknown',
        description: 'Pattern information not available',
      };
    }

    // Type guard for database result
    const isDatabasePattern = (obj: unknown): obj is Record<string, unknown> => {
      return typeof obj === 'object' && obj !== null;
    };

    if (!isDatabasePattern(pattern)) {
      return {
        name: patternName,
        category: 'Unknown',
        description: 'Invalid pattern data',
      };
    }

    // Safe property access - pattern is already validated as Record<string, unknown>
    const safePattern = pattern;

    return {
      ...safePattern,
      when_to_use: parseArrayProperty(String(safePattern.when_to_use || ''), 'when_to_use'),
      benefits: parseArrayProperty(String(safePattern.benefits || ''), 'benefits'),
      drawbacks: parseArrayProperty(String(safePattern.drawbacks || ''), 'drawbacks'),
      use_cases: parseArrayProperty(String(safePattern.use_cases || ''), 'use_cases'),
      tags: parseTags(String(safePattern.tags || '')),
    };
  }

  /**
   * Get fallback analysis when LLM fails
   */
  private getFallbackAnalysis(_request: PatternAnalysisRequest): PatternAnalysisResponse {
    return {
      detectedPatterns: [],
      recommendations: [
        {
          pattern: 'Factory Method',
          rationale: 'Common pattern for object creation',
          implementation: 'Create objects without specifying exact classes',
          benefits: ['Flexibility', 'Extensibility'],
        },
      ],
      alternatives: [],
    };
  }

  /**
   * Get fallback implementation guidance
   */
  private getFallbackImplementationGuidance(patternName: string, language: string): string {
    return `
# ${patternName} Implementation in ${language}

## Overview
This is a basic implementation guide for the ${patternName} pattern.

## Key Components
- Define the main interfaces and classes
- Implement the pattern structure
- Add proper error handling

## Implementation Steps
1. Create the necessary interfaces
2. Implement concrete classes
3. Add configuration and initialization
4. Test the implementation

## Best Practices
- Follow language-specific conventions
- Add comprehensive error handling
- Include unit tests
- Document the implementation
`;
  }

  /**
   * Get fallback relationship explanation
   */
  private getFallbackRelationshipExplanation(pattern1: string, pattern2: string): string {
    return `
# Relationship between ${pattern1} and ${pattern2}

## Overview
These patterns can be used together or as alternatives depending on the context.

## Relationship Type
Complementary - These patterns often work well together.

## When to Use Together
- When you need both structural and behavioral benefits
- In complex systems requiring multiple concerns

## Trade-offs
- Increased complexity when combining
- Need careful design to avoid conflicts
- May require additional testing

## Implementation Considerations
- Implement one pattern first, then add the second
- Ensure proper separation of concerns
- Test interactions between patterns
`;
  }

  /**
   * Get fallback code example
   */
  private getFallbackCodeExample(
    patternName: string,
    language: string
  ): { code: string; explanation: string } {
    return {
      code: `// ${patternName} pattern example in ${language}
// Basic implementation structure
class ${patternName}Example {
  // Implementation would go here
}`,
      explanation: `This is a basic example of the ${patternName} pattern in ${language}. The actual implementation would depend on the specific requirements and context.`,
    };
  }

  /**
   * Merge LLM enhancements with base recommendations
   */
  private mergeEnhancements(baseRecommendations: PatternRecommendation[], enhancements: LLMEnhancement[]): PatternRecommendation[] {
    // Simple merge - in production, implement more sophisticated merging
    return baseRecommendations.map((rec, index) => {
      const enhancement = enhancements[index];
      if (!enhancement) return rec;

      return {
        ...rec,
        benefits: [...(rec.benefits ?? []), ...(enhancement.additionalBenefits ?? [])],
        drawbacks: [...(rec.drawbacks ?? []), ...(enhancement.additionalDrawbacks ?? [])],
        useCases: [...(rec.useCases ?? []), ...(enhancement.additionalUseCases ?? [])],
        reasoning: enhancement.enhancedReasoning ?? rec.reasoning,
        enhanced: true,
      };
    });
  }

  /**
   * Get LLM service health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    provider: string;
    model: string;
    lastTest?: Date;
    error?: string;
  }> {
    try {
      // Test LLM with a simple request
      await Promise.resolve(this.callLLM({
        prompt: 'Hello, this is a test.',
        format: 'text',
      }));

      return {
        healthy: true,
        provider: this.config.provider,
        model: this.config.model,
        lastTest: new Date(),
      };
    } catch (error) {
      return {
        healthy: false,
        provider: this.config.provider,
        model: this.config.model,
        lastTest: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}




