/**
 * Elara AI Agent - TOON Encoder
 *
 * Token-Oriented Object Notation encoder/decoder for 40% token reduction.
 * Based on https://github.com/toon-format/toon specification.
 *
 * TOON uses:
 * - YAML-style indentation for nested objects
 * - CSV-style tables for uniform arrays
 * - Minimal punctuation (no {}, [], "")
 */

import type { ToolSchema, ToonEncoderAPI } from './types';

// =============================================================================
// TOON ENCODER CLASS
// =============================================================================

export class ToonEncoder implements ToonEncoderAPI {
  private readonly indent = '  ';  // 2 spaces

  /**
   * Encode JavaScript object to TOON format
   */
  encode(data: any, depth = 0): string {
    if (data === null || data === undefined) {
      return '';
    }

    if (typeof data !== 'object') {
      return String(data);
    }

    if (Array.isArray(data)) {
      return this.encodeArray(data, depth);
    }

    return this.encodeObject(data, depth);
  }

  /**
   * Decode TOON format back to JavaScript object
   */
  decode(toon: string): any {
    const lines = toon.split('\n').filter(line => line.trim());
    return this.parseLines(lines, 0).value;
  }

  /**
   * Encode OpenAI-style tool schema to compact TOON format
   */
  encodeToolSchema(schema: ToolSchema): string {
    const fn = schema.function;
    const params = fn.parameters.properties || {};
    const required = fn.parameters.required || [];

    const paramParts: string[] = [];

    for (const [name, def] of Object.entries(params)) {
      let paramStr = name;

      // Add type
      if (def.type === 'string') {
        paramStr += ':str';
      } else if (def.type === 'number') {
        paramStr += ':num';
      } else if (def.type === 'boolean') {
        paramStr += ':bool';
      } else if (def.type === 'array') {
        paramStr += ':str[]';  // Simplified
      }

      // Add enum constraint
      if (def.enum) {
        paramStr += `[${def.enum.join('/')}]`;
      }

      // Mark required
      if (required.includes(name)) {
        paramStr += '!';
      }

      paramParts.push(paramStr);
    }

    return `${fn.name}{${paramParts.join(',')}}`;
  }

  /**
   * Encode tool execution result to TOON format
   */
  encodeToolResult(result: any, schema?: Record<string, string>): string {
    if (!result) return '';

    const lines: string[] = [];

    // Handle array of indicators (common pattern)
    if (result.indicators && Array.isArray(result.indicators)) {
      lines.push(`verdict: ${result.verdict || 'UNKNOWN'}`);
      lines.push(`riskScore: ${result.riskScore || 0}`);
      lines.push(`riskLevel: ${result.riskLevel || 'C'}`);
      lines.push(`confidence: ${result.confidence || 0}`);

      if (result.threatType) {
        lines.push(`threatType: ${result.threatType}`);
      }

      // Encode indicators as TOON table
      if (result.indicators.length > 0) {
        const headers = Object.keys(result.indicators[0]);
        lines.push(`indicators[${result.indicators.length}]{${headers.join(',')}}:`);

        for (const indicator of result.indicators) {
          const values = headers.map(h => this.escapeValue(indicator[h] || ''));
          lines.push(` ${values.join(',')}`);
        }
      }

      // Encode reasoning array
      if (result.reasoning && result.reasoning.length > 0) {
        lines.push(`reasoning[${result.reasoning.length}]:`);
        for (const reason of result.reasoning) {
          lines.push(` ${reason}`);
        }
      }
    } else {
      // Generic object encoding
      lines.push(this.encodeObject(result, 0));
    }

    return lines.join('\n');
  }

  /**
   * Estimate token count for content
   * Approximation: ~4 characters per token for English text
   */
  getTokenEstimate(content: string): number {
    // Remove whitespace for more accurate count
    const compactContent = content.replace(/\s+/g, ' ');
    return Math.ceil(compactContent.length / 4);
  }

