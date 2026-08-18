# Design Patterns MCP Server

[![Version](https://img.shields.io/badge/version-0.7.2-blue.svg)](https://github.com/apolosan/design_patterns_mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Test Status](https://img.shields.io/badge/tests-654%20%7C%20100%25-brightgreen.svg)](#testing)
[![Patterns](https://img.shields.io/badge/patterns-710-orange.svg)](#available-pattern-categories)
[![Built for](https://img.shields.io/badge/built%20for-AI%20coding%20agents-8a2be2.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

An intelligent MCP (Model Context Protocol) server that provides design pattern recommendations using hybrid search (semantic + keyword + graph augmentation). Access **710 design patterns** across 90+ categories through a natural language interface with advanced blended RAG architecture.

## Quick Start

```bash
# Clone and setup
git clone https://github.com/apolosan/design_patterns_mcp.git
cd design_patterns_mcp

# Install dependencies and build (using bun)
bun install
bun run db:setup

# Or using npm (if bun is not installed)
npm install --ignore-scripts
npx tsc
node dist/cli/migrate.js
node dist/cli/seed.js
node dist/cli/generate-embeddings.js
node dist/cli/setup-relationships.js
```

Configure in your MCP client (Claude Desktop, Cursor, etc.) and start discovering patterns through natural language queries.

## Tooling and build hygiene

- Use **Bun** as the canonical package manager for this repository (`bun install` only). The lockfile is `bun.lock`.
- Never copy a `.git` directory into `dist/data` (or ship it inside `dist/`). That path must remain a plain data directory to avoid multi‑gigabyte images and metadata leakage.

## Features

| Feature | Description |
|---------|-------------|
| **Hybrid Search Engine** | Blended RAG combining semantic, keyword (BM25), and graph-augmented retrieval |
| **710 Patterns** | Comprehensive catalog across 90+ categories including **Feature Flag** / Feature Toggle for progressive delivery and experimentation |
| **MCP Integration** | Seamless integration with Claude, Cursor, and other MCP clients |
| **Multi-Level Caching** | L1 in-memory + L3 SQLite cache with 95%+ hit rate |
| **Event Bus System** | Decoupled service communication via pub/sub |
| **Telemetry & Health** | Real-time performance metrics and system monitoring |
| **SOLID Architecture** | Clean, maintainable codebase following best practices |
| **Production Ready** | 654 test cases across 77 test files with 100% pass rate (0 failures, 0 skips) |

## Available Pattern Categories

| Category | Count | Examples |
|----------|-------|----------|
| **Classic GoF Patterns** | 34 | Factory, Builder, Observer, Strategy, Command |
| **Architectural Patterns** | 56 | MVC, Clean Architecture, Hexagonal, DDD, **Feature Flag** |
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
├── patterns/              # 710 JSON pattern definitions (see `feature-flag.json`)
└── design-patterns.db     # SQLite database with 710 patterns and embeddings
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

### Setup with Bun

```bash
bun install
bun run build
bun run db:setup
```

### Setup with npm

The `prepare` script in `package.json` requires `bun`. If you don't have `bun` installed, use `--ignore-scripts` to skip it and build manually:

```bash
npm install --ignore-scripts
npx tsc

# Setup database
node dist/cli/migrate.js
node dist/cli/seed.js
node dist/cli/generate-embeddings.js
node dist/cli/setup-relationships.js
```

### MCP Configuration

Add to your MCP client configuration (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "design-patterns": {
      "command": "node",
      "args": ["/absolute/path/to/design-patterns-mcp/dist/mcp-server.js"],
      "env": {
        "LOG_LEVEL": "info",
        "DATABASE_PATH": "/absolute/path/to/design-patterns-mcp/data/design-patterns.db",
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

> **Important:** Use absolute paths for both `args` and `DATABASE_PATH`. MCP clients like Cursor do not reliably support the `cwd` field, so relative paths resolve against the user's home directory rather than the project directory. See the project quickstart for client-specific configuration examples.

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
| `TRANSPORT_MODE` | `stdio` | Transport mode (stdio/http) |
| `HTTP_PORT` | `3000` | HTTP port (http mode) |
| `MCP_ENDPOINT` | `/mcp` | MCP endpoint path |
| `HEALTH_CHECK_PATH` | `/health` | Health check path |
| `SKIP_DB_SETUP` | `false` | Skip database setup |

## Docker Deployment

### Quick Start

```bash
# Build
docker build -t design-patterns-mcp .

# Run HTTP mode
docker run -p 3000:3000 -e TRANSPORT_MODE=http design-patterns-mcp

# Run stdio mode (default)
docker run design-patterns-mcp
```

### Docker Compose

```bash
docker compose up --build -d
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSPORT_MODE` | `stdio` | Transport mode (stdio/http) |
| `HTTP_PORT` | `3000` | HTTP port (http mode) |
| `MCP_ENDPOINT` | `/mcp` | MCP endpoint path |
| `HEALTH_CHECK_PATH` | `/health` | Health check path |
| `DATABASE_PATH` | `/app/data/design-patterns.db` | SQLite database path |
| `LOG_LEVEL` | `info` | Logging level |
| `SKIP_DB_SETUP` | `false` | Skip database setup |

### Endpoints (HTTP mode)

- `GET /health` - Health check
- `POST /mcp` - MCP JSON-RPC endpoint

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

The project includes **654 test cases across 77 test files** with 100% pass rate (0 failures, 0 skips):

- **Contract Tests**: MCP protocol compliance validation
- **Integration Tests**: Component interaction tests against live SQLite DB and embeddings
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

## Vector search (runtime honesty)

The server uses **sql.js** (SQLite WASM) with **in-memory cosine similarity** over stored embeddings. Native **sqlite-vec** (`vec0` virtual tables) is **not** available in this runtime. Semantic search works for the current catalog size (~710 patterns) but does not use indexed native vector tables.

Enable LLM enrichment only when you have a real provider integration — built-in LLM bridge providers return placeholders unless extended.

## Contributing

Contributions are welcome! See the contributing guide.

1. Fork the repository
2. Create a feature branch
3. Make changes following SOLID principles
4. Run tests and linting
5. Submit a pull request

## Release Notes

### v0.7.2 — Version Bump (2026-08-16)

- Canonical version bumped from `0.7.1` → `0.7.2` across active source and documentation files.
- Files updated: `package.json`, `src/mcp-server.ts` (Server registration + runtime info), `AGENTS.md`, `CLAUDE.md` (canonical-identity header), `README.md` (badge, release-notes section, version footer), `CHANGELOG.md` (new entry). `docs/IMPROVEMENTS_03.md` and `QUICKSTART.md` audit-evidence references preserved untouched per state #45.
- Stale version references corrected: `AGENTS.md` and `CLAUDE.md` header `(version 0.6.0)` → `(version 0.7.2)` (was 7 minor versions behind the actual `package.json`).
- Runtime self-report now advertises `0.7.2` to MCP clients via `Server` constructor and `/info` endpoint.
- No code-level behavioural change: pure release/version-canonicalisation patch.
- Tests: full suite preserved (no test files modified), typecheck clean.

### v0.7.1 — Lint + Test Stabilization (2026-08-16)

- Test suite fully validated: **654/654 GREEN, 0 skips, 0 todos** (was 651/654 with 3 pre-existing flakes).
- Resolved `data/.git` leak introduced by `db:setup` pipeline (data-hygiene test).
- Aligned two outdated tests with the **BUG-007 contract**: snake_case `search_type` is silently ignored by `validateSearchPatternsArgs` and the canonical default `hybrid` strategy is applied.
  - `tests/unit/input-validation.test.ts`
  - `tests/unit/mcp-server-search.test.ts`
- README.md version drift corrected: trailing block now reflects canonical 0.7.0 → 0.7.1 baseline, badge + Production Ready + Testing section aligned with current 654-test suite.
- Lint baseline restored: **0 problems, exit 0** (was 2 errors + 6 warnings).
  - Removed unused `HealthStatus` import in `src/mcp/http-transport.ts`.
  - Added targeted `eslint-disable` for `require-await` on the synchronous `check()` in `src/health/embedding-coverage-health-check.ts` (interface conformance preserved).
  - Refactored `ensureBM25()` in `src/handlers/keyword-search-handler.ts` to return `BM25Scorer`, eliminating 4 non-null assertions at the call sites.
  - Replaced 2 non-null assertions on `results.find()` in `tests/unit/bm25-scorer.test.ts` with explicit `toBeDefined` guards.
- `bun run typecheck` clean.

### v0.7.0 — Catalog Expansion (2026-08-16)

- **24 new design patterns** added from `docs/01_Agentic_Design_Patterns.md` and `docs/02_Data_Engineering_Design_Patterns.md`:
  - **3 Agentic AI**: Multi-Agent Collaboration, Goal Setting and Monitoring, Exception Handling and Recovery.
  - **21 Data Engineering**: Aligned Fan-In, Unaligned Fan-In, Bin Pack Orderer, Exclusive Choice, FIFO Orderer, Fine-Grained Accessor for Resources, Fine-Grained Accessor for Tables, Fine-Grained Tracker, In-Place Overwriter, Isolated Sequencer, Metadata Decorator, Metadata Enhancer, Offline Observer, Schema Compatibility Enforcer, Schema Migrator, Secretless Connector, Secrets Pointer, Single Runner, Skew Detector, SLA Misses Detector, Vertical Partitioner.
- Catalog grew from **686 → 710 patterns** (Agentic AI: 3→6, Data Engineering: 4→25).
- Integrity check PASS: 710 patterns, 151 valid relationships.
- 654/654 tests pass (100% green, 0 skips, 0 todos).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- Vector search notes (sql.js vs sqlite-vec) — see contributing guide
- MCP tools surface reference
- Documentation index
- [Design Patterns Catalog](https://refactoring.guru/design-patterns)

---

**Version**: 0.7.2
**Last Updated**: August 2026
**Patterns**: 710 JSON definitions (highlight: **Feature Flag** / Feature Toggle)
**Tests**: 654 test cases | 100% pass rate (0 failures, 0 skips)

**See also:** the latest adversarial quality assurance report (16 findings: 1 critical, 9 high-priority, 6 minor). Findings cover search pipeline correctness, configuration drift, transport security, and documentation sync.
