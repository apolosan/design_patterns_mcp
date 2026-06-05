/**
 * Stateless HTTP tool handlers (reusable across server instances).
 */

import { DatabaseManager } from '../services/database-manager.js';
import { MCPRateLimiter } from '../utils/rate-limiter.js';
import { SearchMediator, type SearchStrategy } from '../handlers/search-mediator.js';
import { InputValidator } from '../utils/input-validation.js';
import { CANONICAL_TOOL_DEFINITIONS } from './canonical-tools.js';
import {
  buildPatternRequest,
  formatFindPatternsResult,
  formatSearchResultsFromRecommendations,
} from './tool-formatters.js';

export function createHttpToolHandlers(
  db: DatabaseManager,
  searchMediator: SearchMediator,
  _rateLimiter: MCPRateLimiter
) {
  return {
    tools: CANONICAL_TOOL_DEFINITIONS,
    handleFindPatterns: async (args: unknown) => {
      const validatedArgs = InputValidator.validateFindPatternsArgs(args);
      const request = buildPatternRequest(validatedArgs.query, {
        categories: validatedArgs.categories,
        maxResults: validatedArgs.maxResults,
        programmingLanguage: validatedArgs.programmingLanguage,
      });
      const recommendations = await searchMediator.search(request);
      return {
        content: [
          {
            type: 'text',
            text: formatFindPatternsResult(recommendations),
          },
        ],
      };
    },
    handleSearchPatterns: async (args: unknown) => {
      const validatedArgs = InputValidator.validateSearchPatternsArgs(args);
      const request = buildPatternRequest(validatedArgs.query, {
        maxResults: validatedArgs.limit,
      });
      const searchResult = await searchMediator.searchByType(
        request,
        validatedArgs.searchType as SearchStrategy
      );
      return {
        content: [
          {
            type: 'text',
            text: formatSearchResultsFromRecommendations(
              validatedArgs.query,
              searchResult.searchTypeUsed,
              searchResult.degraded,
              searchResult.recommendations
            ),
          },
        ],
      };
    },
    handleCountPatterns: (args: unknown) => {
      const validatedArgs = InputValidator.validateCountPatternsArgs(args);
      const totalResult = db.queryOne<{ total: number }>('SELECT COUNT(*) as total FROM patterns');
      const total = totalResult?.total ?? 0;
      if (validatedArgs.includeDetails) {
        const breakdown = db.query<{ category: string; count: number }>(
          'SELECT category, COUNT(*) as count FROM patterns GROUP BY category ORDER BY count DESC'
        );
        return {
          content: [
            {
              type: 'text',
              text: `## Total Design Patterns: ${total}\n\n### Breakdown by Category:\n${breakdown.map(item => `- **${item.category}**: ${item.count} patterns`).join('\n')}\n\n*Total patterns from all sources: ${total}*`,
            },
          ],
        };
      }
      return {
        content: [{ type: 'text', text: `Total design patterns in database: **${total}**` }],
      };
    },
  };
}
