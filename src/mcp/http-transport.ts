/**
 * HTTP transport for MCP server (Streamable HTTP + health endpoint).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { runWithClientKey } from '../utils/rate-limiter.js';
import { HealthCheckService } from '../health/health-check-service.js';
import { HealthStatus } from '../health/types.js';
import type { Logger } from '../services/logger.js';
import type { MCPServerConfig } from '../core/config-builder.js';
import { createHealthCache, type HealthCache, type HealthCacheOptions } from './health-cache.js';

export interface HttpTransportOptions {
  config: MCPServerConfig;
  mcpServer: Server;
  healthService?: HealthCheckService;
  logger: Logger;
  healthCacheTtlMs?: number;
  healthCache?: HealthCache;
}

export function startHttpServer(options: HttpTransportOptions): Promise<void> {
  const { config, mcpServer, healthService, logger } = options;
  const port = config.httpPort ?? 3000;
  const hostname = config.httpBindHost ?? '127.0.0.1';
  const healthPath = config.healthCheckPath ?? '/health';
  const mcpEndpoint = config.mcpEndpoint ?? '/mcp';
  const authToken =
    typeof config.httpAuthToken === 'string' && config.httpAuthToken.length > 0
      ? config.httpAuthToken
      : undefined;
  const healthCache: HealthCache =
    options.healthCache ??
    createHealthCache({ ttlMs: options.healthCacheTtlMs } as HealthCacheOptions);

  Bun.serve({
    hostname,
    port,
    idleTimeout: 255,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);

      if (authToken) {
        const authorization = req.headers.get('authorization');
        const bearer = authorization?.startsWith('Bearer ')
          ? authorization.slice('Bearer '.length)
          : authorization;
        const apiKey = req.headers.get('x-api-key');
        const provided = bearer ?? apiKey;
        if (provided !== authToken) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      if (url.pathname === healthPath || url.pathname === '/health') {
        if (healthService) {
          let report = healthCache.get();
          if (!report) {
            report = await healthService.checkAll();
            healthCache.set(report);
          }
          const statusCode = report.overall === HealthStatus.HEALTHY ? 200 : 503;
          return new Response(JSON.stringify(report), {
            status: statusCode,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ status: 'healthy' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === mcpEndpoint || url.pathname.startsWith(`${mcpEndpoint}/`)) {
        const clientKey =
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          req.headers.get('x-api-key') ??
          req.headers.get('x-real-ip') ??
          'http-anonymous';

        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });

        await mcpServer.connect(transport);
        return runWithClientKey(clientKey, () => transport.handleRequest(req));
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  logger.info('mcp-server', `HTTP server listening on ${hostname}:${port}`);
  return Promise.resolve();
}
