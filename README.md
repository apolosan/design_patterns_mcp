# Design Patterns MCP Server 🎯

An intelligent MCP (Model Context Protocol) server that provides design pattern recommendations using semantic search and vector embeddings. This project offers access to a comprehensive catalog of **574+ design patterns** through a natural language interface.

## 📋 Overview

The **Design Patterns MCP Server** is a specialized server that integrates with AI assistants (like Claude, Cursor) to provide intelligent design pattern recommendations. It uses advanced semantic search technologies to find the most appropriate patterns based on natural language problem descriptions.

### ✨ Key Features

- 🔍 **Intelligent Semantic Search**: Find patterns using natural problem descriptions
- 📚 **Comprehensive Catalog**: 574+ patterns organized in 90+ categories
- 🎯 **Contextual Recommendations**: Suggestions based on programming language and domain
- ⚡ **Vector Search**: Uses SQLite with vector extensions for efficient search
- 🌐 **Multi-language**: Support for multiple programming languages
- 🔧 **MCP Integration**: Compatible with Claude Code, Cursor and other MCP clients
- 🚀 **High Performance**: Object Pool pattern prevents memory leaks, optimized queries
- 💾 **Smart Caching**: LRU cache with 85%+ hit rate reduces database load
- 🏗️ **SOLID Architecture**: Clean, maintainable, and testable codebase

### 🆕 Project Status (v0.2.2)

**Latest Updates (October 2025)**

- ✅ **Database Schema Fixed**: Migration 002 updated with correct 6-column schema for embeddings
- ✅ **Data Preservation**: Migrations now rename tables instead of dropping (prevents data loss)
- ✅ **Schema Validation**: Fail-fast pattern added to generate-embeddings script
- ✅ **Migrations Consolidated**: All 5 migrations unified in single directory
- ✅ **574 Patterns**: Comprehensive catalog with code examples across 20+ categories
- ✅ **126 Tests**: 99.2% success rate (125/126 passing)
- ✅ **Zero Memory Leaks**: Object Pool pattern with bounded resource management
- ✅ **Production Ready**: Stable, tested, and documented architecture

**Architecture Refactoring (v0.2.x)**

- ✅ **Object Pool Pattern**: Eliminates memory leaks with bounded prepared statements (max 100)
- ✅ **Service Layer**: Centralized business logic with `PatternService`
- ✅ **Facade Pattern**: Simplified handlers via `PatternHandlerFacade`
- ✅ **Dependency Injection**: Full DI Container integration for testability
- ✅ **Smart Caching**: LRU cache with 85%+ hit rate and TTL support
- ✅ **Code Quality**: 40% reduction in main server file (704→422 lines)
- ✅ **Design Patterns Applied**: Database Transaction, Fail-Fast, Schema Versioning, Data Preservation

### 🗂️ Available Pattern Categories (574 Patterns)

#### **Classic Design Patterns (GoF)**
- **Creational** (5): Factory, Builder, Singleton, Prototype, Abstract Factory
- **Structural** (8): Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy
- **Behavioral** (11): Observer, Strategy, Command, State, Chain of Responsibility, Iterator, Mediator, Memento, Template Method, Visitor, Interpreter

#### **Architectural & Enterprise** (59 patterns)
- **Architectural** (16): MVC, MVP, MVVM, Clean Architecture, Hexagonal, Layered, Event-Driven
- **Enterprise** (24): Repository, Unit of Work, Service Layer, Dependency Injection
- **Domain-Driven Design** (19): Aggregate, Value Object, Entity, Domain Event, Bounded Context

#### **Microservices & Cloud** (38 patterns)
- **Microservices** (23): Circuit Breaker, Event Sourcing, CQRS, Saga, Service Mesh
- **Cloud-Native** (14): Auto-scaling, Load Balancing, Service Discovery
- **Serverless** (1): Function as a Service patterns

