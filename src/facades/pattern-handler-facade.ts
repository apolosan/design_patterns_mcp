/**
 * Facade Pattern Implementation for MCP Handlers
 * Simplifies complex operations by providing a unified interface
 * Reduces complexity in mcp-server.ts handlers
 */

import type { PatternService } from '../services/pattern-service.js';
import type { PatternMatcher } from '../services/pattern-matcher.js';
import type { DatabaseManager } from '../services/database-manager.js';
import { parseTags, parseArrayProperty } from '../utils/parse-tags.js';
import { InputValidator } from '../utils/input-validation.js';

export interface FindPatternsRequest {
  query: string;
  categories?: string[];
  maxResults?: number;
  programmingLanguage?: string;
}

export interface SearchPatternsRequest {
  query: string;
  searchType?: 'keyword' | 'semantic' | 'hybrid';
  limit?: number;
  filters?: any;
}

export interface PatternDetailsRequest {
  patternId: string;
}

export interface CountPatternsRequest {
  includeDetails?: boolean;
}

export class PatternHandlerFacade {
  constructor(
    private patternService: PatternService,
    private patternMatcher: PatternMatcher,
    private db: DatabaseManager
  ) {}

  /**
   * Handle find_patterns tool request
   */
  async findPatterns(request: FindPatternsRequest) {
    // Validate and sanitize inputs
    const validatedArgs = InputValidator.validateFindPatternsArgs(request);

    const matchRequest = {
      id: crypto.randomUUID(),
      query: validatedArgs.query,
      categories: validatedArgs.categories,
      maxResults: validatedArgs.maxResults,
      programmingLanguage: validatedArgs.programmingLanguage,
    };

    const recommendations = await this.patternMatcher.findMatchingPatterns(matchRequest);

    return {
      content: [
        {
          type: 'text',
          text:
            `Found ${recommendations.length} pattern recommendations:\n\n` +
            recommendations
              .map(
                (rec, index) =>
                  `${index + 1}. **${rec.pattern.name}** (${rec.pattern.category})\n` +
                  `   Confidence: ${(rec.confidence * 100).toFixed(1)}%\n` +
                  `   Rationale: ${rec.justification.primaryReason}\n` +
                  `   Benefits: ${rec.justification.benefits.join(', ')}\n`
              )
              .join('\n'),
        },
      ],
    };
  }

  /**
   * Handle search_patterns tool request
   */
  async searchPatterns(request: SearchPatternsRequest) {
    // Validate and sanitize inputs
    const validatedArgs = InputValidator.validateSearchPatternsArgs(request);

    const results = await this.patternService.searchPatterns({
      text: validatedArgs.query,
      filters: request.filters || {},
      options: {
        limit: validatedArgs.limit,
        includeMetadata: true,
        searchType: validatedArgs.searchType as 'keyword' | 'semantic' | 'hybrid',
      },
    });

    return {
      content: [
        {
          type: 'text',
          text:
            `Search results for "${request.query}":\n\n` +
            results
              .map(
                (result, index) =>
                  `${index + 1}. **${result.pattern.name}** (${result.pattern.category})\n` +
                  `   Score: ${(result.score * 100).toFixed(1)}%\n` +
                  `   Description: ${result.pattern.description}\n`
              )
              .join('\n'),
        },
      ],
    };
  }

