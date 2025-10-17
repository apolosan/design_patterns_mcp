import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UserPreference,
  PreferenceCategory,
  CreateUserPreferenceInput,
  UpdateUserPreferenceInput,
  DEFAULT_PREFERENCES,
  PreferenceValidation,
  PreferenceExport,
  PreferenceCategoryConfig,
  PreferenceManager
} from '../../src/models/preference.js';

describe('UserPreference Model', () => {
  let mockPreferenceManager: PreferenceManager;

  beforeEach(() => {
    mockPreferenceManager = {
      get: vi.fn(),
      set: vi.fn(),
      getAll: vi.fn(),
      getByCategory: vi.fn(),
      reset: vi.fn(),
      resetAll: vi.fn(),
      export: vi.fn(),
      import: vi.fn()
    };
  });

  describe('UserPreference Interface', () => {
    it('should define correct UserPreference structure', () => {
      const preference: UserPreference = {
        id: 1,
        settingKey: 'test_key',
        settingValue: 'test_value',
        description: 'Test preference',
        category: 'general',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(preference.id).toBe(1);
      expect(preference.settingKey).toBe('test_key');
      expect(preference.settingValue).toBe('test_value');
      expect(preference.category).toBe('general');
      expect(preference.createdAt).toBeInstanceOf(Date);
      expect(preference.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow optional description', () => {
      const preference: UserPreference = {
        id: 2,
        settingKey: 'no_desc_key',
        settingValue: 42,
        category: 'performance',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(preference.description).toBeUndefined();
    });
  });

  describe('PreferenceCategory Type', () => {
    it('should accept valid categories', () => {
      const categories: PreferenceCategory[] = ['search', 'display', 'llm', 'performance', 'general'];
      expect(categories).toHaveLength(5);
    });
  });

  describe('CreateUserPreferenceInput Interface', () => {
    it('should require settingKey, settingValue, and category', () => {
      const input: CreateUserPreferenceInput = {
        settingKey: 'new_key',
        settingValue: true,
        category: 'display'
      };

      expect(input.settingKey).toBe('new_key');
      expect(input.settingValue).toBe(true);
      expect(input.category).toBe('display');
    });

    it('should allow optional description', () => {
      const input: CreateUserPreferenceInput = {
        settingKey: 'optional_desc',
        settingValue: 'value',
        category: 'search',
        description: 'Optional description'
      };

      expect(input.description).toBe('Optional description');
    });
  });

  describe('UpdateUserPreferenceInput Interface', () => {
    it('should require id and allow partial updates', () => {
      const input: UpdateUserPreferenceInput = {
        id: 1,
        settingValue: 'updated_value'
      };

      expect(input.id).toBe(1);
      expect(input.settingValue).toBe('updated_value');
    });
  });

  describe('DEFAULT_PREFERENCES', () => {
    it('should contain expected default values', () => {
      expect(DEFAULT_PREFERENCES.search_max_results).toBe(5);
      expect(DEFAULT_PREFERENCES.search_include_examples).toBe(true);
      expect(DEFAULT_PREFERENCES.display_language).toBe('en');
      expect(DEFAULT_PREFERENCES.llm_provider).toBe('none');
    });

    it('should have all expected keys', () => {
      const expectedKeys = [
        'search_max_results',
        'search_include_examples',
        'search_complexity_filter',
        'display_language',
        'llm_provider',
        'llm_enhance_recommendations',
        'performance_cache_size',
        'performance_response_timeout'
      ];

      expectedKeys.forEach(key => {
        expect(DEFAULT_PREFERENCES).toHaveProperty(key);
      });
    });
  });

  describe('PreferenceValidation Interface', () => {
    it('should define validation structure', () => {
      const validation: PreferenceValidation = {
        isValid: true,
        errors: [],
        warnings: ['Minor warning'],
        suggestions: ['Consider this setting']
      };

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
      expect(validation.warnings).toEqual(['Minor warning']);
      expect(validation.suggestions).toEqual(['Consider this setting']);
    });
  });

  describe('PreferenceExport Interface', () => {
    it('should define export structure', () => {
      const exportData: PreferenceExport = {
        preferences: [],
        exportedAt: new Date(),
        version: '1.0.0'
      };

      expect(exportData.preferences).toEqual([]);
      expect(exportData.exportedAt).toBeInstanceOf(Date);
      expect(exportData.version).toBe('1.0.0');
    });
  });

  describe('PreferenceCategoryConfig Interface', () => {
    it('should define category configuration', () => {
      const config: PreferenceCategoryConfig = {
        category: 'search',
        displayName: 'Search Settings',
        description: 'Configure search behavior',
        preferences: [
          {
            key: 'max_results',
            type: 'number',
            defaultValue: 10,
            description: 'Maximum search results',
            validation: { min: 1, max: 100 }
          }
        ]
      };

      expect(config.category).toBe('search');
      expect(config.displayName).toBe('Search Settings');
      expect(config.preferences).toHaveLength(1);
      expect(config.preferences[0].key).toBe('max_results');
    });
  });

  describe('PreferenceManager Interface', () => {
    it('should define manager methods', () => {
      expect(typeof mockPreferenceManager.get).toBe('function');
      expect(typeof mockPreferenceManager.set).toBe('function');
      expect(typeof mockPreferenceManager.getAll).toBe('function');
      expect(typeof mockPreferenceManager.getByCategory).toBe('function');
      expect(typeof mockPreferenceManager.reset).toBe('function');
      expect(typeof mockPreferenceManager.resetAll).toBe('function');
      expect(typeof mockPreferenceManager.export).toBe('function');
      expect(typeof mockPreferenceManager.import).toBe('function');
    });

    it('should mock get method correctly', async () => {
      (mockPreferenceManager.get as any).mockReturnValue('test_value');
      const result = mockPreferenceManager.get<string>('test_key');
      expect(result).toBe('test_value');
    });

    it('should mock set method correctly', async () => {
      await mockPreferenceManager.set('test_key', 'test_value');
      expect(mockPreferenceManager.set).toHaveBeenCalledWith('test_key', 'test_value');
    });
  });
});