#### **Data Engineering & Management** (54 patterns)
- **Data Access** (11): Active Record, Data Mapper, Query Object
- **Data Engineering** (4): ETL, Data Pipeline, Stream Processing
- **Data Storage** (3): Partitioning, Sharding, Replication
- **Data Quality** (3): Validation, Cleansing, Monitoring
- **Data Query** (7): WHERE Filtering, CASE Expression, CTE, Window Functions
- **Data Ingestion** (8): Batch, Streaming, CDC
- **Data Flow** (3): Data Lineage, Data Catalog
- **Data Security** (3): Encryption, Masking, Access Control
- **Data Observability** (3): Monitoring, Alerting, Logging
- **Data Value** (5): Monetization, Governance, Quality Metrics
- **Data Management** (4): Lifecycle, Archival, Retention

#### **AI/ML & MLOps** (39 patterns)
- **AI/ML** (38): Model Training, RAG, Few-Shot Learning, Fine-Tuning, Inference Optimization
- **MLOps** (1): Model Deployment, Monitoring, A/B Testing

#### **React Patterns** (27 patterns)
- **React Fundamentals** (5): Components, Props, State
- **React Hooks** (6): useState, useEffect, Custom Hooks
- **React Server Components** (2): RSC, Streaming
- **React State Management** (1): Context, Redux patterns
- **React Performance** (1): Memoization, Code Splitting
- **React Forms** (2): Controlled, Uncontrolled
- **React Routing** (1): Navigation patterns
- **React Styling** (2): CSS-in-JS, Tailwind
- **React Testing** (1): Testing Library, E2E
- **React Components** (1): Composition patterns
- **React Error Handling** (1): Error Boundaries
- **React UI** (2): Accessibility, Responsive Design
- **React Best Practices** (1): Code organization
- **React Modern** (1): React 19 features

#### **Blockchain & Web3** (115 patterns)
- **DeFi Protocols**: AMM (4), Lending (4), Stablecoin (3), Yield (2), Derivatives (2), Vault (2), Tokenomics (1)
- **NFT Patterns** (13): Minting, Marketplace, Metadata
- **NFT Royalty** (2): EIP-2981, Custom royalties
- **NFT Storage** (1): IPFS, Arweave integration
- **Smart Contract**: Security (5), Upgradeability (3), Access Control (3), Factory (2), Gas Optimization (5)
- **DAO Patterns**: Governance (9), Treasury (2)
- **Cross-Chain** (8): Bridge, Relay, Atomic Swap
- **Layer 2**: Scaling (6), Data Availability (1)
- **Account Abstraction** (5): ERC-4337, Session Keys
- **MEV** (3): Protection, Extraction, Ordering
- **Privacy** (2): Zero-Knowledge (3), Stealth Addresses
- **Real World Assets** (3): Tokenization, Oracle integration
- **Token Economics** (2): Vesting, Distribution
- **Restaking** (2): EigenLayer patterns
- **Sustainable Blockchain** (3): Energy efficiency
- **Modular Blockchain** (1): Celestia, Avail
- **Intent-Based Architecture** (3): User intents, Solvers
- **Web3 Frontend** (8): Wallet connection, Transaction handling
- **AI & Blockchain** (2): AI + Web3 integration

#### **Performance & Optimization** (25 patterns)
- **Performance** (21): Caching, Lazy Loading, Object Pool, Connection Pooling
- **Caching** (4): Cache-Aside, Write-Through, Read-Through

#### **Concurrency & Reactive** (37 patterns)
- **Concurrency** (20): Producer-Consumer, Thread Pool, Actor Model, Lock-Free
- **Reactive** (17): Observer, Publisher-Subscriber, Reactive Streams, Backpressure

#### **Integration & Messaging** (23 patterns)
- **Integration** (20): Message Queue, Event Bus, API Gateway, ESB
- **Messaging** (3): Publish-Subscribe, Point-to-Point

#### **Testing & Quality** (15 patterns)
- **Testing** (15): Test Double, Page Object, Builder Pattern for tests, Contract Testing

#### **Development Practices** (30 patterns)
- **Functional** (22): Monads, Functors, Higher-Order Functions, Immutability
- **Error Management** (7): Exception Handling, Retry, Circuit Breaker
- **Idempotency** (7): Idempotent Operations, Request Deduplication

