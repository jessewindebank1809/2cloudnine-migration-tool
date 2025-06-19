import { ExternalIdUtils } from "./external-id-utils";
import { ExtractConfig } from "../core/interfaces";
import { 
    escapeSoqlString, 
    sanitizeObjectName, 
    sanitizeFieldName, 
    sanitizeOrderBy,
    buildSafeInClause,
    buildSafeRecordTypeQuery 
} from "../../../security/soql-sanitizer";

export class SoqlQueryBuilder {
    /**
     * Build SOQL query with dynamic external ID field replacement
     */
    static buildQuery(
        extractConfig: ExtractConfig,
        externalIdField: string,
        selectedRecords?: string[],
    ): string {
        let query = extractConfig.soqlQuery;

        // Replace external ID field placeholders
        query = ExternalIdUtils.replaceExternalIdPlaceholders(query, externalIdField);

        // Add record selection filter if provided
        if (selectedRecords && selectedRecords.length > 0) {
            const recordFilter = buildSafeInClause('Id', selectedRecords);
            query = this.addWhereClause(query, recordFilter);
        }

        // Add additional filter criteria if specified
        if (extractConfig.filterCriteria) {
            query = this.addWhereClause(query, extractConfig.filterCriteria);
        }

        // Add order by clause if specified
        if (extractConfig.orderBy) {
            try {
                const sanitizedOrderBy = sanitizeOrderBy(extractConfig.orderBy);
                query += ` ORDER BY ${sanitizedOrderBy}`;
            } catch (e) {
                throw new Error(`Invalid ORDER BY clause: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
        }

        return query;
    }

    /**
     * Add WHERE clause to existing query
     */
    private static addWhereClause(query: string, condition: string): string {
        const upperQuery = query.toUpperCase();
        
        if (upperQuery.includes(" WHERE ")) {
            return `${query} AND ${condition}`;
        } else {
            return `${query} WHERE ${condition}`;
        }
    }

    /**
     * Validate SOQL query syntax
     */
    static validateQuery(query: string): string[] {
        const errors: string[] = [];

        // Basic SOQL validation
        if (!query.trim().toUpperCase().startsWith("SELECT")) {
            errors.push("Query must start with SELECT");
        }

        if (!query.toUpperCase().includes(" FROM ")) {
            errors.push("Query must include FROM clause");
        }

        // Check for external ID field placeholders that weren't replaced
        if (query.includes("{externalIdField}")) {
            errors.push("Query contains unreplaced external ID field placeholders");
        }

        // Check for balanced parentheses
        const openParens = (query.match(/\(/g) || []).length;
        const closeParens = (query.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
            errors.push("Unbalanced parentheses in query");
        }

        return errors;
    }

    /**
     * Extract object name from SOQL query
     */
    static extractObjectName(query: string): string | null {
        const fromMatch = query.match(/FROM\s+(\w+)/i);
        return fromMatch ? fromMatch[1] : null;
    }

    /**
     * Extract field names from SOQL query
     */
    static extractFieldNames(query: string): string[] {
        const selectMatch = query.match(/SELECT\s+([\s\S]*?)\s+FROM/i);
        if (!selectMatch) return [];

        const fieldsString = selectMatch[1];
        const fields = fieldsString
            .split(",")
            .map(field => field.trim())
            .filter(field => field.length > 0);

        return fields;
    }

    /**
     * Build validation query for dependency checks
     */
    static buildValidationQuery(
        targetObject: string,
        targetField: string,
        sourceValues: string[],
    ): string {
        const sanitizedObject = sanitizeObjectName(targetObject);
        const sanitizedField = sanitizeFieldName(targetField);
        const whereClause = buildSafeInClause(sanitizedField, sourceValues);
        return `SELECT Id, ${sanitizedField}, Name FROM ${sanitizedObject} WHERE ${whereClause}`;
    }

    /**
     * Build count query for data integrity checks
     */
    static buildCountQuery(baseQuery: string): string {
        // Replace SELECT fields with COUNT()
        const countQuery = baseQuery.replace(/SELECT\s+[\s\S]*?\s+FROM/i, "SELECT COUNT() FROM");
        return countQuery;
    }

    /**
     * Optimize query for batch processing
     */
    static optimizeForBatch(query: string, batchSize: number): string {
        let optimizedQuery = query;

        // Add LIMIT if not present and batch size is specified
        if (batchSize > 0 && !query.toUpperCase().includes(" LIMIT ")) {
            optimizedQuery += ` LIMIT ${batchSize}`;
        }

        return optimizedQuery;
    }

    /**
     * Build query for record type mapping
     */
    static buildRecordTypeQuery(objectName: string): string {
        return buildSafeRecordTypeQuery(objectName);
    }

    /**
     * Build lookup cache query
     */
    static buildLookupCacheQuery(
        lookupObject: string,
        keyField: string,
        valueField: string,
        additionalFields: string[] = [],
    ): string {
        const sanitizedObject = sanitizeObjectName(lookupObject);
        const sanitizedKeyField = sanitizeFieldName(keyField);
        const sanitizedValueField = sanitizeFieldName(valueField);
        const sanitizedAdditionalFields = additionalFields.map(f => sanitizeFieldName(f));
        
        const fields = [sanitizedKeyField, sanitizedValueField, ...sanitizedAdditionalFields].join(", ");
        return `SELECT ${fields} FROM ${sanitizedObject} WHERE ${sanitizedKeyField} != null`;
    }

    /**
     * Escape SOQL string values
     */
    static escapeString(value: string): string {
        return escapeSoqlString(value);
    }

    /**
     * Build IN clause for large value sets
     */
    static buildInClause(field: string, values: string[], maxChunkSize: number = 1000): string[] {
        const chunks: string[] = [];
        
        for (let i = 0; i < values.length; i += maxChunkSize) {
            const chunk = values.slice(i, i + maxChunkSize);
            const quotedValues = chunk.map(value => `'${this.escapeString(value)}'`);
            chunks.push(`${field} IN (${quotedValues.join(",")})`);
        }
        
        return chunks;
    }

    /**
     * Parse SOQL query to extract components
     */
    static parseQuery(query: string): {
        fields: string[];
        objectName: string | null;
        whereClause: string | null;
        orderBy: string | null;
        limit: number | null;
    } {
        const fields = this.extractFieldNames(query);
        const objectName = this.extractObjectName(query);
        
        const whereMatch = query.match(/WHERE\s+([\s\S]*?)(?:\s+ORDER\s+BY|\s+LIMIT|\s*$)/i);
        const whereClause = whereMatch ? whereMatch[1].trim() : null;
        
        const orderByMatch = query.match(/ORDER\s+BY\s+([\s\S]*?)(?:\s+LIMIT|\s*$)/i);
        const orderBy = orderByMatch ? orderByMatch[1].trim() : null;
        
        const limitMatch = query.match(/LIMIT\s+(\d+)/i);
        const limit = limitMatch ? parseInt(limitMatch[1], 10) : null;

        return {
            fields,
            objectName,
            whereClause,
            orderBy,
            limit,
        };
    }
} 