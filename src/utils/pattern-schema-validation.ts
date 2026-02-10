/**
 * Pattern Schema Validation
 * Validates pattern JSON files against defined schema
 */

const RELATIONSHIP_TYPES = [
  'uses', 'extends', 'implements', 'requires', 'validates',
  'complements', 'enables', 'relates-to', 'depends-on',
  'alternative-to', 'similar-to', 'precursor', 'successor'
];

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface PatternSchema {
  required: string[];
  optional: string[];
  relationshipRequired: string[];
  relationshipOptional: string[];
}

export const PATTERN_SCHEMA: PatternSchema = {
  required: ['id', 'name', 'category', 'description'],
  optional: [
    'when_to_use', 'benefits', 'drawbacks', 'use_cases', 'complexity',
    'tags', 'examples', 'relationships', 'relatedPatterns', 'related_patterns',
    'implementation', 'alsoKnownAs', 'structure', 'participants',
    'collaborations', 'consequences', 'useCases', 'metadata'
  ],
  relationshipRequired: ['target_pattern_id', 'type'],
  relationshipOptional: ['description', 'strength']
};

export function validatePattern(data: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ field: 'root', message: 'Pattern must be an object' }], warnings: [] };
  }

  const pattern = data as Record<string, unknown>;

  for (const field of PATTERN_SCHEMA.required) {
    if (!(field in pattern)) {
      errors.push({ field, message: `Missing required field: ${field}` });
    } else if (pattern[field] === undefined || pattern[field] === null) {
      errors.push({ field, message: `Field ${field} cannot be null or undefined` });
    } else if (typeof pattern[field] !== 'string') {
      errors.push({ field, message: `Field ${field} must be a string`, value: typeof pattern[field] });
    }
  }

  if (pattern.id) {
    const idRegex = /^[a-z][a-z0-9-]*$/;
    if (!idRegex.test(pattern.id as string)) {
      errors.push({
        field: 'id',
        message: 'Pattern ID must start with lowercase letter and contain only lowercase letters, numbers, and hyphens',
        value: pattern.id
      });
    }
  }

  if (pattern.complexity) {
    const validComplexities = ['Low', 'Medium', 'High', 'Very High'];
    if (!validComplexities.includes(pattern.complexity as string)) {
      warnings.push({
        field: 'complexity',
        message: `Complexity should be one of: ${validComplexities.join(', ')}`,
        suggestion: `Use "${pattern.complexity}" or update to a valid complexity`
      });
    }
  }

  if (pattern.tags && Array.isArray(pattern.tags)) {
    for (let i = 0; i < (pattern.tags as unknown[]).length; i++) {
      if (typeof (pattern.tags as string[])[i] !== 'string') {
        errors.push({ field: `tags[${i}]`, message: 'Tag must be a string', value: (pattern.tags as unknown[])[i] });
      }
    }
  }

  if (pattern.relationships) {
    if (Array.isArray(pattern.relationships)) {
      for (let i = 0; i < (pattern.relationships as unknown[]).length; i++) {
        const relResult = validateRelationship((pattern.relationships as unknown[])[i], `relationships[${i}]`);
        errors.push(...relResult.errors);
        warnings.push(...relResult.warnings);
      }
    } else {
      errors.push({ field: 'relationships', message: 'Relationships must be an array' });
    }
  }

  if (pattern.examples) {
    if (typeof pattern.examples === 'string') {
      warnings.push({
        field: 'examples',
        message: 'Examples is a plain string, consider using object format with language-specific code'
      });
    } else if (typeof pattern.examples === 'object') {
      const examples = pattern.examples as Record<string, unknown>;
      if (!examples.typescript && !examples.typescript) {
        warnings.push({
          field: 'examples',
          message: 'Examples should include TypeScript implementation'
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateRelationship(data: unknown, fieldPrefix: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: [{ field: fieldPrefix, message: 'Relationship must be an object' }], warnings: [] };
  }

  const rel = data as Record<string, unknown>;

  if (!rel.target_pattern_id && !rel.targetPatternId) {
    errors.push({ field: `${fieldPrefix}.target_pattern_id`, message: 'Relationship must have target_pattern_id' });
  }

  if (!rel.type) {
    errors.push({ field: `${fieldPrefix}.type`, message: 'Relationship must have type' });
  } else if (!RELATIONSHIP_TYPES.includes(rel.type as string)) {
    warnings.push({
      field: `${fieldPrefix}.type`,
      message: `Unknown relationship type: ${rel.type}`,
      suggestion: `Valid types: ${RELATIONSHIP_TYPES.join(', ')}`
    });
  }

  if (rel.strength !== undefined) {
    const strength = Number(rel.strength);
    if (isNaN(strength) || strength < 0 || strength > 1) {
      errors.push({ field: `${fieldPrefix}.strength`, message: 'Strength must be a number between 0 and 1' });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validatePatternFile(_filePath: string, content: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { valid: false, errors: [{ field: 'root', message: 'Invalid JSON syntax' }], warnings: [] };
  }

  if (Array.isArray(parsed)) {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };
    for (let i = 0; i < parsed.length; i++) {
      const patternResult = validatePattern(parsed[i]);
      result.valid = result.valid && patternResult.valid;
      result.errors.push(...patternResult.errors.map(e => ({ ...e, field: `[${i}].${e.field}` })));
      result.warnings.push(...patternResult.warnings.map(w => ({ ...w, field: `[${i}].${w.field}` })));
    }
    return result;
  }

  return validatePattern(parsed);
}

export function formatValidationResult(result: ValidationResult, fileName: string): string {
  const lines: string[] = [];

  if (result.valid && result.warnings.length === 0) {
    return `✓ ${fileName}: Valid`;
  }

  lines.push(`✗ ${fileName}:`);

  for (const error of result.errors) {
    lines.push(`  Error [${error.field}]: ${error.message}`);
  }

  for (const warning of result.warnings) {
    lines.push(`  Warning [${warning.field}]: ${warning.message}`);
    if (warning.suggestion) {
      lines.push(`    Suggestion: ${warning.suggestion}`);
    }
  }

  return lines.join('\n');
}
