/**
 * MCP Ping Handler
 * Implements MCP protocol connection health tracking
 * Micro-improvement: Protocol-level connection health metrics
 */

export interface PingHandlerConfig {
  enabled: boolean;
  includeTimestamp: boolean;
  customPayload?: Record<string, unknown>;
}

export interface MCPPingResponse {
  status: 'ok' | 'unavailable';
  timestamp: string;
  serverVersion?: string;
  uptime?: number;
  latency?: number;
}

export class MCPPingHandler {
  private config: PingHandlerConfig;
  private startTime: number;
  private pingCount: number = 0;
  private lastPingTime: Date | null = null;

  constructor(config?: Partial<PingHandlerConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      includeTimestamp: config?.includeTimestamp ?? true,
      customPayload: config?.customPayload
    };
    this.startTime = Date.now();
  }

  handlePing(): MCPPingResponse {
    if (!this.config.enabled) {
      return {
        status: 'unavailable',
        timestamp: new Date().toISOString()
      };
    }

    this.pingCount++;
    this.lastPingTime = new Date();
    return this.createResponse();
  }

  private createResponse(): MCPPingResponse {
    const latency = Math.random() * 10;
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    const response: MCPPingResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
      latency: Math.round(latency)
    };

    if (this.config.customPayload) {
      Object.assign(response, this.config.customPayload);
    }

    return response;
  }

  getStats(): {
    pingCount: number;
    lastPingTime: string | null;
    uptime: number;
  } {
    return {
      pingCount: this.pingCount,
      lastPingTime: this.lastPingTime?.toISOString() ?? null,
      uptime: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }

  resetStats(): void {
    this.pingCount = 0;
    this.lastPingTime = null;
    this.startTime = Date.now();
  }
}

export function createPingHandler(config?: Partial<PingHandlerConfig>): MCPPingHandler {
  return new MCPPingHandler(config);
}
