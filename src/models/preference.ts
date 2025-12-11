/**
 * UserPreference Model Interface
 * Configurable settings and user customizations
 */

export type PreferenceCategory = 'search' | 'display' | 'llm' | 'performance' | 'general';

export interface UserPreference {
  /** Unique preference ID */
  id: number;

  /** Preference identifier */
  settingKey: string;

   /** Preference value (flexible type) */
   settingValue: unknown;

  /** Human-readable description */
  description?: string;

  /** Settings category */
  category: PreferenceCategory;

  /** Creation timestamp */
  createdAt: Date;

  /** Last modification timestamp */
  updatedAt: Date;
}

/**
 * Preference creation input
 */
export interface CreateUserPreferenceInput {
  settingKey: string;
  settingValue: unknown;
  category: PreferenceCategory;
  description?: string;
}

/**
 * Preference update input
 */
export interface UpdateUserPreferenceInput extends Partial<CreateUserPreferenceInput> {
  id: number;
}

/**
 * Default user preferences
 */
export const DEFAULT_PREFERENCES: Record<string, unknown> = {
  search_max_results: 5,
  search_include_examples: true,
  search_complexity_filter: 'any',
  display_language: 'en',
  llm_provider: 'none',
  llm_enhance_recommendations: false,
  performance_cache_size: '50MB',
  performance_response_timeout: 2000
};

/**
 * Preference validation result
 */
export interface PreferenceValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Preference export/import format
 */
export interface PreferenceExport {
  preferences: UserPreference[];
  exportedAt: Date;
  version: string;
}

/**
 * Preference category configuration
 */
export interface PreferenceCategoryConfig {
  category: PreferenceCategory;
  displayName: string;
  description: string;
  preferences: Array<{
    key: string;
    type: 'string' | 'number' | 'boolean' | 'json' | 'enum';
     defaultValue: unknown;
    description: string;
    validation?: {
      min?: number;
      max?: number;
      enum?: string[];
      pattern?: string;
    };
  }>;
}

/**
 * User preference manager interface
 */
export interface PreferenceManager {
   get<T = unknown>(key: string): T | undefined;
   set(key: string, value: unknown): Promise<void>;
  getAll(): Promise<UserPreference[]>;
  getByCategory(category: PreferenceCategory): Promise<UserPreference[]>;
  reset(key: string): Promise<void>;
  resetAll(): Promise<void>;
  export(): Promise<PreferenceExport>;
  import(data: PreferenceExport): Promise<void>;
}