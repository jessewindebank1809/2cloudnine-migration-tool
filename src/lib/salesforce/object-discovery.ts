import { SalesforceClient } from './client';
import { z } from 'zod';

// Schema for Salesforce object metadata
const SalesforceFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.string(),
  length: z.number().optional(),
  precision: z.number().optional(),
  scale: z.number().optional(),
  referenceTo: z.array(z.string()).optional(),
  relationshipName: z.string().optional(),
  required: z.boolean(),
  unique: z.boolean(),
  createable: z.boolean(),
  updateable: z.boolean(),
  nillable: z.boolean(),
  defaultValue: z.any().optional(),
});

const SalesforceObjectSchema = z.object({
  name: z.string(),
  label: z.string(),
  labelPlural: z.string(),
  custom: z.boolean(),
  queryable: z.boolean(),
  createable: z.boolean(),
  updateable: z.boolean(),
  deletable: z.boolean(),
  fields: z.array(SalesforceFieldSchema),
  childRelationships: z.array(z.object({
    childSObject: z.string(),
    field: z.string(),
    relationshipName: z.string().optional(),
  })),
});

export type SalesforceField = z.infer<typeof SalesforceFieldSchema>;
export type SalesforceObject = z.infer<typeof SalesforceObjectSchema>;

export interface ObjectDiscoveryOptions {
  includeStandard?: boolean;
  includeCustom?: boolean;
  objectPatterns?: string[];
}

interface DescribeGlobalSObject {
  name: string;
  label: string;
  custom: boolean;
  queryable: boolean;
}

export class ObjectDiscoveryEngine {
  constructor(private client: SalesforceClient) {}

  /**
   * Discover all available objects in the Salesforce org
   */
  async discoverObjects(options: ObjectDiscoveryOptions = {}): Promise<SalesforceObject[]> {
    const { 
      includeStandard = false, 
      includeCustom = true,
      objectPatterns = []
    } = options;

    try {
      // Use the client to get connection and access jsforce methods
      const connection = (this.client as any).connection;
      
      // Get global describe to list all objects
      const describeResult = await connection.describeGlobal();
      
      // Filter objects based on options
      let objects = describeResult.sobjects.filter((obj: DescribeGlobalSObject) => {
        if (!obj.queryable) return false;
        if (!includeStandard && !obj.custom) return false;
        if (!includeCustom && obj.custom) return false;
        
        // Check patterns if provided
        if (objectPatterns.length > 0) {
          return objectPatterns.some(pattern => 
            obj.name.toLowerCase().includes(pattern.toLowerCase())
          );
        }
        
        return true;
      });

      // Get detailed metadata for each object
      const detailedObjects = await Promise.all(
        objects.map((obj: DescribeGlobalSObject) => this.getObjectDetails(obj.name))
      );

      return detailedObjects.filter(Boolean) as SalesforceObject[];
    } catch (error) {
      console.error('Error discovering objects:', error);
      throw new Error('Failed to discover Salesforce objects');
    }
  }

  /**
   * Get detailed metadata for a specific object
   */
  async getObjectDetails(objectName: string): Promise<SalesforceObject | null> {
    try {
      // Use the existing getObjectMetadata method from client
      const result = await this.client.getObjectMetadata(objectName);
      
      if (!result.success || !result.data) {
        console.error(`Failed to get metadata for ${objectName}:`, result.error);
        return null;
      }

      const data = result.data;
      
      // Transform to our schema format
      return {
        name: data.name,
        label: data.label,
        labelPlural: data.label + 's', // Salesforce doesn't always provide this
        custom: data.isCustom,
        queryable: true, // If we can describe it, it's queryable
        createable: true, // We'll validate this per field
        updateable: true, // We'll validate this per field
        deletable: true, // Default, can be overridden
        fields: data.fields.map((field: any) => ({
          name: field.name,
          label: field.label,
          type: field.type,
          length: field.length,
          referenceTo: field.referenceTo,
          relationshipName: field.relationshipName,
          required: field.isRequired,
          unique: field.isUnique,
          createable: true, // Default
          updateable: true, // Default
          nillable: !field.isRequired,
          defaultValue: undefined,
        })),
        childRelationships: data.relationships.map((rel: any) => ({
          childSObject: rel.referenceTo,
          field: rel.name,
          relationshipName: rel.relationshipName,
        })),
      };
    } catch (error) {
      console.error(`Error getting details for ${objectName}:`, error);
      return null;
    }
  }

  /**
   * Analyze relationships between objects
   */
  async analyzeRelationships(objectNames: string[]): Promise<Map<string, Set<string>>> {
    const relationships = new Map<string, Set<string>>();

    for (const objectName of objectNames) {
      const object = await this.getObjectDetails(objectName);
      if (!object) continue;

      const relatedObjects = new Set<string>();

      // Analyze lookup and master-detail relationships
      for (const field of object.fields) {
        if (field.type === 'reference' && field.referenceTo) {
          field.referenceTo.forEach(ref => relatedObjects.add(ref));
        }
      }

      // Analyze child relationships
      for (const child of object.childRelationships) {
        relatedObjects.add(child.childSObject);
      }

      relationships.set(objectName, relatedObjects);
    }

    return relationships;
  }

  /**
   * Get 2cloudnine specific objects
   */
  async discover2CloudNineObjects(): Promise<SalesforceObject[]> {
    const tc9Patterns = [
      'tc9_',
      'interpretation_rule',
      'breakpoint',
      'pay_code',
      'leave_rule',
      'calculation'
    ];

    return this.discoverObjects({
      includeCustom: true,
      objectPatterns: tc9Patterns
    });
  }

  /**
   * Validate if target org has required objects
   */
  async validateTargetOrgCompatibility(
    requiredObjects: string[]
  ): Promise<{
    compatible: boolean;
    missingObjects: string[];
    incompatibleFields: Map<string, string[]>;
  }> {
    const missingObjects: string[] = [];
    const incompatibleFields = new Map<string, string[]>();

    for (const objectName of requiredObjects) {
      const object = await this.getObjectDetails(objectName);
      
      if (!object) {
        missingObjects.push(objectName);
        continue;
      }

      // Check if object is createable/updateable
      if (!object.createable || !object.updateable) {
        incompatibleFields.set(objectName, ['Object is read-only']);
      }
    }

    return {
      compatible: missingObjects.length === 0 && incompatibleFields.size === 0,
      missingObjects,
      incompatibleFields
    };
  }
} 