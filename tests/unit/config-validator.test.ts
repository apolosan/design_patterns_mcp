/**
 * Unit Tests for Configuration Validator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  stringValidator,
  numberValidator,
  booleanValidator,
  stringArrayValidator,
  createConfigValidator,
  mcpServerRules,
} from '../../src/utils/config-validator.js';

describe('String Validator', () => {
  it('deve retornar valor válido', () => {
    const validator = stringValidator({});
    const result = validator('hello world');

    expect(result).toBe('hello world');
  });

  it('deve fazer trim por padrão', () => {
    const validator = stringValidator({});
    const result = validator('  trimmed  ');

    expect(result).toBe('trimmed');
  });

  it('deve retornar undefined para valor vazio quando não obrigatório', () => {
    const validator = stringValidator({});
    const result = validator('');

    expect(result).toBeUndefined();
  });

  it('deve lançar erro para valor vazio quando obrigatório', () => {
    const validator = stringValidator({ required: true });

    expect(() => validator('')).toThrow('Value cannot be empty');
  });

  it('deve validar tamanho mínimo - valor curto', () => {
    const validator = stringValidator({ minLength: 5 });

    expect(() => validator('abc')).toThrow('at least 5 characters');
  });

  it('deve validar tamanho mínimo - valor válido', () => {
    const validator = stringValidator({ minLength: 5 });
    const result = validator('abcdef');

    expect(result).toBe('abcdef');
  });

  it('deve validar tamanho máximo - valor longo', () => {
    const validator = stringValidator({ maxLength: 5 });

    expect(() => validator('abcdef')).toThrow('at most 5 characters');
  });

  it('deve validar tamanho máximo - valor válido', () => {
    const validator = stringValidator({ maxLength: 5 });
    const result = validator('abc');

    expect(result).toBe('abc');
  });

  it('deve validar padrão regex - inválido', () => {
    const validator = stringValidator({ pattern: /^[a-z]+$/ });

    expect(() => validator('ABC')).toThrow('required pattern');
  });

  it('deve validar padrão regex - válido', () => {
    const validator = stringValidator({ pattern: /^[a-z]+$/ });
    const result = validator('abc');

    expect(result).toBe('abc');
  });

  it('deve converter para string', () => {
    const validator = stringValidator({});
    const result = validator(123);

    expect(result).toBe('123');
  });

  it('deve retornar undefined para null quando não obrigatório', () => {
    const validator = stringValidator({});
    const result = validator(null);

    expect(result).toBeUndefined();
  });
});

describe('Number Validator', () => {
  it('deve retornar valor numérico válido', () => {
    const validator = numberValidator({});
    const result = validator('42');

    expect(result).toBe(42);
  });

  it('deve retornar valor numérico direto', () => {
    const validator = numberValidator({});
    const result = validator(42);

    expect(result).toBe(42);
  });

  it('deve validar mínimo - valor baixo', () => {
    const validator = numberValidator({ min: 10 });

    expect(() => validator('5')).toThrow('at least 10');
  });

  it('deve validar mínimo - valor válido', () => {
    const validator = numberValidator({ min: 10 });
    const result = validator('15');

    expect(result).toBe(15);
  });

  it('deve validar máximo - valor alto', () => {
    const validator = numberValidator({ max: 100 });

    expect(() => validator('150')).toThrow('at most 100');
  });

  it('deve validar máximo - valor válido', () => {
    const validator = numberValidator({ max: 100 });
    const result = validator('50');

    expect(result).toBe(50);
  });

  it('deve validar inteiros - decimal', () => {
    const validator = numberValidator({ integer: true });

    expect(() => validator('3.14')).toThrow('must be an integer');
  });

  it('deve validar inteiros - válido', () => {
    const validator = numberValidator({ integer: true });
    const result = validator('42');

    expect(result).toBe(42);
  });

  it('deve lançar erro para valor não numérico', () => {
    const validator = numberValidator({});

    expect(() => validator('abc')).toThrow('not a valid number');
  });

  it('deve rejeitar NaN', () => {
    const validator = numberValidator({});

    expect(() => validator(NaN)).toThrow('not a valid number');
  });

  it('deve retornar undefined para null quando não obrigatório', () => {
    const validator = numberValidator({});
    const result = validator(null);

    expect(result).toBeUndefined();
  });
});

describe('Boolean Validator', () => {
  it('deve retornar booleano válido - true', () => {
    const validator = booleanValidator({});
    const result = validator('true');

    expect(result).toBe(true);
  });

  it('deve retornar booleano válido - false', () => {
    const validator = booleanValidator({});
    const result = validator('false');

    expect(result).toBe(false);
  });

  it('deve aceitar valores numéricos - 1', () => {
    const validator = booleanValidator({});
    const result = validator('1');

    expect(result).toBe(true);
  });

  it('deve aceitar valores numéricos - 0', () => {
    const validator = booleanValidator({});
    const result = validator('0');

    expect(result).toBe(false);
  });

  it('deve aceitar valor booleano direto - true', () => {
    const validator = booleanValidator({});
    const result = validator(true);

    expect(result).toBe(true);
  });

  it('deve aceitar valor booleano direto - false', () => {
    const validator = booleanValidator({});
    const result = validator(false);

    expect(result).toBe(false);
  });

  it('deve aceitar valores sim/não - yes', () => {
    const validator = booleanValidator({});
    const result = validator('yes');

    expect(result).toBe(true);
  });

  it('deve aceitar valores sim/não - no', () => {
    const validator = booleanValidator({});
    const result = validator('no');

    expect(result).toBe(false);
  });

  it('deve aceitar valores sim/não - maiúsculo', () => {
    const validator = booleanValidator({});
    const result = validator('YES');

    expect(result).toBe(true);
    expect(validator('NO')).toBe(false);
  });

  it('deve lançar erro para valor inválido', () => {
    const validator = booleanValidator({});

    expect(() => validator('maybe')).toThrow('must be one of');
  });

  it('deve permitir configurar valores verdadeiros', () => {
    const validator = booleanValidator({
      trueValues: ['sim', 'verdadeiro'],
      falseValues: ['não', 'falso'],
    });

    expect(validator('sim')).toBe(true);
    expect(validator('não')).toBe(false);
  });

  it('deve retornar undefined para null quando não obrigatório', () => {
    const validator = booleanValidator({});
    const result = validator(null);

    expect(result).toBeUndefined();
  });
});

describe('String Array Validator', () => {
  it('deve retornar array de string válido', () => {
    const validator = stringArrayValidator({});
    const result = validator('a,b,c');

    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('deve fazer trim dos itens', () => {
    const validator = stringArrayValidator({});
    const result = validator(' a , b , c ');

    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('deve aceitar array direto', () => {
    const validator = stringArrayValidator({});
    const result = validator(['a', 'b', 'c']);

    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('deve validar quantidade mínima - array curto', () => {
    const validator = stringArrayValidator({ minItems: 2 });

    expect(() => validator('a')).toThrow('at least 2 items');
  });

  it('deve validar quantidade mínima - válido', () => {
    const validator = stringArrayValidator({ minItems: 2 });
    const result = validator('a,b');

    expect(result).toEqual(['a', 'b']);
  });

  it('deve validar quantidade máxima - array longo', () => {
    const validator = stringArrayValidator({ maxItems: 2 });

    expect(() => validator('a,b,c')).toThrow('at most 2 items');
  });

  it('deve validar quantidade máxima - válido', () => {
    const validator = stringArrayValidator({ maxItems: 2 });
    const result = validator('a,b');

    expect(result).toEqual(['a', 'b']);
  });

  it('deve validar itens únicos - com duplicatas', () => {
    const validator = stringArrayValidator({ unique: true });

    expect(() => validator('a,a,b')).toThrow('unique items');
  });

  it('deve validar itens únicos - válido', () => {
    const validator = stringArrayValidator({ unique: true });
    const result = validator('a,b,c');

    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('deve usar delimitador personalizado', () => {
    const validator = stringArrayValidator({ delimiter: ';' });
    const result = validator('a;b;c');

    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('deve retornar array vazio para valor vazio', () => {
    const validator = stringArrayValidator({});
    const result = validator('');

    expect(result).toEqual([]);
  });

  it('deve lançar erro para null quando obrigatório', () => {
    const validator = stringArrayValidator({ required: true });

    expect(() => validator(null)).toThrow('Value is required');
  });
});

describe('createConfigValidator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  interface TestConfig {
    PORT: number;
    HOST: string;
    ENABLED: boolean;
    TAGS: string[];
    [key: string]: unknown;
  }

  function withEnv(env: Record<string, string>, fn: () => void): void {
    const originalEnv: Record<string, string | undefined> = {};
    const keysToDelete: string[] = [];

    for (const key of Object.keys(env)) {
      if (key in process.env) {
        originalEnv[key] = process.env[key as keyof typeof process.env];
      } else {
        keysToDelete.push(key);
      }
      process.env[key as keyof typeof process.env] = env[key];
    }

    try {
      fn();
    } finally {
      for (const key of Object.keys(env)) {
        if (originalEnv[key] !== undefined) {
          process.env[key as keyof typeof process.env] = originalEnv[key];
        } else {
          delete process.env[key];
        }
      }
    }
  }

  it('deve validar configuração com sucesso', () => {
    withEnv(
      { PORT: '3000', HOST: 'localhost', ENABLED: 'true', TAGS: 'test,dev' },
      () => {
        const validator = createConfigValidator<TestConfig>({
          PORT: {
            key: 'PORT',
            description: 'Server port',
            defaultValue: 8080,
            validator: numberValidator({ required: false, min: 1, max: 65535 }),
          },
          HOST: {
            key: 'HOST',
            description: 'Server host',
            defaultValue: '0.0.0.0',
            validator: stringValidator({ required: false }),
          },
          ENABLED: {
            key: 'ENABLED',
            description: 'Enable feature',
            defaultValue: false,
            validator: booleanValidator({ required: false }),
          },
          TAGS: {
            key: 'TAGS',
            description: 'Tags list',
            defaultValue: [],
            validator: stringArrayValidator({ required: false }),
          },
        });

        const result = validator.validate();

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.config.PORT).toBe(3000);
        expect(result.config.HOST).toBe('localhost');
        expect(result.config.ENABLED).toBe(true);
        expect(result.config.TAGS).toEqual(['test', 'dev']);
      }
    );
  });

  it('deve usar valores padrão quando não fornecidos', () => {
    const validator = createConfigValidator<TestConfig>({
      PORT: {
        key: 'PORT',
        description: 'Server port',
        defaultValue: 8080,
        validator: numberValidator({ required: false }),
      },
      HOST: {
        key: 'HOST',
        description: 'Server host',
        defaultValue: '0.0.0.0',
        validator: stringValidator({ required: false }),
      },
      ENABLED: {
        key: 'ENABLED',
        description: 'Enable feature',
        defaultValue: true,
        validator: booleanValidator({ required: false }),
      },
      TAGS: {
        key: 'TAGS',
        description: 'Tags list',
        defaultValue: ['default'],
        validator: stringArrayValidator({ required: false }),
      },
    });

    const result = validator.validate();

    expect(result.isValid).toBe(true);
    expect(result.config.PORT).toBe(8080);
    expect(result.config.HOST).toBe('0.0.0.0');
    expect(result.config.ENABLED).toBe(true);
    expect(result.config.TAGS).toEqual(['default']);
  });

  it('deve coletar erros de validação', () => {
    withEnv({ PORT: 'invalid', HOST: '', ENABLED: 'maybe' }, () => {
      const validator = createConfigValidator<TestConfig>({
        PORT: {
          key: 'PORT',
          description: 'Server port',
          defaultValue: 8080,
          validator: numberValidator({ required: true }),
        },
        HOST: {
          key: 'HOST',
          description: 'Server host',
          defaultValue: '0.0.0.0',
          validator: stringValidator({ required: true, minLength: 1 }),
        },
        ENABLED: {
          key: 'ENABLED',
          description: 'Enable feature',
          defaultValue: false,
          validator: booleanValidator({ required: true }),
        },
        TAGS: {
          key: 'TAGS',
          description: 'Tags list',
          defaultValue: [],
          validator: stringArrayValidator({ required: false }),
        },
      });

      const result = validator.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  it('deve permitir acesso por chave', () => {
    withEnv({ PORT: '3000' }, () => {
      const validator = createConfigValidator<TestConfig>({
        PORT: {
          key: 'PORT',
          description: 'Server port',
          defaultValue: 8080,
          validator: numberValidator({ required: false }),
        },
        HOST: {
          key: 'HOST',
          description: 'Server host',
          defaultValue: '0.0.0.0',
          validator: stringValidator({ required: false }),
        },
        ENABLED: {
          key: 'ENABLED',
          description: 'Enable feature',
          defaultValue: false,
          validator: booleanValidator({ required: false }),
        },
        TAGS: {
          key: 'TAGS',
          description: 'Tags list',
          defaultValue: [],
          validator: stringArrayValidator({ required: false }),
        },
      });

      const result = validator.validate();

      expect(result.get('PORT')).toBe(3000);
      expect(result.get('HOST')).toBe('0.0.0.0');
    });
  });

  it('deve reportar erros com informações completas', () => {
    withEnv({ PORT: 'invalid' }, () => {
      const validator = createConfigValidator<TestConfig>({
        PORT: {
          key: 'PORT',
          description: 'Server port',
          defaultValue: 8080,
          validator: numberValidator({ required: true, min: 1 }),
        },
        HOST: {
          key: 'HOST',
          description: 'Server host',
          defaultValue: '0.0.0.0',
          validator: stringValidator({ required: false }),
        },
        ENABLED: {
          key: 'ENABLED',
          description: 'Enable feature',
          defaultValue: false,
          validator: booleanValidator({ required: false }),
        },
        TAGS: {
          key: 'TAGS',
          description: 'Tags list',
          defaultValue: [],
          validator: stringArrayValidator({ required: false }),
        },
      });

      const result = validator.validate();

      expect(result.errors[0]).toMatchObject({
        key: 'PORT',
        message: expect.stringContaining('Invalid value for PORT'),
        invalidValue: 'invalid',
        context: 'Server port',
      });
    });
  });

  it('deve retornar erros via getErrors()', () => {
    withEnv({ PORT: 'invalid' }, () => {
      const validator = createConfigValidator<TestConfig>({
        PORT: {
          key: 'PORT',
          description: 'Server port',
          defaultValue: 8080,
          validator: numberValidator({ required: true }),
        },
        HOST: {
          key: 'HOST',
          description: 'Server host',
          defaultValue: '0.0.0.0',
          validator: stringValidator({ required: false }),
        },
        ENABLED: {
          key: 'ENABLED',
          description: 'Enable feature',
          defaultValue: false,
          validator: booleanValidator({ required: false }),
        },
        TAGS: {
          key: 'TAGS',
          description: 'Tags list',
          defaultValue: [],
          validator: stringArrayValidator({ required: false }),
        },
      });

      const errors = validator.getErrors();

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('deve retornar true via isValid() quando válido', () => {
    withEnv({ PORT: '3000' }, () => {
      const validator = createConfigValidator<TestConfig>({
        PORT: {
          key: 'PORT',
          description: 'Server port',
          defaultValue: 8080,
          validator: numberValidator({ required: false }),
        },
        HOST: {
          key: 'HOST',
          description: 'Server host',
          defaultValue: '0.0.0.0',
          validator: stringValidator({ required: false }),
        },
        ENABLED: {
          key: 'ENABLED',
          description: 'Enable feature',
          defaultValue: false,
          validator: booleanValidator({ required: false }),
        },
        TAGS: {
          key: 'TAGS',
          description: 'Tags list',
          defaultValue: [],
          validator: stringArrayValidator({ required: false }),
        },
      });

      expect(validator.isValid()).toBe(true);
    });
  });

  it('deve retornar false via isValid() quando há erros', () => {
    withEnv({ PORT: 'invalid' }, () => {
      const validator = createConfigValidator<TestConfig>({
        PORT: {
          key: 'PORT',
          description: 'Server port',
          defaultValue: 8080,
          validator: numberValidator({ required: true }),
        },
        HOST: {
          key: 'HOST',
          description: 'Server host',
          defaultValue: '0.0.0.0',
          validator: stringValidator({ required: false }),
        },
        ENABLED: {
          key: 'ENABLED',
          description: 'Enable feature',
          defaultValue: false,
          validator: booleanValidator({ required: false }),
        },
        TAGS: {
          key: 'TAGS',
          description: 'Tags list',
          defaultValue: [],
          validator: stringArrayValidator({ required: false }),
        },
      });

      expect(validator.isValid()).toBe(false);
    });
  });
});

describe('mcpServerRules', () => {
  it('deve exportar regras de configuração válidas', () => {
    expect(mcpServerRules.PORT.key).toBe('PORT');
    expect(mcpServerRules.HOST.key).toBe('HOST');
    expect(mcpServerRules.LOG_LEVEL.key).toBe('LOG_LEVEL');
    expect(mcpServerRules.DATABASE_PATH.key).toBe('DATABASE_PATH');
    expect(mcpServerRules.TRANSPORT_MODE.key).toBe('TRANSPORT_MODE');
  });

  it('deve ter validadores configurados', () => {
    expect(typeof mcpServerRules.PORT.validator).toBe('function');
    expect(typeof mcpServerRules.HOST.validator).toBe('function');
    expect(typeof mcpServerRules.LOG_LEVEL.validator).toBe('function');
  });

  it('deve ter descrições', () => {
    expect(mcpServerRules.PORT.description.length).toBeGreaterThan(0);
    expect(mcpServerRules.HOST.description.length).toBeGreaterThan(0);
  });
});
