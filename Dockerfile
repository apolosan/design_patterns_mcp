# Dockerfile - Design Patterns MCP Server
# Build executado DENTRO do container para universal startup

FROM oven/bun:1

LABEL maintainer="Design Patterns MCP Team"
LABEL description="MCP Server for Design Patterns with Hybrid Search"
LABEL version="0.4.3"

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile --ignore-scripts

COPY . .

RUN bun run build

RUN if [ ! -f /app/data/design-patterns.db ]; then \
      bun run migrate && \
      bun run seed && \
      bun run generate-embeddings && \
      bun run setup-relationships; \
    fi

RUN chmod +x /app/dist/src/mcp-server.js

RUN groupadd -g 1001 mcp 2>/dev/null || true && \
    useradd -u 1001 -g mcp -m -s /bin/sh mcp 2>/dev/null || true
USER mcp

EXPOSE 3000

ENV TRANSPORT_MODE=stdio
ENV HTTP_PORT=3000
ENV MCP_ENDPOINT=/mcp
ENV LOG_LEVEL=info
ENV DATABASE_PATH=/app/data/design-patterns.db
ENV HEALTH_CHECK_PATH=/health

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["bun", "dist/src/mcp-server.js"]