  /**
   * Handle get_pattern_details tool request
   */
  async getPatternDetails(request: PatternDetailsRequest) {
    // Validate and sanitize inputs
    const validatedArgs = InputValidator.validateGetPatternDetailsArgs(request);

    const details = await this.patternService.getPatternDetails(validatedArgs.patternId);

    if (!details) {
      // Try to find similar patterns
      const similarResults = await this.patternService.searchPatterns({
        text: request.patternId,
        options: {
          limit: 3,
          includeMetadata: true,
        },
      });

      if (similarResults.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Pattern "${request.patternId}" not found. Here are similar patterns:\n\n${similarResults
                .map(
                  (p, i) =>
                    `${i + 1}. **${p.pattern.name}** (${p.pattern.category})\n   ${p.pattern.description}\n   Score: ${(p.score * 100).toFixed(1)}%`
                )
                .join('\n\n')}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Pattern "${request.patternId}" not found and no similar patterns were found.`,
            },
          ],
        };
      }
    }

    // Get implementations
    const implementations = this.db.query(
      `SELECT language, code, explanation FROM pattern_implementations WHERE pattern_id = ? LIMIT 3`,
      [request.patternId]
    );

    // Format examples if available
    let examplesText = '';
    if (details.examples) {
      try {
        const examples =
          typeof details.examples === 'string' ? JSON.parse(details.examples) : details.examples;
        const exampleKeys = Object.keys(examples);

        if (exampleKeys.length > 0) {
          examplesText = '\n\n**Code Examples:**\n';
          exampleKeys.forEach(lang => {
            const example = examples[lang];
            examplesText += `\n### ${lang.charAt(0).toUpperCase() + lang.slice(1)}\n`;
            if (example.description) {
              examplesText += `${example.description}\n\n`;
            }
            examplesText += `\`\`\`${lang}\n${example.code}\n\`\`\`\n`;
          });
        }
      } catch (e) {
        // If parsing fails, skip examples
      }
    }

    // Format similar patterns
    let similarPatternsText = '';
    if (details.similarPatterns && details.similarPatterns.length > 0) {
      similarPatternsText = '\n\n**Similar Patterns:**\n';
      similarPatternsText += details.similarPatterns
        .map((p, i) => `${i + 1}. ${p.name} (${p.category})`)
        .join('\n');
    }

    return {
      content: [
        {
          type: 'text',
          text:
            `# ${details.name} (${details.category})\n\n` +
            `**Description:** ${details.description}\n\n` +
            `**When to Use:** ${parseArrayProperty(details.when_to_use).join(', ')}\n\n` +
            `**Benefits:** ${parseArrayProperty(details.benefits).join(', ')}\n\n` +
            `**Drawbacks:** ${parseArrayProperty(details.drawbacks).join(', ')}\n\n` +
            `**Use Cases:** ${parseArrayProperty(details.use_cases).join(', ')}\n\n` +
            `**Complexity:** ${details.complexity}\n\n` +
            `**Tags:** ${parseTags(details.tags).join(', ')}\n` +
            examplesText +
            similarPatternsText +
            (implementations.length > 0
              ? `\n\n**Implementations:**\n` +
                implementations
                  .map(
                    impl =>
                      `\n### ${impl.language}\n\`\`\`${impl.language.toLowerCase()}\n${impl.code}\n\`\`\`\n${impl.explanation}`
                  )
                  .join('\n')
              : ''),
        },
      ],
    };
  }

  /**
   * Handle count_patterns tool request
   */
  async countPatterns(request: CountPatternsRequest) {
    // Validate and sanitize inputs
    const validatedArgs = InputValidator.validateCountPatternsArgs(request);

    try {
      // Optimized query using SQL GROUP BY instead of JavaScript processing
      const totalResult = this.db.queryOne<{ total: number }>(
        'SELECT COUNT(*) as total FROM patterns'
      );
      const total = totalResult?.total || 0;

      let breakdown: Array<{ category: string; count: number }> = [];
      if (validatedArgs.includeDetails) {
        // Use SQL aggregation for better performance
        breakdown = this.db.query<{ category: string; count: number }>(
          'SELECT category, COUNT(*) as count FROM patterns GROUP BY category ORDER BY count DESC'
        );

        return {
          content: [
            {
              type: 'text',
              text:
                `## Total Design Patterns: ${total}\n\n` +
                `### Breakdown by Category:\n` +
                breakdown.map(item => `- **${item.category}**: ${item.count} patterns`).join('\n') +
                '\n\n' +
                `*Total patterns from all sources: ${total}*`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Total design patterns in database: **${total}**`,
            },
          ],
        };
      }
    } catch (error) {
      throw new Error(
        `Pattern count failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get all patterns (for resources)
   */
  async getAllPatterns() {
    const patterns = this.db.query(
      'SELECT id, name, category, description, complexity, tags FROM patterns ORDER BY name'
    );

    return {
      contents: [
        {
          uri: 'patterns',
          mimeType: 'application/json',
          text: JSON.stringify(patterns, null, 2),
        },
      ],
    };
  }

  /**
   * Get categories (for resources)
   */
  async getCategories() {
    const categories = this.db.query(`
      SELECT category, COUNT(*) as count 
      FROM patterns 
      GROUP BY category 
      ORDER BY category
    `);

    return {
      contents: [
        {
          uri: 'categories',
          mimeType: 'application/json',
          text: JSON.stringify(categories, null, 2),
        },
      ],
    };
  }

  /**
   * Get server info (for resources)
   */
  async getServerInfo(config: any) {
    const info = {
      name: 'Design Patterns MCP Server',
      version: '0.1.0',
      status: 'running',
      database: {
        path: config.databasePath,
        patternCount: this.db.queryOne('SELECT COUNT(*) as count FROM patterns')?.count || 0,
      },
      features: {
        semanticSearch: true,
        llmBridge: config.enableLLM,
        caching: true,
      },
      config: {
        logLevel: config.logLevel,
        maxConcurrentRequests: config.maxConcurrentRequests,
      },
    };

    return {
      contents: [
        {
          uri: 'server_info',
          mimeType: 'application/json',
          text: JSON.stringify(info, null, 2),
        },
      ],
    };
  }
}
