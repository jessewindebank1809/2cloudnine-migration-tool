import { z } from 'zod';
import type { SalesforceField, SalesforceObject } from '@/lib/salesforce/object-discovery';

/**
 * INTERNAL BACKEND SERVICE - Never exposed to frontend
 * Automatically handles all field mappings between source and target orgs
 */

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformationType: 'direct' | 'lookup' | 'formula' | 'constant' | 'skip';
  transformationConfig?: any;
  isRequired: boolean;
  defaultValue?: any;
}

export interface ObjectMapping {
  sourceObject: string;
  targetObject: string;
  fieldMappings: Map<string, FieldMapping>;
  relationships: Map<string, string>; // sourceField -> targetField for lookups
}

export interface RelationshipMapping {
  sourceField: string;
  targetField: string;
  relatedObject: string;
  mappingStrategy: 'preserve' | 'remap' | 'skip';
}

/**
 * Invisible Field Mapping Engine
 * 
 * This engine automatically determines field mappings between source and target objects
 * without any user configuration. All mapping logic is handled internally.
 */
export class FieldMappingEngine {
  // System fields to always skip
  private readonly SKIP_FIELDS = new Set([
    'Id',
    'CreatedDate',
    'CreatedById',
    'LastModifiedDate',
    'LastModifiedById',
    'SystemModstamp',
    'IsDeleted',
    'LastViewedDate',
    'LastReferencedDate',
    'LastActivityDate',
    'SetupOwnerId'
  ]);

  // Field name variations to consider as matches
  private readonly FIELD_VARIATIONS = [
    (name: string) => name,
    (name: string) => name.toLowerCase(),
    (name: string) => name.replace(/_/g, ''),
    (name: string) => name.replace(/^c_/, ''), // Remove custom field prefix variations
  ];

  /**
   * Generate automatic field mappings between source and target objects
   */
  async generateMappings(
    sourceObject: SalesforceObject,
    targetObject: SalesforceObject
  ): Promise<ObjectMapping> {
    const fieldMappings = new Map<string, FieldMapping>();
    const relationships = new Map<string, string>();

    // Create lookup maps for target fields
    const targetFieldMap = this.createFieldMap(targetObject.fields);

    // Map each source field
    for (const sourceField of sourceObject.fields) {
      // Skip system fields
      if (this.SKIP_FIELDS.has(sourceField.name)) {
        continue;
      }

      // Find matching target field
      const targetField = this.findMatchingField(sourceField, targetFieldMap);

      if (targetField) {
        // Create mapping
        const mapping = this.createFieldMapping(sourceField, targetField);
        fieldMappings.set(sourceField.name, mapping);

        // Track relationships
        if (sourceField.type === 'reference') {
          relationships.set(sourceField.name, targetField.name);
        }
      } else if (sourceField.required && !sourceField.nillable) {
        // Required field with no match - create with default
        fieldMappings.set(sourceField.name, {
          sourceField: sourceField.name,
          targetField: sourceField.name,
          transformationType: 'constant',
          isRequired: true,
          defaultValue: this.getDefaultValue(sourceField)
        });
      }
    }

    return {
      sourceObject: sourceObject.name,
      targetObject: targetObject.name,
      fieldMappings,
      relationships
    };
  }

  /**
   * Transform a record based on field mappings
   */
  async transformRecord(
    sourceRecord: any,
    mapping: ObjectMapping,
    idMapping: Map<string, string>
  ): Promise<any> {
    const transformedRecord: any = {};

    for (const [sourceFieldName, fieldMapping] of Array.from(mapping.fieldMappings.entries())) {
      const sourceValue = sourceRecord[sourceFieldName];

      if (fieldMapping.transformationType === 'skip') {
        continue;
      }

      let transformedValue = sourceValue;

      switch (fieldMapping.transformationType) {
        case 'direct':
          // Direct copy
          transformedValue = sourceValue;
          break;

        case 'lookup':
          // Transform lookup ID if we have a mapping
          if (sourceValue && idMapping.has(sourceValue)) {
            transformedValue = idMapping.get(sourceValue);
          }
          break;

        case 'constant':
          // Use configured constant value
          transformedValue = fieldMapping.transformationConfig?.value || fieldMapping.defaultValue;
          break;

        case 'formula':
          // Apply formula transformation
          transformedValue = this.applyFormula(
            sourceValue,
            fieldMapping.transformationConfig
          );
          break;
      }

      // Apply default if needed
      if (transformedValue === null || transformedValue === undefined) {
        if (fieldMapping.isRequired && fieldMapping.defaultValue !== undefined) {
          transformedValue = fieldMapping.defaultValue;
        }
      }

      // Set the transformed value
      if (transformedValue !== null && transformedValue !== undefined) {
        transformedRecord[fieldMapping.targetField] = transformedValue;
      }
    }

    return transformedRecord;
  }

