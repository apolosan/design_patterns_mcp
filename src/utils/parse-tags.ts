/**
 * Safely parse array properties from database storage
 * Handles various formats: JSON string, comma-separated string, or array
 */
export function parseArrayProperty(
  data: string | string[] | null | undefined,
  propertyName?: string
): string[] {
  if (!data) return [];

  // If already an array, return as is
  if (Array.isArray(data)) return data;

  // If string, try to parse as JSON
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Ensure all items are strings
        if (parsed.every((item): item is string => typeof item === 'string')) {
          return parsed;
        }
        return parsed.map(item => String(item));
      }
      return [];
    } catch (error) {
      // If JSON parse fails, try to split by comma for tags-like properties
      const isCommaSplittable =
        propertyName === 'tags' ||
        (typeof data === 'string' && data.includes(',') && data.length < 200);

      if (isCommaSplittable) {
        // No warning needed - this is expected behavior for comma-separated data
        return data
          .split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0);
      } else {
        // For longer text properties, split by newlines (multiline strings from database)
        const isMultilineProperty = ['when_to_use', 'benefits', 'drawbacks', 'use_cases'].includes(
          propertyName ?? ''
        );
        if (isMultilineProperty && data.includes('\n')) {
          return data
            .split('\n')
            .map(item => item.trim())
            .filter(item => item.length > 0);
        } else {
          // For other longer text properties, try to split by common delimiters or return empty array
          // This prevents noisy warnings while still attempting to extract useful data
          const cleanedData = data.trim();

          // Try splitting by semicolons (alternative delimiter)
          if (cleanedData.includes(';')) {
            return cleanedData
              .split(';')
              .map(item => item.trim())
              .filter(item => item.length > 0);
          }

          // For array-like properties, return empty array instead of single item
          // This is safer and prevents false positives in matching
          if (['when_to_use', 'benefits', 'drawbacks', 'use_cases'].includes(propertyName ?? '')) {
            // Silently return empty array for malformed array properties
            return [];
          }

          // For other properties, treat as single item but only if it looks meaningful
          if (cleanedData.length > 0 && cleanedData.length < 500) {
            return [cleanedData];
          }

          return [];
        }
      }
    }
  }

  return [];
}

/**
 * Safely parse tags from database storage
 * Handles various formats: JSON string, comma-separated string, or array
 */
export function parseTags(tags: string | string[] | null | undefined): string[] {
  return parseArrayProperty(tags, 'tags');
}
