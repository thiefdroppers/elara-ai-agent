/**
 * E-BRAIN V3 Tool Handlers Index
 *
 * Central export for all 16 security tool handlers.
 * This module provides the complete tool implementation layer
 * that connects tool definitions to actual functionality.
 */

// Security tools (13 handlers)
export * from './security-tools';

// Memory tools (2 handlers)
export * from './memory-tools';

// Re-export handler maps for easy registration
export { securityToolHandlers } from './security-tools';
export { memoryToolHandlers } from './memory-tools';

// Combined handler map for all 16 tools
import { securityToolHandlers } from './security-tools';
import { memoryToolHandlers } from './memory-tools';

export const allToolHandlers = {
  ...securityToolHandlers,
  ...memoryToolHandlers,
};

// Tool names type
export type V3ToolName = keyof typeof allToolHandlers;

// Get all tool names
export const V3_TOOL_NAMES: V3ToolName[] = Object.keys(allToolHandlers) as V3ToolName[];
