/**
 * SOQL Security Utilities
 * Provides methods for sanitizing and validating SOQL inputs to prevent injection attacks
 */

/**
 * Escapes a string value for safe use in SOQL queries
 * Handles all SOQL special characters and injection vectors
 */
export function escapeSoqlString(value: string): string {
  if (typeof value !== 'string') {
    throw new Error('Value must be a string');
  }
  
  // Escape backslashes first to prevent double escaping
  let escaped = value.replace(/\\/g, '\\\\');
  
  // Escape single quotes
  escaped = escaped.replace(/'/g, "\\'");
  
  // Escape other potentially dangerous characters
  escaped = escaped.replace(/"/g, '\\"');
  escaped = escaped.replace(/\n/g, '\\n');
  escaped = escaped.replace(/\r/g, '\\r');
  escaped = escaped.replace(/\t/g, '\\t');
  
  return escaped;
}

/**
 * Validates and sanitizes a Salesforce object name
 * Only allows alphanumeric characters, underscores, and __c suffix for custom objects
 */
export function sanitizeObjectName(objectName: string): string {
  if (!objectName || typeof objectName !== 'string') {
    throw new Error('Object name must be a non-empty string');
  }
  
  // Salesforce object name pattern: alphanumeric + underscore, optionally ending with __c
  const validPattern = /^[a-zA-Z][a-zA-Z0-9_]*(__c)?$/;
  
  if (!validPattern.test(objectName)) {
    throw new Error(`Invalid object name: ${objectName}. Object names must start with a letter and contain only alphanumeric characters and underscores.`);
  }
  
  return objectName;
}

/**
 * Validates a field name for SOQL queries
 * Allows standard field names and relationship traversal (e.g., Account.Name)
 */
export function sanitizeFieldName(fieldName: string): string {
  if (!fieldName || typeof fieldName !== 'string') {
    throw new Error('Field name must be a non-empty string');
  }
  
  // Allow field names with relationship traversal (dots) but validate each part
  const parts = fieldName.split('.');
  
  for (const part of parts) {
    // Each part must be a valid identifier
    const validPattern = /^[a-zA-Z][a-zA-Z0-9_]*(__c|__r)?$/;
    
    if (!validPattern.test(part)) {
      throw new Error(`Invalid field name component: ${part}`);
    }
  }
  
  return fieldName;
}

/**
 * Validates a complete field list for SELECT clause
 */
export function sanitizeFieldList(fields: string[]): string[] {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('Fields must be a non-empty array');
  }
  
  return fields.map(field => sanitizeFieldName(field.trim()));
}

/**
 * Safely builds an IN clause with proper escaping
 */
export function buildSafeInClause(fieldName: string, values: string[]): string {
  if (!values || values.length === 0) {
    throw new Error('Values array cannot be empty');
  }
  
  const sanitizedField = sanitizeFieldName(fieldName);
  const escapedValues = values.map(v => `'${escapeSoqlString(v)}'`);
  
  return `${sanitizedField} IN (${escapedValues.join(', ')})`;
}

/**
 * Validates ORDER BY clause components
 */
export function sanitizeOrderBy(orderBy: string): string {
  if (!orderBy || typeof orderBy !== 'string') {
    throw new Error('Order by must be a non-empty string');
  }
  
  // Split by comma to handle multiple order by fields
  const parts = orderBy.split(',').map(p => p.trim());
  
  const sanitizedParts = parts.map(part => {
    // Handle "FieldName ASC/DESC" format
    const match = part.match(/^([a-zA-Z][a-zA-Z0-9_.]*(?:__c|__r)?)\s*(ASC|DESC)?$/i);
    
    if (!match) {
      throw new Error(`Invalid ORDER BY clause: ${part}`);
    }
    
    const field = sanitizeFieldName(match[1]);
    const direction = match[2] ? match[2].toUpperCase() : '';
    
    return direction ? `${field} ${direction}` : field;
  });
  
  return sanitizedParts.join(', ');
}

/**
 * Validates LIMIT clause
 */
export function sanitizeLimit(limit: number): number {
  if (typeof limit !== 'number' || limit < 1 || limit > 50000) {
    throw new Error('Limit must be a number between 1 and 50000');
  }
  
  return Math.floor(limit);
}

/**
 * Validates a complete SOQL query for basic safety
 * This is a last line of defense - prefer building queries with safe methods
 */
export function validateSoqlQuery(query: string): void {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }
  
  // Check for common injection patterns
  const dangerousPatterns = [
    /;\s*DELETE\s+/i,
    /;\s*UPDATE\s+/i,
    /;\s*INSERT\s+/i,
    /UNION\s+SELECT/i,
    /OR\s+1\s*=\s*1/i,
    /OR\s+'[^']*'\s*=\s*'[^']*'/i,
    /--\s*$/m,  // SQL comment at end of line
    /\/\*.*\*\//,  // Block comments
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      throw new Error('Query contains potentially dangerous patterns');
    }
  }
  
  // Ensure query starts with SELECT (read-only)
  if (!/^\s*SELECT\s+/i.test(query)) {
    throw new Error('Only SELECT queries are allowed');
  }
}

/**
 * Creates a safe record type query
 */
export function buildSafeRecordTypeQuery(objectName: string): string {
  const sanitizedObjectName = sanitizeObjectName(objectName);
  return `SELECT Id, Name, DeveloperName FROM RecordType WHERE SObjectType = '${sanitizedObjectName}' AND IsActive = true`;
}