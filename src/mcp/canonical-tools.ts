/**
 * Canonical MCP tool definitions exposed by the production server.
 */

export const CANONICAL_TOOL_NAMES = [
  'find_patterns',
  'search_patterns',
  'get_pattern_details',
  'count_patterns',
  'get_health_status',
] as const;

export type CanonicalToolName = (typeof CANONICAL_TOOL_NAMES)[number];

export const CANONICAL_TOOL_DEFINITIONS = [
  {
    name: 'find_patterns' as const,
    description: 'Find design patterns matching a problem description using semantic search',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language description of the problem or requirements',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Pattern categories to search in',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of recommendations to return',
          default: 5,
        },
        programmingLanguage: {
          type: 'string',
          description: 'Target programming language for implementation examples',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_patterns' as const,
    description: 'Search patterns by keyword or semantic similarity',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        searchType: {
          type: 'string',
          enum: ['keyword', 'semantic', 'hybrid'],
          default: 'hybrid',
        },
        limit: { type: 'number', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_pattern_details' as const,
    description: 'Get detailed information about a specific pattern',
    inputSchema: {
      type: 'object',
      properties: {
        patternId: { type: 'string', description: 'Pattern ID to get details for' },
      },
      required: ['patternId'],
    },
  },
  {
    name: 'count_patterns' as const,
    description: 'Get the total number of design patterns in the database',
    inputSchema: {
      type: 'object',
      properties: {
        includeDetails: {
          type: 'boolean',
          description: 'Include breakdown by category',
          default: false,
        },
      },
    },
  },
  {
    name: 'get_health_status' as const,
    description: 'Get the health status of all system services',
    inputSchema: {
      type: 'object',
      properties: {
        checkName: {
          type: 'string',
          description: 'Optional: Check only a specific health check by name',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Filter health checks by tags',
        },
      },
    },
  },
];
