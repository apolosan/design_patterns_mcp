/**
 * Formats pattern detail responses for MCP tools.
 */

import { parseTags, parseArrayProperty } from '../utils/parse-tags.js';
import type { PatternExample, PatternImplementation, PatternRow } from './types.js';

export function formatPatternDetailsText(
  pattern: PatternRow,
  implementations: PatternImplementation[]
): string {
  let examplesText = '';
  if (pattern.examples) {
    try {
      const examples = JSON.parse(pattern.examples) as Record<string, PatternExample>;
      const exampleKeys = Object.keys(examples);

      if (exampleKeys.length > 0) {
        examplesText = '\n\n**Code Examples:**\n';
        exampleKeys.forEach(lang => {
          const example = examples[lang];
          examplesText += `\n### ${lang.charAt(0).toUpperCase() + lang.slice(1)}\n`;
          if (example.description) {
            examplesText += `${example.description}\n\n`;
          }
          examplesText += `\`\`\`${lang}\n${example.code}\n\`\`\`\n`;
        });
      }
    } catch {
      // Skip malformed examples JSON
    }
  }

  return (
    `# ${pattern.name} (${pattern.category})\n\n` +
    `**Description:** ${pattern.description ?? 'No description available'}\n\n` +
    `**When to Use:** ${parseArrayProperty(pattern.when_to_use).join(', ')}\n\n` +
    `**Benefits:** ${parseArrayProperty(pattern.benefits).join(', ')}\n\n` +
    `**Drawbacks:** ${parseArrayProperty(pattern.drawbacks).join(', ')}\n\n` +
    `**Use Cases:** ${parseArrayProperty(pattern.use_cases).join(', ')}\n\n` +
    `**Complexity:** ${pattern.complexity ?? 'Unknown'}\n\n` +
    `**Tags:** ${parseTags(pattern.tags).join(', ')}\n` +
    examplesText +
    (implementations.length > 0
      ? `\n\n**Implementations:**\n` +
        implementations
          .map(
            impl =>
              `\n### ${impl.language}\n\`\`\`${impl.language.toLowerCase()}\n${impl.code}\n\`\`\`\n${impl.explanation}`
          )
          .join('\n')
      : '')
  );
}
