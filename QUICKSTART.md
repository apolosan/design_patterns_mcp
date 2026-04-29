# Quickstart - Design Patterns MCP Server

## Prerequisites

- Node.js >= 18.0.0
- Bun >= 1.0.0 (recommended) or npm >= 8.0.0
- Docker & Docker Compose (for HTTP mode)

---

## Setup (Common)

### Using Bun (recommended)

```bash
bun install
bun run build
bun run db:setup
```

### Using npm

The `prepare` lifecycle script in `package.json` requires `bun`. If you don't have `bun` installed, use `--ignore-scripts` to skip it and build manually with `npx tsc`:

```bash
npm install --ignore-scripts
npx tsc

# Setup database
node dist/src/cli/migrate.js
node dist/src/cli/seed.js
node dist/src/cli/generate-embeddings.js
node dist/src/cli/setup-relationships.js
```

---

## STDIO Mode

### Start the server

```bash
# Development with hot reload
bun run dev

# Or directly
bun dist/src/mcp-server.js
```

### Test with stdio client

```bash
bun run test-mcp-stdio.js
```

---

## HTTP Mode

### Start the server (Docker)

```bash
docker compose up --build -d
```

### Test with HTTP client

```bash
bun run test-mcp-http.js http://localhost:3000/mcp
```

### Endpoints

- Health check: `GET http://localhost:3000/health`
- MCP JSON-RPC: `POST http://localhost:3000/mcp`

---

## Client Configuration

### Claude Desktop (`.mcp.json`)

**File location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**

```json
{
  "mcpServers": {
    "design-patterns": {
      "command": "node",
      "args": ["/absolute/path/to/design-patterns-mcp/dist/src/mcp-server.js"],
      "env": {
        "LOG_LEVEL": "info",
        "DATABASE_PATH": "/absolute/path/to/design-patterns-mcp/data/design-patterns.db",
        "ENABLE_HYBRID_SEARCH": "true",
        "ENABLE_GRAPH_AUGMENTATION": "true"
      }
    }
  }
}
```

---

### Cursor (`.mcp.json`)

**File location:**
- Global: `~/.cursor/mcp.json`
- Project: `.cursor/mcp.json` (in project root)

**Configuration:**

```json
{
  "mcpServers": {
    "design-patterns": {
      "command": "node",
      "args": ["/absolute/path/to/design-patterns-mcp/dist/src/mcp-server.js"],
      "env": {
        "LOG_LEVEL": "info",
        "DATABASE_PATH": "/absolute/path/to/design-patterns-mcp/data/design-patterns.db",
        "ENABLE_HYBRID_SEARCH": "true",
        "ENABLE_GRAPH_AUGMENTATION": "true"
      }
    }
  }
}
```

> **Important:** Cursor does not reliably honor the `cwd` field for stdio MCP servers. Always use absolute paths for both `args` and `DATABASE_PATH`. Relative paths will resolve against the user's home directory, causing "Cannot find module" or database errors.

**Project-level config with interpolation:**
```json
{
  "mcpServers": {
    "design-patterns": {
      "command": "node",
      "args": ["${workspaceFolder}/dist/src/mcp-server.js"],
      "env": {
        "DATABASE_PATH": "${workspaceFolder}/data/design-patterns.db",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

> `${workspaceFolder}` interpolation only works in project-level configs (`.cursor/mcp.json`), not in the global `~/.cursor/mcp.json`.

---

### OpenCode (`opencode.json`)

**File location:**
- Global: `~/.config/opencode/opencode.json`
- Project: `opencode.json` (in project root)

**STDIO Mode:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "design-patterns": {
      "type": "local",
      "command": ["node", "/absolute/path/to/design-patterns-mcp/dist/src/mcp-server.js"],
      "enabled": true,
      "environment": {
        "LOG_LEVEL": "info",
        "DATABASE_PATH": "/absolute/path/to/design-patterns-mcp/data/design-patterns.db"
      }
    }
  }
}
```

**HTTP Mode:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "design-patterns": {
      "type": "remote",
      "url": "http://localhost:3000/mcp",
      "enabled": true
    }
  }
}
```

---

### Shared Configuration (Claude + Cursor)

Create a shared config file and symlink to both locations:

```bash
# Create shared config directory
mkdir -p ~/.config/shared-mcp

# Save as ~/.config/shared-mcp/design-patterns.json
# Replace /absolute/path/to/design-patterns-mcp with your actual install path
cat > ~/.config/shared-mcp/design-patterns.json << 'EOF'
{
  "mcpServers": {
    "design-patterns": {
      "command": "node",
      "args": ["/absolute/path/to/design-patterns-mcp/dist/src/mcp-server.js"],
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
EOF

# Link to Claude Desktop (macOS)
ln -sf ~/.config/shared-mcp/design-patterns.json ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Link to Cursor
ln -sf ~/.config/shared-mcp/design-patterns.json ~/.cursor/mcp.json
```

---

## HTTP Remote Servers

### Claude Desktop (HTTP)

```json
{
  "mcpServers": {
    "design-patterns": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer ${env:MCP_TOKEN}"
      }
    }
  }
}
```

### Cursor (HTTP)

```json
{
  "mcpServers": {
    "design-patterns": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer ${env:MCP_TOKEN}"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSPORT_MODE` | `stdio` | Transport mode (`stdio` or `http`) |
| `HTTP_PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `./data/design-patterns.db` | SQLite database path |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `ENABLE_HYBRID_SEARCH` | `true` | Enable hybrid search |
| `ENABLE_GRAPH_AUGMENTATION` | `true` | Enable graph augmentation |
| `EMBEDDING_COMPRESSION` | `true` | Enable embedding compression |
| `ENABLE_FUZZY_LOGIC` | `true` | Enable fuzzy logic |
| `ENABLE_TELEMETRY` | `true` | Enable telemetry |
| `ENABLE_MULTI_LEVEL_CACHE` | `true` | Enable multi-level cache |

---

## Troubleshooting

### `npm install` fails with "sh: bun: command not found"

The `prepare` lifecycle script requires `bun`. Either install bun (`curl -fsSL https://bun.sh/install | bash`) or skip the hook:

```bash
npm install --ignore-scripts
npx tsc
```

### Cursor shows "Cannot find module" for the MCP server

Cursor does not reliably honor the `cwd` field in MCP server configs. Use absolute paths:

```json
{
  "args": ["/absolute/path/to/design-patterns-mcp/dist/src/mcp-server.js"],
  "env": {
    "DATABASE_PATH": "/absolute/path/to/design-patterns-mcp/data/design-patterns.db"
  }
}
```

### Cursor shows MCP server errors on startup

The pattern seeder logs warnings about missing cross-references during initialization. Prior to v0.4.4, these used `console.warn()` which writes to stderr — MCP clients like Cursor interpret any stderr output as errors. This was fixed by routing these messages through the structured `logger.warn()`, which writes to stdout and respects the `LOG_LEVEL` setting.

If you see these warnings, rebuild from the latest source:

```bash
npx tsc    # or: bun run build
```

Then restart the MCP server in Cursor (`Cmd+Shift+P` → "Developer: Reload Window").

### General reset

```bash
# Reset database
rm data/design-patterns.db
bun run db:setup    # or use the npm steps above

# Clean build
rm -rf dist node_modules
bun install         # or: npm install --ignore-scripts
bun run build       # or: npx tsc

# View Claude Desktop logs (macOS)
tail -n 20 -f ~/Library/Logs/Claude/mcp*.log
```

---

## Useful Links

- Repository: https://github.com/apolosan/design_patterns_mcp
- Documentation: README.md
- Tests: 464 cases | 100% pass rate
