# Design Patterns MCP Server

[![Version](https://img.shields.io/badge/version-0.4.2-blue.svg)](https://github.com/apolosan/design_patterns_mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Test Status](https://img.shields.io/badge/tests-464%20%7C%20100%25-brightgreen.svg)](#testing)
[![Patterns](https://img.shields.io/badge/patterns-685%2B-orange.svg)](#available-pattern-categories)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

An intelligent MCP (Model Context Protocol) server that provides design pattern recommendations using hybrid search (semantic + keyword + graph augmentation). Access **685+ design patterns** across 90+ categories through a natural language interface with advanced blended RAG architecture.

## Quick Start

```bash
# Clone and setup
git clone https://github.com/apolosan/design_patterns_mcp.git
cd design_patterns_mcp

# Install dependencies
bun install

# Build and setup database
bun run db:setup

# Start the server
bun run dev
```

Configure in your MCP client (Claude Desktop, Cursor, etc.) and start discovering patterns through natural language queries.

## Features

| Feature | Description |
|---------|-------------|
| **Hybrid Search Engine** | Blended RAG combining semantic, keyword (TF-IDF), and graph-augmented retrieval |
| **685+ Patterns** | Comprehensive catalog across 12 major categories |
| **MCP Integration** | Seamless integration with Claude, Cursor, and other MCP clients |
| **Multi-Level Caching** | L1 in-memory + L3 SQLite cache with 95%+ hit rate |
| **Event Bus System** | Decoupled service communication via pub/sub |
| **Telemetry & Health** | Real-time performance metrics and system monitoring |
| **SOLID Architecture** | Clean, maintainable codebase following best practices |
| **Production Ready** | 464 test cases with 100% pass rate |

## Available Pattern Categories

| Category | Count | Examples |
|----------|-------|----------|
| **Classic GoF Patterns** | 34 | Factory, Builder, Observer, Strategy, Command |
| **Architectural Patterns** | 56 | MVC, Clean Architecture, Hexagonal, DDD |
| **Microservices & Cloud** | 39 | Circuit Breaker, Saga, Service Mesh |
| **Data Engineering** | 54 | Repository, CQRS, Event Sourcing |
| **AI/ML & MLOps** | 46 | RAG, Fine-Tuning, Model Compression |
| **React Patterns** | 27 | Hooks, Server Components, Performance |
| **Blockchain & Web3** | 115 | DeFi, NFTs, Smart Contracts, MEV |
| **Concurrency & Reactive** | 45 | Producer-Consumer, Actor Model |
| **Security** | 21 | OAuth, RBAC, Zero Trust |
| **Functional Programming** | 26 | Monads, Functors, Higher-Order Functions |

## Architecture

```
src/
├── adapters/              # External service adapters (LLM, embeddings)
├── cli/                   # CLI commands (migrate, seed, embeddings, setup-relationships)
├── core/                  # DI Container, configuration builder
├── db/                    # Database migrations
├── events/                # Event bus system
├── handlers/              # MCP request handlers (hybrid search, recommendations)
├── health/                # Health check services
├── repositories/          # Data access layer
├── search/                # Hybrid search engine
├── services/              # Business services (cache, telemetry, pattern service)
├── strategies/            # Strategy pattern implementations
├── types/                 # TypeScript type definitions
└── mcp-server.ts          # MCP server entry point

data/
├── patterns/              # 750+ JSON pattern definitions
└── design-patterns.db     # SQLite database with embeddings
```

## Usage

### Finding Patterns

Ask natural language questions through your MCP client:

```
"I need to create complex objects with many optional configurations"
→ Builder, Abstract Factory, Factory Method

"How to handle service failures gracefully in distributed systems?"
→ Circuit Breaker, Bulkhead, Retry, Fallback

"What pattern helps with state-dependent behavior in React?"
→ State Machine, Observer, useReducer

"How to implement secure authentication and authorization?"
→ OAuth 2.0, RBAC, JWT, Zero Trust
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `find_patterns` | Hybrid search for patterns using problem descriptions |
| `search_patterns` | Keyword or semantic search with filtering |
| `get_pattern_details` | Comprehensive pattern information with code examples |
| `count_patterns` | Statistics about available patterns |
| `get_health_status` | System health and service status |

## Installation

### Prerequisites

- Node.js >= 18.0.0
- Bun >= 1.0.0 (recommended) or npm >= 8.0.0

### Setup

```bash
# Install dependencies
bun install

# Build project
bun run build

# Complete database setup (migrate + seed + embeddings + relationships)
bun run db:setup

# Or run steps individually
bun run migrate
bun run seed
bun run generate-embeddings
bun run setup-relationships
```

### MCP Configuration

Add to your `.mcp.json` or Claude Desktop configuration:

```json
{
  "mcpServers": {
    "design-patterns": {
      "command": "node",
      "args": ["dist/src/mcp-server.js"],
      "cwd": "/path/to/design-patterns-mcp",
      "env": {
        "LOG_LEVEL": "info",
        "DATABASE_PATH": "./data/design-patterns.db",
        "ENABLE_HYBRID_SEARCH": "true",
        "ENABLE_GRAPH_AUGMENTATION": "true",
        "EMBEDDING_COMPRESSION": "true",
        "ENABLE_FUZZY_LOGIC": "true",
        "ENABLE_TELEMETRY": "true",
        "ENABLE_MULTI_LEVEL_CACHE": "true"
      }
    }
  }
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `DATABASE_PATH` | `./data/design-patterns.db` | SQLite database path |
| `ENABLE_HYBRID_SEARCH` | `true` | Enable blended RAG search |
| `ENABLE_GRAPH_AUGMENTATION` | `true` | Enable pattern relationship traversal |
| `EMBEDDING_COMPRESSION` | `true` | Dimensionality reduction |
| `ENABLE_FUZZY_LOGIC` | `true` | Fuzzy logic result refinement |
| `ENABLE_TELEMETRY` | `true` | Performance metrics |
| `ENABLE_MULTI_LEVEL_CACHE` | `true` | L1 + L3 caching |
| `MAX_CONCURRENT_REQUESTS` | `10` | Request concurrency limit |
| `CACHE_MAX_SIZE` | `1000` | Cache size limit |
| `CACHE_TTL` | `3600000` | Cache TTL in milliseconds |

## Commands

```bash
# Development
bun run build        # Compile TypeScript
bun run dev          # Development with hot reload
bun run start        # Build and start production server

# Database
bun run db:setup     # Complete database setup
bun run migrate      # Run migrations
bun run seed         # Seed pattern data
bun run generate-embeddings  # Generate semantic embeddings
bun run setup-relationships  # Setup pattern relationships

# Quality
bun run test         # Run all tests
bun run lint         # Check code quality
bun run lint:fix     # Auto-fix linting issues
bun run typecheck    # TypeScript type checking
```

## Testing

The project includes **464 test cases across 41 test files** with 100% pass rate:

- **Contract Tests**: MCP protocol compliance validation
- **Integration Tests**: Component interaction tests
- **Performance Tests**: Search and vectorization benchmarks
- **Unit Tests**: Individual component tests

```bash
# Run all tests
bun run test

# Run specific test suites
bun run test:unit -- --grep "PatternService"
bun run test:integration -- --grep "database"
bun run test:performance -- --timeout 30000
```

## Architecture Patterns

This project implements the patterns it documents:

| Pattern | Implementation |
|---------|----------------|
| Repository | `repositories/pattern-repository.ts` |
| Service Layer | `services/pattern-service.ts` |
| Object Pool | `services/statement-pool.ts` |
| Dependency Injection | `core/container.ts` |
| Strategy | `strategies/search-strategy.ts` |
| Event Bus | `events/event-bus.ts` |
| Multi-Level Cache | `services/multi-level-cache.ts` |
| Builder | `core/config-builder.ts` |

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch
3. Make changes following SOLID principles
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [sqlite-vec](https://github.com/asg017/sqlite-vec)
- [Design Patterns Catalog](https://refactoring.guru/design-patterns)

---

**Version**: 0.4.2  
**Last Updated**: January 2026  
**Patterns**: 685+ (750+ JSON files)  
**Tests**: 464 test cases | 100% pass rate
