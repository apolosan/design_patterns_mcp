import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { HealthCheckManager, createHealthCheckManager } from "../../src/utils/health-check-manager.js";

describe("HealthCheckManager", () => {
  let manager: HealthCheckManager;

  beforeEach(() => {
    manager = new HealthCheckManager({
      eventLoopLagThresholdMs: 100,
      memoryUsageThresholdPercent: 90,
      cacheTtlMs: 1000,
      minUptimeMs: 0,
    });
  });

  afterEach(() => {
    manager.disableEventLoopMonitoring();
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    test("creates manager with default options", () => {
      const defaultManager = new HealthCheckManager();
      expect(defaultManager).toBeInstanceOf(HealthCheckManager);
    });

    test("creates manager with custom options", () => {
      const customManager = new HealthCheckManager({
        eventLoopLagThresholdMs: 50,
        memoryUsageThresholdPercent: 75,
        cacheTtlMs: 500,
        minUptimeMs: 1000,
      });
      expect(customManager).toBeInstanceOf(HealthCheckManager);
    });

    test("enables event loop monitoring when specified", () => {
      const monitoringManager = new HealthCheckManager({
        enableEventLoopMonitoring: true,
      });
      const stats = monitoringManager.getEventLoopStats();
      expect(stats.enabled).toBe(true);
    });
  });

  describe("registerLiveCheck", () => {
    test("registers a liveness check", () => {
      const check = vi.fn().mockReturnValue({ status: "healthy" as const });
      manager.registerLiveCheck("test-check", check);
      expect(manager.getLiveness()).toBeTruthy();
    });

    test("registers multiple liveness checks", () => {
      manager.registerLiveCheck("check-1", () => ({ status: "healthy" }));
      manager.registerLiveCheck("check-2", () => ({ status: "healthy" }));
      expect(manager.getLiveness()).toBeTruthy();
    });
  });

  describe("registerReadyCheck", () => {
    test("registers a readiness check", async () => {
      manager.registerReadyCheck("database", () => ({ status: "healthy" }));
      const result = await manager.getReadiness({ includeEventLoop: false, includeMemory: false });
      expect(result.checks.database).toBeDefined();
    });

    test("registers cached readiness check", async () => {
      let callCount = 0;
      manager.registerReadyCheck(
        "cached",
        () => {
          callCount++;
          return { status: "healthy" };
        },
        { cached: true, cacheTtlMs: 5000 }
      );

      await manager.getReadiness({ includeEventLoop: false, includeMemory: false });
      await manager.getReadiness({ includeEventLoop: false, includeMemory: false });

      expect(callCount).toBe(1);
    });

    test("cache expires after TTL", async () => {
      let callCount = 0;
      manager = new HealthCheckManager({
        cacheTtlMs: 10,
        minUptimeMs: 0,
      });

      manager.registerReadyCheck(
        "cached",
        () => {
          callCount++;
          return { status: "healthy" };
        },
        { cached: true }
      );

      await manager.getReadiness({ includeEventLoop: false, includeMemory: false });
      await new Promise((resolve) => setTimeout(resolve, 15));
      await manager.getReadiness({ includeEventLoop: false, includeMemory: false });

      expect(callCount).toBe(2);
    });
  });

  describe("getLiveness", () => {
    test("returns healthy when no checks registered", async () => {
      const result = await manager.getLiveness();
      expect(result.status).toBe("healthy");
    });

    test("returns healthy when all checks pass", async () => {
      manager.registerLiveCheck("check-1", () => ({ status: "healthy" }));
      manager.registerLiveCheck("check-2", () => ({ status: "healthy" }));

      const result = await manager.getLiveness();

      expect(result.status).toBe("healthy");
    });

    test("returns unhealthy when any check fails", async () => {
      manager.registerLiveCheck("check-1", () => ({ status: "healthy" }));
      manager.registerLiveCheck("check-fail", () => ({ status: "unhealthy", message: "Failed" }));

      const result = await manager.getLiveness();

      expect(result.status).toBe("unhealthy");
    });

    test("returns degraded when any check is degraded", async () => {
      manager.registerLiveCheck("check-1", () => ({ status: "healthy" }));
      manager.registerLiveCheck("check-degraded", () => ({ status: "degraded", message: "Slow" }));

      const result = await manager.getLiveness();

      expect(result.status).toBe("degraded");
    });

    test("checks minimum uptime", async () => {
      const newManager = new HealthCheckManager({
        minUptimeMs: 10000,
      });

      const result = await newManager.getLiveness();

      expect(result.status).toBe("unhealthy");
      expect(result.message).toContain("uptime");
    });
  });

  describe("getReadiness", () => {
    test("returns healthy when no checks registered", async () => {
      const result = await manager.getReadiness({ includeEventLoop: false, includeMemory: false });

      expect(result.status).toBe("healthy");
      expect(result.summary).toContain("0/0");
    });

    test("includes event loop check", async () => {
      manager.enableEventLoopMonitoring();
      const result = await manager.getReadiness({ includeEventLoop: true, includeMemory: false });

      expect(result.checks.eventLoop).toBeDefined();
      expect(result.checks.eventLoop?.status).toBe("healthy");
    });

    test("includes memory check", async () => {
      const result = await manager.getReadiness({ includeEventLoop: false, includeMemory: true });

      expect(result.checks.memory).toBeDefined();
    });

    test("marks unhealthy when event loop lag exceeds threshold", async () => {
      const laggyManager = new HealthCheckManager({
        eventLoopLagThresholdMs: 0.001,
        enableEventLoopMonitoring: true,
        minUptimeMs: 0,
      });

      const startTime = Date.now();
      while (Date.now() - startTime < 50) {
        for (let i = 0; i < 1000000; i++) {
          Math.sqrt(i);
        }
      }

      const result = await laggyManager.getReadiness({ includeEventLoop: true, includeMemory: false });

      expect(result.checks.eventLoop?.status).toBeDefined();
    });

    test("marks unhealthy when memory usage exceeds threshold", async () => {
      const memoryManager = new HealthCheckManager({
        memoryUsageThresholdPercent: 0,
        minUptimeMs: 0,
      });

      const result = await memoryManager.getReadiness({ includeEventLoop: false, includeMemory: true });

      expect(result.checks.memory?.status).toBe("unhealthy");
    });

    test("aggregates multiple dependency checks", async () => {
      manager.registerReadyCheck("db", () => ({ status: "healthy" }));
      manager.registerReadyCheck("cache", () => ({ status: "healthy" }));
      manager.registerReadyCheck("api", () => ({ status: "healthy" }));

      const result = await manager.getReadiness({ includeEventLoop: false, includeMemory: false });

      expect(result.checks.db).toBeDefined();
      expect(result.checks.cache).toBeDefined();
      expect(result.checks.api).toBeDefined();
      expect(result.status).toBe("healthy");
    });

    test("returns degraded when any dependency is degraded", async () => {
      manager.registerReadyCheck("db", () => ({ status: "healthy" }));
      manager.registerReadyCheck("slow-service", () => ({ status: "degraded", message: "Slow response" }));

      const result = await manager.getReadiness({ includeEventLoop: false, includeMemory: false });

      expect(result.status).toBe("degraded");
    });

    test("returns unhealthy when any dependency fails", async () => {
      manager.registerReadyCheck("healthy", () => ({ status: "healthy" }));
      manager.registerReadyCheck("failing", () => {
        throw new Error("Connection failed");
      });

      const result = await manager.getReadiness({ includeEventLoop: false, includeMemory: false });

      expect(result.status).toBe("unhealthy");
      expect(result.checks.failing?.status).toBe("unhealthy");
    });
  });

  describe("getUptimeMs", () => {
    test("returns uptime in milliseconds", () => {
      const startTime = Date.now();
      const uptime = manager.getUptimeMs();

      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getEventLoopStats", () => {
    test("returns disabled when not monitoring", () => {
      const stats = manager.getEventLoopStats();

      expect(stats.enabled).toBe(false);
    });

    test("returns stats when monitoring enabled", () => {
      manager.enableEventLoopMonitoring();
      const stats = manager.getEventLoopStats();

      expect(stats.enabled).toBe(true);
      expect(typeof stats.mean).toBe("number");
    });
  });

  describe("getMemoryStats", () => {
    test("returns memory statistics", () => {
      const stats = manager.getMemoryStats();

      expect(stats.usagePercent).toBeGreaterThanOrEqual(0);
      expect(stats.usagePercent).toBeLessThanOrEqual(100);
      expect(stats.usedBytes).toBeGreaterThan(0);
      expect(stats.totalBytes).toBeGreaterThan(0);
    });
  });

  describe("clearCache", () => {
    test("clears all cached results", async () => {
      let callCount = 0;
      manager.registerReadyCheck(
        "cached",
        () => {
          callCount++;
          return { status: "healthy" };
        },
        { cached: true, cacheTtlMs: 10000 }
      );

      await manager.getReadiness({ includeEventLoop: false, includeMemory: false });
      manager.clearCache();
      await manager.getReadiness({ includeEventLoop: false, includeMemory: false });

      expect(callCount).toBe(2);
    });
  });

  describe("createHealthCheckManager", () => {
    test("creates manager using factory function", () => {
      const factoryManager = createHealthCheckManager();

      expect(factoryManager).toBeInstanceOf(HealthCheckManager);
    });
  });
});
