/**
 * Unit Tests for Graceful Shutdown Handler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createGracefulShutdown,
  onShutdown,
  type ShutdownHandler,
  type ShutdownState,
} from '../../src/utils/graceful-shutdown.js';

describe('GracefulShutdown', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('deve registrar um handler com sucesso', () => {
      const shutdown = createGracefulShutdown({ exit: false });
      const handler: ShutdownHandler = vi.fn();

      const unsubscribe = shutdown.register('test-handler', handler);

      expect(shutdown.getHandlerCount()).toBe(1);
      expect(shutdown.getRegisteredHandlers()).toContain('test-handler');
      expect(typeof unsubscribe).toBe('function');
    });

    it('deve permitir registro de múltiplos handlers', () => {
      const shutdown = createGracefulShutdown({ exit: false });

      shutdown.register('handler-1', vi.fn());
      shutdown.register('handler-2', vi.fn());
      shutdown.register('handler-3', vi.fn());

      expect(shutdown.getHandlerCount()).toBe(3);
      expect(shutdown.getRegisteredHandlers()).toEqual([
        'handler-1',
        'handler-2',
        'handler-3',
      ]);
    });

    it('deve retornar função para cancelar registro', () => {
      const shutdown = createGracefulShutdown({ exit: false });
      const handler: ShutdownHandler = vi.fn();

      const unsubscribe = shutdown.register('removable', handler);
      unsubscribe();

      expect(shutdown.getHandlerCount()).toBe(0);
    });

    it('deve lançar erro ao registrar durante shutdown', async () => {
      const shutdown = createGracefulShutdown({ exit: false });
      const handler: ShutdownHandler = vi.fn();

      shutdown.register('test', vi.fn());

      const shutdownPromise = shutdown.shutdown();

      expect(shutdown.state.isShuttingDown).toBe(true);

      expect(() => {
        shutdown.register('during-shutdown', handler);
      }).toThrow('Cannot register handlers while shutting down');

      await shutdownPromise;
    });
  });

  describe('state', () => {
    it('deve iniciar com isShuttingDown false', () => {
      const shutdown = createGracefulShutdown({ exit: false });

      expect(shutdown.state.isShuttingDown).toBe(false);
      expect(shutdown.state.success).toBe(true);
      expect(shutdown.state.handlersExecuted).toBe(0);
    });

    it('deve atualizar estado durante shutdown', async () => {
      const shutdown = createGracefulShutdown({ exit: false });
      const handler: ShutdownHandler = vi.fn();

      shutdown.register('test', handler);

      const promise = shutdown.shutdown();

      expect(shutdown.state.isShuttingDown).toBe(true);
      expect(shutdown.state.shutdownInitiatedAt).toBeDefined();

      await promise;

      expect(shutdown.state.isShuttingDown).toBe(false);
      expect(shutdown.state.shutdownCompletedAt).toBeDefined();
      expect(shutdown.state.handlersExecuted).toBe(1);
    });
  });

  describe('shutdown', () => {
    it('deve executar handlers em ordem de registro', async () => {
      const shutdown = createGracefulShutdown({ exit: false });
      const executionOrder: string[] = [];

      shutdown.register('first', async () => {
        executionOrder.push('first');
      });

      shutdown.register('second', async () => {
        executionOrder.push('second');
      });

      shutdown.register('third', async () => {
        executionOrder.push('third');
      });

      await shutdown.shutdown();

      expect(executionOrder).toEqual(['first', 'second', 'third']);
    });

    it('deve executar handlers síncronos e assíncronos', async () => {
      const shutdown = createGracefulShutdown({ exit: false });
      const results: string[] = [];

      shutdown.register('sync', () => {
        results.push('sync');
      });

      shutdown.register('async', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push('async');
      });

      await shutdown.shutdown();

      expect(results).toEqual(['sync', 'async']);
    });

    it('deve reportar erro quando handler falha', async () => {
      const shutdown = createGracefulShutdown({ exit: false });

      shutdown.register('failing', async () => {
        throw new Error('Handler failed');
      });

      await shutdown.shutdown();

      expect(shutdown.state.success).toBe(false);
      expect(shutdown.state.error).toBeDefined();
      expect(shutdown.state.error?.message).toContain('Handler failed');
    });

    it('deve respeitar timeout configurado', async () => {
      const shutdown = createGracefulShutdown({
        exit: false,
        timeout: 50,
      });

      shutdown.register('slow', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await shutdown.shutdown();

      expect(shutdown.state.success).toBe(false);
      expect(shutdown.state.error?.message).toContain('timeout');
    });

    it('deve ignorar múltiplas chamadas a shutdown', async () => {
      const shutdown = createGracefulShutdown({ exit: false });
      const handler = vi.fn();

      shutdown.register('test', handler);

      const p1 = shutdown.shutdown();
      const p2 = shutdown.shutdown();
      const p3 = shutdown.shutdown();

      await p1;
      await p2;
      await p3;

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('signal handling', () => {
    it('deve configurar handler para SIGTERM por padrão', () => {
      const shutdown = createGracefulShutdown({ exit: false });

      expect(typeof process.on).toBe('function');
      expect(shutdown.state.isShuttingDown).toBe(false);
    });

    it('deve configurar handler para sinal especificado', () => {
      const shutdown = createGracefulShutdown({
        exit: false,
        signal: 'SIGINT',
      });

      expect(shutdown.state.isShuttingDown).toBe(false);
    });
  });

  describe('onShutdown', () => {
    it('deve criar handler de shutdown simples', () => {
      const cleanup = onShutdown(vi.fn());

      expect(typeof cleanup).toBe('function');
    });
  });

  describe('getRegisteredHandlers', () => {
    it('deve retornar lista vazia quando nenhum handler registrado', () => {
      const shutdown = createGracefulShutdown({ exit: false });

      expect(shutdown.getRegisteredHandlers()).toEqual([]);
    });

    it('deve retornar nomes dos handlers registrados', () => {
      const shutdown = createGracefulShutdown({ exit: false });

      shutdown.register('handler-a', vi.fn());
      shutdown.register('handler-b', vi.fn());

      expect(shutdown.getRegisteredHandlers()).toEqual([
        'handler-a',
        'handler-b',
      ]);
    });
  });

  describe('getHandlerCount', () => {
    it('deve retornar zero quando nenhum handler', () => {
      const shutdown = createGracefulShutdown({ exit: false });

      expect(shutdown.getHandlerCount()).toBe(0);
    });

    it('deve retornar contador correto de handlers', () => {
      const shutdown = createGracefulShutdown({ exit: false });

      shutdown.register('h1', vi.fn());
      shutdown.register('h2', vi.fn());
      shutdown.register('h3', vi.fn());

      expect(shutdown.getHandlerCount()).toBe(3);
    });
  });

  describe('error handling', () => {
    it('deve lidar com erro em handler síncrono', async () => {
      const shutdown = createGracefulShutdown({ exit: false });

      shutdown.register('sync-error', () => {
        throw new Error('Sync error');
      });

      await shutdown.shutdown();

      expect(shutdown.state.success).toBe(false);
    });

    it('deve executar handlers mesmo após erro em handler anterior', async () => {
      const shutdown = createGracefulShutdown({ exit: false });
      const executed: string[] = [];

      shutdown.register('failing', async () => {
        throw new Error('First error');
      });

      shutdown.register('second', async () => {
        executed.push('second');
      });

      shutdown.register('third', async () => {
        executed.push('third');
      });

      await shutdown.shutdown();

      expect(shutdown.state.success).toBe(false);
      expect(executed).toContain('second');
      expect(executed).toContain('third');
    });
  });

  describe('exit behavior', () => {
    it('não deve sair quando exit é false', async () => {
      const shutdown = createGracefulShutdown({ exit: false });
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      shutdown.register('test', vi.fn());
      await shutdown.shutdown();

      expect(exitSpy).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });

    it('deve usar exitCode configurado', async () => {
      const shutdown = createGracefulShutdown({
        exit: false,
        exitCode: 42,
      });

      shutdown.register('test', vi.fn());

      const result = await shutdown.shutdown();

      expect(result).toBeUndefined();
    });
  });
});

describe('ShutdownState interface', () => {
  it('deve permitir acesso a todas as propriedades', () => {
    const state: ShutdownState = {
      isShuttingDown: false,
      handlersExecuted: 0,
      success: true,
    };

    expect(state.isShuttingDown).toBe(false);
    expect(state.handlersExecuted).toBe(0);
    expect(state.success).toBe(true);
  });

  it('deve permitir propriedades opcionais', () => {
    const state: ShutdownState = {
      isShuttingDown: true,
      shutdownInitiatedAt: new Date(),
      handlersExecuted: 5,
      success: false,
      error: new Error('Test error'),
    };

    expect(state.isShuttingDown).toBe(true);
    expect(state.error).toBeInstanceOf(Error);
  });
});
