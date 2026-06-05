/**
 * Formats health check reports for MCP tool responses.
 */

import { coerceToStringArray } from '../utils/parse-tags.js';
import type { HealthReport } from '../health/types.js';

export function formatHealthReportText(report: HealthReport): string {
  let response = `## System Health Report\n\n`;
  response += `**Overall Status:** ${report.overall.toUpperCase()}\n`;
  response += `**Timestamp:** ${new Date(report.timestamp).toLocaleString()}\n`;
  response += `**Total Duration:** ${Math.round(report.duration)}ms\n\n`;

  response += `### Summary\n`;
  response += `- **Total Checks:** ${report.summary.total}\n`;
  response += `- **Healthy:** ${report.summary.healthy}\n`;
  response += `- **Degraded:** ${report.summary.degraded}\n`;
  response += `- **Unhealthy:** ${report.summary.unhealthy}\n`;
  response += `- **Unknown:** ${report.summary.unknown}\n\n`;

  response += `### Individual Check Results\n\n`;
  report.checks.forEach((check, index) => {
    response += `${index + 1}. **${check.name}**\n`;
    response += `   - **Status:** ${check.status.toUpperCase()}\n`;
    response += `   - **Duration:** ${Math.round(check.duration)}ms\n`;
    response += `   - **Message:** ${check.message}\n`;

    if (check.details) {
      response += `   - **Details:** ${JSON.stringify(check.details, null, 2)}\n`;
    }

    const healthTags = coerceToStringArray(check.tags, 'tags');
    if (healthTags.length > 0) {
      response += `   - **Tags:** ${healthTags.join(', ')}\n`;
    }

    response += `\n`;
  });

  return response;
}