  /**
   * Compare token usage: JSON vs TOON
   */
  getCompressionRatio(data: any): { json: number; toon: number; ratio: number } {
    const jsonStr = JSON.stringify(data, null, 2);
    const toonStr = this.encode(data);

    const jsonTokens = this.getTokenEstimate(jsonStr);
    const toonTokens = this.getTokenEstimate(toonStr);

    return {
      json: jsonTokens,
      toon: toonTokens,
      ratio: jsonTokens > 0 ? 1 - (toonTokens / jsonTokens) : 0,
    };
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private encodeObject(obj: Record<string, any>, depth: number): string {
    const lines: string[] = [];
    const prefix = this.indent.repeat(depth);

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value !== 'object') {
        lines.push(`${prefix}${key}: ${this.escapeValue(value)}`);
      } else if (Array.isArray(value)) {
        // Check if uniform array (all same keys)
        if (this.isUniformArray(value)) {
          const encoded = this.encodeUniformArray(key, value, depth);
          lines.push(encoded);
        } else {
          // Inline simple arrays
          lines.push(`${prefix}${key}[${value.length}]: ${value.map(v => this.escapeValue(v)).join(',')}`);
        }
      } else {
        lines.push(`${prefix}${key}:`);
        lines.push(this.encodeObject(value, depth + 1));
      }
    }

    return lines.join('\n');
  }

  private encodeArray(arr: any[], depth: number): string {
    if (arr.length === 0) {
      return '[]';
    }

    if (this.isUniformArray(arr)) {
      return this.encodeUniformArray('items', arr, depth);
    }

    // Simple array
    return arr.map(v => this.escapeValue(v)).join(',');
  }

  private encodeUniformArray(name: string, arr: any[], depth: number): string {
    if (arr.length === 0 || typeof arr[0] !== 'object') {
      return `${name}[${arr.length}]: ${arr.join(',')}`;
    }

    const prefix = this.indent.repeat(depth);
    const headers = Object.keys(arr[0]);
    const lines: string[] = [];

    lines.push(`${prefix}${name}[${arr.length}]{${headers.join(',')}}:`);

    for (const item of arr) {
      const values = headers.map(h => this.escapeValue(item[h] ?? ''));
      lines.push(`${prefix} ${values.join(',')}`);
    }

    return lines.join('\n');
  }

  private isUniformArray(arr: any[]): boolean {
    if (arr.length === 0) return false;
    if (typeof arr[0] !== 'object') return false;

    const firstKeys = Object.keys(arr[0]).sort().join(',');

    for (let i = 1; i < arr.length; i++) {
      if (typeof arr[i] !== 'object') return false;
      const keys = Object.keys(arr[i]).sort().join(',');
      if (keys !== firstKeys) return false;
    }

    return true;
  }

  private escapeValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    const str = String(value);

    // Escape commas and newlines
    if (str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '\\"')}"`;
    }

    return str;
  }

  private parseLines(lines: string[], startIndex: number): { value: any; endIndex: number } {
    // Simple parser - handles basic TOON structures
    // Full implementation would be more complex

    const result: Record<string, any> = {};
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // Key-value pair
      const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+)?$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const value = kvMatch[2];

        if (value) {
          result[key] = this.parseValue(value);
        }
        i++;
        continue;
      }

      // Array declaration
      const arrMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+)\](?:\{([^}]+)\})?:$/);
      if (arrMatch) {
        const key = arrMatch[1];
        const count = parseInt(arrMatch[2], 10);
        const headers = arrMatch[3]?.split(',').map(h => h.trim());

        const items: any[] = [];
        i++;

        // Parse array rows
        for (let j = 0; j < count && i < lines.length; j++) {
          const rowLine = lines[i].trim();
          if (!rowLine) {
            i++;
            j--;
            continue;
          }

          if (headers) {
            const values = this.parseCSVRow(rowLine);
            const obj: Record<string, any> = {};
            headers.forEach((h, idx) => {
              obj[h] = values[idx] ?? '';
            });
            items.push(obj);
          } else {
            items.push(this.parseValue(rowLine));
          }
          i++;
        }

        result[key] = items;
        continue;
      }

      i++;
    }

    return { value: result, endIndex: i };
  }

  private parseValue(str: string): any {
    const trimmed = str.trim();

    // Boolean
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Number
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== '') return num;

    // String (remove quotes if present)
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }

    return trimmed;
  }

  private parseCSVRow(row: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"' && (i === 0 || row[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current) {
      values.push(current.trim());
    }

    return values;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const toonEncoder = new ToonEncoder();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Encode data to TOON format
 */
export function toToon(data: any): string {
  return toonEncoder.encode(data);
}

/**
 * Decode TOON format to JavaScript object
 */
export function fromToon(toon: string): any {
  return toonEncoder.decode(toon);
}

/**
 * Encode tool schema to compact TOON
 */
export function schemaToToon(schema: ToolSchema): string {
  return toonEncoder.encodeToolSchema(schema);
}

/**
 * Get token estimate for content
 */
export function estimateTokens(content: string): number {
  return toonEncoder.getTokenEstimate(content);
}