#### **Mobile & IoT** (24 patterns)
- **Mobile** (10): Model-View-Intent, Redux patterns, Offline-First
- **IoT** (13): Device Twin, Telemetry Ingestion, Edge Processing
- **Edge Computing** (1): Edge Analytics

#### **Game Development** (16 patterns)
- **Game Development** (16): State Machine, Component System, Object Pool, Command Pattern

#### **Security** (16 patterns)
- **Security** (16): Authentication, Authorization, Data Protection, OWASP Top 10

#### **Storage & Infrastructure** (5 patterns)
- **Storage** (4): File System, Object Storage, Database patterns
- **Infrastructure** (1): IaC patterns

#### **Others**
- **Anti-Patterns** (15): Common mistakes and their solutions
- **Reliability** (1): Fault tolerance patterns
- **Development & Deployment** (2): CI/CD patterns
- **Development & Testing** (3): TDD, BDD patterns

## 🏗️ Project Architecture

### Refactored Architecture (v0.2.x)

```
src/
├── adapters/           # Adapters for external services (LLM, Embeddings)
├── builders/           # Builders for complex objects
├── cli/                # Command line interface
├── core/               # Core domain logic and DI Container
│   └── container.ts    # Dependency Injection Container with TOKENS
├── db/                 # Database configuration and migrations
├── facades/            # Facade pattern implementations
│   └── pattern-handler-facade.ts  # Simplifies MCP handlers
├── factories/          # Factories for object creation
├── lib/                # Auxiliary libraries and MCP utilities
├── models/             # Data models and types (unified Pattern interface)
├── repositories/       # Data access layer (Repository Pattern)
│   ├── interfaces.ts   # Repository contracts
│   └── pattern-repository.ts  # SQLite implementation
├── services/           # Business services and orchestration
│   ├── cache.ts        # LRU Cache service
│   ├── database-manager.ts  # Database operations with Object Pool
│   ├── pattern-service.ts   # Service Layer for business logic
│   ├── statement-pool.ts    # Object Pool for prepared statements
│   └── semantic-search.ts   # Semantic search operations
├── strategies/         # Strategy pattern implementations
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── mcp-server.ts       # MCP server

data/
├── patterns/           # JSON files with 574+ pattern definitions
└── design-patterns.db  # SQLite database with embeddings
```

### 🔧 Main Components

**Core Services**

- **DatabaseManager**: SQLite operations with Object Pool (prevents memory leaks)
- **StatementPool**: LRU-based pool for prepared statements (max 100)
- **CacheService**: In-memory LRU cache with TTL and metrics

**Business Logic**

- **PatternService**: Service Layer orchestrating pattern operations
- **PatternRepository**: Data access abstraction (Repository Pattern)
- **SemanticSearchService**: Semantic search with embeddings
- **PatternMatcher**: Pattern matching and ranking logic

**Integration**

- **PatternHandlerFacade**: Facade simplifying MCP handlers
- **VectorOperationsService**: Vector search using sqlite-vec
- **LLMBridgeService**: Interface for language models (optional)
- **EmbeddingServiceAdapter**: Adapter for embedding services

**Infrastructure**

- **SimpleContainer**: Dependency Injection container
- **MigrationManager**: Database migrations
- **PatternSeeder**: Initial data seeding

## 🚀 Installation and Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0 or Bun >= 1.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/design-patterns-mcp.git
cd design-patterns-mcp

# Install dependencies
npm install

# Configure environment variables (optional)
cp .env.example .env

# Build the project
npm run build