  /**
   * Create a field map for quick lookups
   */
  private createFieldMap(fields: SalesforceField[]): Map<string, SalesforceField> {
    const fieldMap = new Map<string, SalesforceField>();

    for (const field of fields) {
      // Add original name
      fieldMap.set(field.name, field);
      
      // Add variations
      for (const variation of this.FIELD_VARIATIONS) {
        const variantName = variation(field.name);
        if (!fieldMap.has(variantName)) {
          fieldMap.set(variantName, field);
        }
      }
    }

    return fieldMap;
  }

  /**
   * Find matching field in target object
   */
  private findMatchingField(
    sourceField: SalesforceField,
    targetFieldMap: Map<string, SalesforceField>
  ): SalesforceField | undefined {
    // Try exact match first
    if (targetFieldMap.has(sourceField.name)) {
      const targetField = targetFieldMap.get(sourceField.name)!;
      if (this.areFieldsCompatible(sourceField, targetField)) {
        return targetField;
      }
    }

    // Try variations
    for (const variation of this.FIELD_VARIATIONS) {
      const variantName = variation(sourceField.name);
      if (targetFieldMap.has(variantName)) {
        const targetField = targetFieldMap.get(variantName)!;
        if (this.areFieldsCompatible(sourceField, targetField)) {
          return targetField;
        }
      }
    }

    return undefined;
  }

  /**
   * Check if two fields are compatible for mapping
   */
  private areFieldsCompatible(
    sourceField: SalesforceField,
    targetField: SalesforceField
  ): boolean {
    // Skip if target is not creatable
    if (!targetField.createable) {
      return false;
    }

    // Check type compatibility
    return this.areTypesCompatible(sourceField.type, targetField.type);
  }

  /**
   * Check if field types are compatible
   */
  private areTypesCompatible(sourceType: string, targetType: string): boolean {
    // Exact match
    if (sourceType === targetType) {
      return true;
    }

    // Compatible type mappings
    const compatibleTypes: Record<string, string[]> = {
      'string': ['textarea', 'email', 'phone', 'url'],
      'textarea': ['string'],
      'double': ['currency', 'percent', 'int'],
      'currency': ['double', 'percent'],
      'percent': ['double', 'currency'],
      'int': ['double'],
      'boolean': ['checkbox'],
      'checkbox': ['boolean'],
      'date': ['datetime'],
      'datetime': ['date'],
    };

    return compatibleTypes[sourceType]?.includes(targetType) || false;
  }

  /**
   * Create field mapping configuration
   */
  private createFieldMapping(
    sourceField: SalesforceField,
    targetField: SalesforceField
  ): FieldMapping {
    let transformationType: FieldMapping['transformationType'] = 'direct';

    // Determine transformation type
    if (sourceField.type === 'reference') {
      transformationType = 'lookup';
    } else if (sourceField.type !== targetField.type) {
      // Type conversion needed
      transformationType = 'direct'; // Simple conversion for now
    }

    return {
      sourceField: sourceField.name,
      targetField: targetField.name,
      transformationType,
      isRequired: targetField.required && !targetField.nillable,
      defaultValue: this.getDefaultValue(targetField)
    };
  }

  /**
   * Get default value for a field type
   */
  private getDefaultValue(field: SalesforceField): any {
    if (field.defaultValue !== undefined) {
      return field.defaultValue;
    }

    // Type-based defaults
    switch (field.type) {
      case 'string':
      case 'textarea':
        return '';
      case 'boolean':
      case 'checkbox':
        return false;
      case 'int':
      case 'double':
      case 'currency':
      case 'percent':
        return 0;
      case 'date':
        return new Date().toISOString().split('T')[0];
      case 'datetime':
        return new Date().toISOString();
      case 'email':
        return 'noreply@2cloudnine.com';
      case 'phone':
        return '';
      case 'url':
        return '';
      default:
        return null;
    }
  }

  /**
   * Apply formula transformation
   */
  private applyFormula(value: any, config: any): any {
    // Simple formula implementation
    // Can be extended for more complex transformations
    if (config?.type === 'uppercase') {
      return String(value).toUpperCase();
    } else if (config?.type === 'lowercase') {
      return String(value).toLowerCase();
    } else if (config?.type === 'trim') {
      return String(value).trim();
    }

    return value;
  }
} 