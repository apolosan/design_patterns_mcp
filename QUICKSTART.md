# Quickstart - Design Patterns MCP Server

## Prerequisites

- Node.js >= 18.0.0
- Bun >= 1.0.0 (recommended) or npm >= 8.0.0
- Docker & Docker Compose (for HTTP mode)

---

## Setup (Common)

```bash
# Install dependencies
bun install

# Build project
bun run build

# Complete database setup
bun run db:setup
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
        "DATABASE_PATH": "./data/design-patterns.db",
        "ENABLE_HYBRID_SEARCH": "true",
        "ENABLE_GRAPH_AUGMENTATION": "true"
      }
    }
  }
}
```

**Note:** Claude Desktop uses `command` + `args` arrays. Environment variables are inline with the server config.

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
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/design-patterns-mcp/dist/src/mcp-server.js"],
      "env": {
        "LOG_LEVEL": "info",
        "DATABASE_PATH": "./data/design-patterns.db",
        "ENABLE_HYBRID_SEARCH": "true",
        "ENABLE_GRAPH_AUGMENTATION": "true"
      }
    }
  }
}
```

**Config interpolation supported:**
```json
{
  "mcpServers": {
    "design-patterns": {
      "type": "stdio",
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
        "DATABASE_PATH": "./data/design-patterns.db"
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
cat > ~/.config/shared-mcp/design-patterns.json << 'EOF'
{
  "mcpServers": {
    "design-patterns": {
      "command": "node",
      "args": ["/absolute/path/to/design-patterns-mcp/dist/src/mcp-server.js"],
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
EOF

# Link to Claude Desktop (macOS)
ln -sf ~/.config/shared-mcp/design-patterns.json ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Link to Cursor
ln -sf ~/.config/shared-mcp/design-patterns.json ~/.cursor/mcp.json
```

**Note:** For Cursor, add `"type": "stdio"` to the server config if you want explicit type declaration.

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

```bash
# Reset database
rm data/design-patterns.db
bun run db:setup

# Clean build
rm -rf dist node_modules
bun install
bun run build

# View Claude Desktop logs
tail -n 20 -f ~/Library/Logs/Claude/mcp*.log
```

---

## Useful Links

- Repository: https://github.com/apolosan/design_patterns_mcp
- Documentation: README.md
- Tests: 464 cases | 100% pass rate