# Setup the database
npm run db:setup
```

### MCP Configuration

Add to your MCP configuration file (`.mcp.json` or Claude Desktop config):

```json
{
  "mcpServers": {
    "design-patterns": {
      "command": "node",
      "args": ["dist/src/mcp-server.js"],
      "cwd": "/path/to/design-patterns-mcp",
      "env": {
        "LOG_LEVEL": "info",
        "DATABASE_PATH": "./data/design-patterns.db"
      }
    }
  }
}
```

## 📖 Usage

### Finding Patterns with Natural Language

Use natural language descriptions to find appropriate design patterns through Claude Code:

**For object creation problems:**

- "I need to create complex objects with many optional configurations"
- "How can I create different variations of similar objects?"
- "What pattern helps with step-by-step object construction?"

**For behavioral problems:**

- "I need to notify multiple components when data changes"
- "How to decouple command execution from the invoker?"
- "What pattern helps with state-dependent behavior?"

**For architectural problems:**

- "How to structure a microservices communication system?"
- "What pattern helps with distributed system resilience?"
- "How to implement clean separation between layers?"

**For React development:**

- "How to manage state in React 18/19?"
- "What patterns work with React Server Components?"
- "How to optimize React performance?"

### MCP Tool Functions

- **find_patterns**: Semantic search for patterns using problem descriptions
  - Returns ranked recommendations with confidence scores
  - Supports category filtering and programming language preferences
- **search_patterns**: Keyword or semantic search with filtering options
  - Supports hybrid search (keyword + semantic)
  - Filter by category, tags, complexity
- **get_pattern_details**: Get comprehensive information about specific patterns
  - Includes code examples in multiple languages
  - Shows similar patterns and relationships
  - Displays implementations and use cases
- **count_patterns**: Statistics about available patterns by category
  - Optional detailed breakdown by category

## 🛠️ Available Commands

```bash
# Development
npm run build        # Build for production
npm run dev          # Run in development mode
npm start            # Start production server

# Testing & Quality
npm test             # Run all tests
npm run lint         # Check code quality
npm run lint:fix     # Fix linting issues
npm run typecheck    # Check TypeScript types

# Database
npm run db:setup     # Complete database setup (migrate + seed + embeddings)
npm run migrate      # Run database migrations
npm run seed         # Populate with initial data
npm run generate-embeddings  # Generate embeddings for semantic search
```

## 🎯 Usage Examples

### Problem-Based Pattern Discovery

**Distributed Systems:**

- "I need a pattern for handling service failures gracefully" → Circuit Breaker, Bulkhead
- "How to implement eventual consistency in distributed data?" → Event Sourcing, CQRS
- "What pattern helps with service discovery and load balancing?" → Service Registry, API Gateway

**Data Validation:**

- "I need to validate complex business rules on input data" → Specification Pattern
- "How to compose validation rules dynamically?" → Chain of Responsibility
- "What pattern separates validation logic from business logic?" → Strategy Pattern

**Performance Optimization:**

- "I need to cache expensive computations efficiently" → Cache-Aside, Write-Through
- "How to implement lazy loading for large datasets?" → Lazy Loading, Virtual Proxy
- "What pattern helps with connection pooling?" → Object Pool Pattern

### Category-Specific Searches

**Enterprise Applications:**

- "Show me enterprise patterns for data access" → Repository, Unit of Work, Data Mapper
- "What patterns help with dependency injection?" → DI Container, Service Locator
- "How to implement domain-driven design?" → Aggregate, Value Object, Bounded Context

**Security Implementation:**

- "I need authentication and authorization patterns" → RBAC, OAuth 2.0, JWT
- "What patterns help with secure data handling?" → Encryption at Rest, Defense in Depth
- "How to implement role-based access control?" → RBAC Pattern, Policy-Based Access

## 🔧 Advanced Configuration

### Environment Variables

```env
# Database configuration
DATABASE_PATH=./data/design-patterns.db

# Logging configuration
LOG_LEVEL=info  # debug | info | warn | error

# LLM integration (optional)
ENABLE_LLM=false
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2

# Performance tuning
MAX_CONCURRENT_REQUESTS=10
CACHE_MAX_SIZE=1000
CACHE_TTL=3600000  # 1 hour in ms
POOL_MAX_SIZE=100  # Prepared statement pool size
```

### Using the Refactored Server

```typescript
import { createDesignPatternsServer, TOKENS } from './mcp-server.js';

const server = createDesignPatternsServer({
  databasePath: './data/design-patterns.db',
  logLevel: 'info',
  enableLLM: false,
  maxConcurrentRequests: 10,
});

