import { describe, test, expect, vi, beforeEach } from "vitest";
import { StartupReadiness, createStartupReadiness } from "../../src/utils/startup-readiness.js";

describe("StartupReadiness", () => {
  let readiness: StartupReadiness;

  beforeEach(() => {
    readiness = new StartupReadiness();
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    test("creates readiness with pending status", () => {
      const state = readiness.getStatus();

      expect(state.status).toBe("pending");
      expect(state.pendingSince).toBeInstanceOf(Date);
    });

    test("has no ready time initially", () => {
      const state = readiness.getStatus();

      expect(state.readyAt).toBeUndefined();
    });
  });

  describe("markAsReady", () => {
    test("changes status from pending to ready", () => {
      readiness.markAsReady();
      const state = readiness.getStatus();

      expect(state.status).toBe("ready");
      expect(state.readyAt).toBeInstanceOf(Date);
    });

    test("has no effect if already ready", () => {
      readiness.markAsReady();
      const firstState = readiness.getStatus();

      readiness.markAsReady();
      const secondState = readiness.getStatus();

      expect(firstState.readyAt).toEqual(secondState.readyAt);
    });
  });

  describe("markAsFailed", () => {
    test("resets state to pending", () => {
      readiness.markAsReady();
      readiness.markAsFailed(new Error("Test error"));

      const state = readiness.getStatus();

      expect(state.status).toBe("pending");
      expect(state.readyAt).toBeUndefined();
    });
  });

  describe("isReady", () => {
    test("returns false when pending", () => {
      expect(readiness.isReady()).toBe(false);
    });

    test("returns true when ready", () => {
      readiness.markAsReady();

      expect(readiness.isReady()).toBe(true);
    });

    test("returns false after failed initialization", () => {
      readiness.markAsFailed(new Error("Test"));

      expect(readiness.isReady()).toBe(false);
    });
  });

  describe("getPendingDurationMs", () => {
    test("returns 0 after marked as ready", async () => {
      readiness.markAsReady();
      const duration = readiness.getPendingDurationMs();

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    test("returns increasing duration while pending", async () => {
      const initialDuration = readiness.getPendingDurationMs();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const laterDuration = readiness.getPendingDurationMs();

      expect(laterDuration).toBeGreaterThan(initialDuration);
    });
  });

  describe("waitForReady", () => {
    test("resolves immediately if already ready", async () => {
      readiness.markAsReady();

      await expect(readiness.waitForReady({ timeoutMs: 1000 })).resolves.toBeUndefined();
    });

    test("resolves when marked ready", async () => {
      setTimeout(() => {
        readiness.markAsReady();
      }, 50);

      await expect(readiness.waitForReady({ timeoutMs: 1000, intervalMs: 10 })).resolves.toBeUndefined();
    });

    test("rejects on timeout", async () => {
      await expect(
        readiness.waitForReady({ timeoutMs: 50, intervalMs: 10 })
      ).rejects.toThrow("Startup readiness timeout");
    });

    test("uses custom interval", async () => {
      setTimeout(() => {
        readiness.markAsReady();
      }, 50);

      await expect(
        readiness.waitForReady({ timeoutMs: 1000, intervalMs: 50 })
      ).resolves.toBeUndefined();
    });
  });

  describe("initialize", () => {
    test("calls initializer and marks ready", async () => {
      const initializer = vi.fn().mockResolvedValue(undefined);

      await readiness.initialize(initializer, { timeoutMs: 1000 });

      expect(initializer).toHaveBeenCalledTimes(1);
      expect(readiness.isReady()).toBe(true);
    });

    test("marks failed when initializer throws", async () => {
      const error = new Error("Init failed");
      const initializer = vi.fn().mockRejectedValue(error);

      await expect(readiness.initialize(initializer, { timeoutMs: 1000 })).rejects.toThrow("Init failed");
      expect(readiness.isReady()).toBe(false);
    });

    test("marks failed when initializer returns rejected promise", async () => {
      const initializer = vi.fn().mockImplementation(() => Promise.reject(new Error("Promise rejected")));

      await expect(readiness.initialize(initializer, { timeoutMs: 1000 })).rejects.toThrow("Promise rejected");
    });

    test("supports synchronous initializer", async () => {
      const initializer = vi.fn();

      await readiness.initialize(initializer, { timeoutMs: 1000 });

      expect(initializer).toHaveBeenCalledTimes(1);
      expect(readiness.isReady()).toBe(true);
    });

    test("times out if initialization takes too long", async () => {
      const slowInitializer = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 200)));

      await expect(
        readiness.initialize(slowInitializer, { timeoutMs: 50 })
      ).rejects.toThrow("Initialization timeout");
    });

    test("returns same promise for concurrent calls", async () => {
      let callCount = 0;
      const initializer = vi.fn().mockImplementation(() => {
        callCount++;
        return new Promise((resolve) => setTimeout(resolve, 50));
      });

      const promise1 = readiness.initialize(initializer, { timeoutMs: 1000 });
      const promise2 = readiness.initialize(initializer, { timeoutMs: 1000 });

      await promise1;
      await promise2;

      expect(callCount).toBe(1);
    });
  });

  describe("onReady", () => {
    test("calls callback immediately if already ready", () => {
      readiness.markAsReady();
      const callback = vi.fn();

      readiness.onReady(callback);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    test("calls callback when marked ready", () => {
      const callback = vi.fn();

      readiness.onReady(callback);
      readiness.markAsReady();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    test("supports multiple callbacks", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      readiness.onReady(callback1);
      readiness.onReady(callback2);
      readiness.markAsReady();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    test("does not call callback if reset before ready", () => {
      const callback = vi.fn();

      readiness.onReady(callback);
      readiness.reset();
      readiness.markAsReady();

      expect(callback).toHaveBeenCalledTimes(0);
    });
  });

  describe("reset", () => {
    test("resets to pending state", () => {
      readiness.markAsReady();
      readiness.reset();
      const state = readiness.getStatus();

      expect(state.status).toBe("pending");
      expect(state.readyAt).toBeUndefined();
    });

    test("clears ready callbacks", async () => {
      const callback = vi.fn();

      readiness.onReady(callback);
      readiness.reset();
      readiness.markAsReady();

      expect(callback).toHaveBeenCalledTimes(0);
    });

    test("resets waiting promises", async () => {
      readiness.markAsReady();
      readiness.reset();

      expect(readiness.isReady()).toBe(false);
    });
  });

  describe("createStartupReadiness", () => {
    test("creates readiness using factory function", () => {
      const factoryReadiness = createStartupReadiness();

      expect(factoryReadiness).toBeInstanceOf(StartupReadiness);
      expect(factoryReadiness.isReady()).toBe(false);
    });
  });
});
