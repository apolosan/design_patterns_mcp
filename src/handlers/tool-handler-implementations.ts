/**
 * MCP Tool Handlers Implementation
 * Extracted from mcp-server.ts to reduce class size
 */

import { CallToolResult, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { InitializedServices } from '../facades/server-facade.js';
import { InputValidator } from '../utils/input-validation.js';
import { parseArrayProperty, parseTags } from '../utils/parse-tags.js';
import { HealthStatus } from '../health/types.js';

interface PatternRow {
  id: string;
  name: string;
  category: string;
  description?: string;
  when_to_use?: string;
  benefits?: string;
  drawbacks?: string;
  use_cases?: string;
  complexity?: string;
  tags?: string;
  examples?: string;
  created_at?: string;
}

interface PatternExample {
  language: string;
  code: string;
  description?: string;
  explanation?: string;
}

interface PatternImplementation {
  language: string;
  code: string;
  explanation?: string;
}

interface CountResult {
  count: number;
}

export class ToolHandlerImplementations {
  constructor(private services: InitializedServices) {}

  async handleFindPatterns(args: unknown): Promise<CallToolResult> {
    const validatedArgs = InputValidator.validateFindPatternsArgs(args);
    const request = {
      id: crypto.randomUUID(),
      query: validatedArgs.query,
      categories: validatedArgs.categories,
      maxResults: validatedArgs.maxResults,
      programmingLanguage: validatedArgs.programmingLanguage,
    };

    const recommendations = await this.services.patternMatcher.findMatchingPatterns(request);

    return {
      content: [
        {
          type: 'text',
          text:
            `Found ${recommendations.length} pattern recommendations:\n\n` +
            recommendations
              .map(
                (rec: unknown, index: number) =>
                  `${index + 1}. **${(rec as { pattern: { name: string; category: string; id: string }; confidence: number; justification: { primaryReason: string; benefits: string[] } }).pattern.name}** (${(rec as { pattern: { name: string; category: string } }).pattern.category})\n` +
                  `   ID: ${(rec as { pattern: { id: string } }).pattern.id}\n` +
                  `   Confidence: ${((rec as { confidence: number }).confidence * 100).toFixed(1)}%\n` +
                  `   Rationale: ${(rec as { justification: { primaryReason: string; benefits: string[] } }).justification.primaryReason}\n` +
                  `   Benefits: ${(rec as { justification: { benefits: string[] } }).justification.benefits.join(', ')}\n`
              )
              .join('\n'),
        },
      ],
    };
  }

  async handleSearchPatterns(args: unknown): Promise<CallToolResult> {
    const validatedArgs = InputValidator.validateSearchPatternsArgs(args);
    const query = {
      text: validatedArgs.query,
      filters: {},
      options: {
        limit: validatedArgs.limit,
        includeMetadata: true,
      },
    };

    const results = await this.services.semanticSearch.search(query);

    return {
      content: [
        {
          type: 'text',
          text:
            `Search results for "${validatedArgs.query}":\n\n` +
            results
              .map(
                (result: unknown, index: number) =>
                  `${index + 1}. **${(result as { pattern: { name: string; category: string; id: string; description: string } }).pattern.name}** (${(result as { pattern: { category: string } }).pattern.category})\n` +
                  `   ID: ${(result as { pattern: { id: string } }).pattern.id}\n` +
                  `   Score: ${((result as { score: number }).score * 100).toFixed(1)}%\n` +
                  `   Description: ${(result as { pattern: { description: string } }).pattern.description}\n`
              )
              .join('\n'),
        },
      ],
    };
  }

  async handleGetPatternDetails(args: unknown): Promise<CallToolResult> {
    const validatedArgs = InputValidator.validateGetPatternDetailsArgs(args);
    const pattern = this.services.db.queryOne<PatternRow>(
      `
      SELECT id, name, category, description, when_to_use, benefits,
             drawbacks, use_cases, complexity, tags, examples, created_at
      FROM patterns WHERE id = ?
    `,
      [validatedArgs.patternId]
    );

    if (!pattern) {
      const similarPatterns = await this.services.semanticSearch.search({
        text: validatedArgs.patternId,
        options: {
          limit: 3,
          includeMetadata: true,
        },
      });

      if (similarPatterns.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: `Pattern "${validatedArgs.patternId}" not found. Here are similar patterns:\n\n${similarPatterns
                .map(
                  (p: unknown, i: number) =>
                    `${i + 1}. **${(p as { pattern: { name: string; category: string; description: string } }).pattern.name}** (${(p as { pattern: { category: string } }).pattern.category})\n   ${(p as { pattern: { description: string } }).pattern.description}\n   Score: ${((p as { score: number }).score * 100).toFixed(1)}%`
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
              text: `Pattern "${validatedArgs.patternId}" not found and no similar patterns were found.`,
            },
          ],
        };
      }
    }

    const patternData: PatternRow = pattern;

    const implementations = this.services.db.query<PatternImplementation>(
      `
      SELECT language, code, explanation FROM pattern_implementations
      WHERE pattern_id = ? LIMIT 3
    `,
      [validatedArgs.patternId]
    );

    let examplesText = '';
    if (patternData.examples) {
      try {
        const examples = JSON.parse(patternData.examples) as Record<string, PatternExample>;
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
      }
    }

    return {
      content: [
        {
          type: 'text',
          text:
            `# ${patternData.name} (${patternData.category})\n\n` +
            `**Description:** ${patternData.description ?? 'No description available'}\n\n` +
            `**When to Use:** ${parseArrayProperty(patternData.when_to_use).join(', ')}\n\n` +
            `**Benefits:** ${parseArrayProperty(patternData.benefits).join(', ')}\n\n` +
            `**Drawbacks:** ${parseArrayProperty(patternData.drawbacks).join(', ')}\n\n` +
            `**Use Cases:** ${parseArrayProperty(patternData.use_cases).join(', ')}\n\n` +
            `**Complexity:** ${patternData.complexity ?? 'Unknown'}\n\n` +
            `**Tags:** ${parseTags(patternData.tags).join(', ')}\n` +
            examplesText +
            (implementations.length > 0
              ? `\n\n**Implementations:**\n` +
                implementations
                  .map(
                    (impl: { language: string; code: string; explanation?: string }) =>
                      `\n### ${impl.language}\n\`\`\`${impl.language.toLowerCase()}\n${impl.code}\n\`\`\`\n${impl.explanation}`
                  )
                  .join('\n')
              : ''),
        },
      ],
    };
  }

  handleCountPatterns(args: unknown): CallToolResult {
    try {
      const validatedArgs = InputValidator.validateCountPatternsArgs(args);
      const totalResult = this.services.db.queryOne<{ total: number }>(
        'SELECT COUNT(*) as total FROM patterns'
      );
      const total = totalResult?.total ?? 0;

      if (validatedArgs.includeDetails) {
        const breakdown = this.services.db.query<{ category: string; count: number }>(
          'SELECT category, COUNT(*) as count FROM patterns GROUP BY category ORDER BY count DESC'
        );

        return {
          content: [
            {
              type: 'text',
              text:
                `## Total Design Patterns: ${total}\n\n` +
                `### Breakdown by Category:\n` +
                breakdown.map((item: { category: string; count: number }) => `- **${item.category}**: ${item.count} patterns`).join('\n') +
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
      throw new McpError(
        ErrorCode.InternalError,
        `Pattern count failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async handleGetHealthStatus(args: unknown): Promise<CallToolResult> {
    try {
      if (!this.services.healthCheckService) {
        return {
          content: [
            {
              type: 'text',
              text: 'Health check service is not available. Health checks require DI container initialization.',
            },
          ],
        };
      }

      const validatedArgs = InputValidator.validateGetHealthStatusArgs(args);

      let report;
      if (validatedArgs.checkName) {
        const result = await this.services.healthCheckService.check(validatedArgs.checkName);
        report = {
          overall: result.status,
          timestamp: new Date().toISOString(),
          duration: result.duration,
          checks: [result],
          summary: {
            total: 1,
            healthy: result.status === HealthStatus.HEALTHY ? 1 : 0,
            degraded: result.status === HealthStatus.DEGRADED ? 1 : 0,
            unhealthy: result.status === HealthStatus.UNHEALTHY ? 1 : 0,
            unknown: result.status === HealthStatus.UNKNOWN ? 1 : 0,
          },
        };
      } else if (validatedArgs.tags && validatedArgs.tags.length > 0) {
        report = await this.services.healthCheckService.checkByTags(validatedArgs.tags);
      } else {
        report = await this.services.healthCheckService.checkAll();
      }

      let response = `## System Health Report\n\n`;
      response += `**Overall Status:** ${report.overall.toUpperCase()}\n`;
      response += `**Timestamp:** ${new Date(report.timestamp).toLocaleString()}\n`;
      response += `**Total Duration:** ${Math.round(report.duration)}ms\n\n`;

      response += `### Summary\n`;
      response += `- **Total Checks:** ${report.summary.total}\n`;
      response += `- **Healthy:** ${report.summary.healthy}\n`;
      response += `- **Degraded:** ${report.summary.degraded}\n`;
      response += `- **Unhealthy:** ${report.summary.unhealthy}\n`;
      response += `- **Unknown:** ${report.summary.unknown}\n\n`;

      response += `### Individual Check Results\n\n`;
      report.checks.forEach((check: { name: string; status: string; duration: number; message: string; details?: unknown; tags?: string[] }, index: number) => {
        response += `${index + 1}. **${check.name}**\n`;
        response += `   - **Status:** ${check.status.toUpperCase()}\n`;
        response += `   - **Duration:** ${Math.round(check.duration)}ms\n`;
        response += `   - **Message:** ${check.message}\n`;

        if (check.details) {
          response += `   - **Details:** ${JSON.stringify(check.details, null, 2)}\n`;
        }

        if (check.tags && check.tags.length > 0) {
          response += `   - **Tags:** ${check.tags.join(', ')}\n`;
        }

        response += `\n`;
      });

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export class ResourceHandlerImplementations {
  constructor(private services: InitializedServices) {}

  handleReadPatterns(): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
    const patterns = this.services.db.query(
      'SELECT id, name, category, description, complexity, tags FROM patterns ORDER BY name LIMIT 100'
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

  handleReadCategories(): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
    const categories = this.services.db.query(`
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

  handleReadServerInfo(config: any): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
    const info = {
      name: 'Design Patterns MCP Server',
      version: '0.4.3',
      status: 'running',
      database: {
        path: config.databasePath,
        patternCount: this.services.db.queryOne<CountResult>('SELECT COUNT(*) as count FROM patterns')?.count ?? 0,
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