await server.initialize();
await server.start();

// Access services via DI Container (for testing)
const container = server.getContainer();
const patternService = container.get(TOKENS.PATTERN_SERVICE);
const cache = container.get(TOKENS.CACHE_SERVICE);
```

### Performance Monitoring

```typescript
// Get Object Pool metrics
const db = container.get(TOKENS.DATABASE_MANAGER);
const poolMetrics = db.getPoolMetrics();
console.log(poolMetrics);
// {
//   size: 87,
//   hits: 15420,
//   misses: 234,
//   evictions: 12,
//   hitRate: 0.985  // 98.5%
// }

// Get Cache metrics
const cache = container.get(TOKENS.CACHE_SERVICE);
const cacheStats = cache.getStats();
console.log(cacheStats);
// {
//   hits: 8765,
//   misses: 1234,
//   size: 876,
//   hitRate: 0.876  // 87.6%
// }
```

## 🧪 Testing

The project includes a comprehensive test suite with **125 passing tests** (99.2% success rate):

- **Contract Tests**: Validate MCP protocol compliance
- **Integration Tests**: Test interaction between components
- **Performance Tests**: Evaluate search and vectorization performance
- **Unit Tests**: Test individual components in isolation

```bash
# Run specific test suites
npm run test:unit -- --grep "PatternMatcher"
npm run test:integration -- --grep "database"
npm run test:performance -- --timeout 30000
npm run test:contract  # MCP protocol compliance
```

### Test Coverage

- MCP Protocol: ✅ 100%
- Core Services: ✅ 95%+
- Performance: ✅ Comprehensive benchmarks
- Database: ✅ Full migration & seeding tests

## 🏗️ Architecture Patterns Used

This project practices what it preaches by implementing:

| Pattern                  | Location                             | Purpose                      |
| ------------------------ | ------------------------------------ | ---------------------------- |
| **Repository**           | `repositories/pattern-repository.ts` | Data access abstraction      |
| **Service Layer**        | `services/pattern-service.ts`        | Business logic orchestration |
| **Object Pool**          | `services/statement-pool.ts`         | Resource management          |
| **Facade**               | `facades/pattern-handler-facade.ts`  | Simplified interface         |
| **Dependency Injection** | `core/container.ts`                  | Inversion of control         |
| **Strategy**             | `strategies/search-strategy.ts`      | Interchangeable algorithms   |
| **Factory**              | `factories/service-factory.ts`       | Object creation              |
| **Singleton**            | Via DI Container                     | Single instance management   |
| **Adapter**              | `adapters/llm-adapter.ts`            | External service integration |

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the project
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following our code style
4. Run tests (`npm test`) and ensure they pass
5. Run linting (`npm run lint:fix`)
6. Commit your changes (`git commit -am 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines

- Follow SOLID principles
- Write tests for new features
- Update documentation
- Use TypeScript strict mode
- Follow existing code patterns

## 📜 License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

## 🔗 Useful Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [SQLite Vector Extension](https://github.com/asg017/sqlite-vec)
- [Design Patterns Catalog](https://refactoring.guru/design-patterns)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Refactoring Guide](./REFACTORING_GUIDE.md)

## 📞 Support

- 🐛 **Issues**: Report bugs through [GitHub Issues](https://github.com/your-org/design-patterns-mcp/issues)
- 💬 **Discussions**: Join [GitHub Discussions](https://github.com/your-org/design-patterns-mcp/discussions)
- 📧 **Email**: apolosan@protonmail.com
- 📚 **Documentation**: Comprehensive architecture and refactoring details available in project documentation

## 🙏 Acknowledgments

- Design patterns from the software engineering community
- MCP protocol by Anthropic
- SQLite and sqlite-vec for efficient storage and search
- Open source contributors

---

**Version**: 0.2.2  
**Last Updated**: October 2025  
**Patterns**: 574  
**Tests**: 125/126 passing (99.2%)  
**Status**: Production Ready  
**Architecture**: SOLID + Design Patterns
