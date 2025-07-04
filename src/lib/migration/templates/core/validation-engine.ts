import {
    ValidationResult,
    ValidationIssue,
    ValidationSummary,
    ValidationConfig,
    DependencyCheck,
    DataIntegrityCheck,
    PreValidationQuery,
    PicklistValidationCheck,
    ETLStep,
    ExtractConfig,
    MigrationTemplate,
} from "./interfaces";
import { sessionManager } from "@/lib/salesforce/session-manager";
import { ExternalIdUtils } from "../utils/external-id-utils";
import { ValidationFormatter } from "./validation-formatter";

export class ValidationEngine {
    private validationCache: Map<string, any[]> = new Map();
    private sourceOrgId: string = "";
    private targetOrgId: string = "";
    private currentTargetObject: string = "";
    private currentSourceQuery: string = "";
    private sourceInstanceUrl: string = "";
    private selectedRecordIds: string[] = [];
    private seenPicklistErrors: Set<string> = new Set();

    /**
     * Formats and adds a validation issue to the appropriate collection
     */
    private addFormattedIssue(
        results: ValidationResult,
        issue: ValidationIssue,
        severity: "error" | "warning" | "info" = "error"
    ): void {
        const formattedIssue = ValidationFormatter.formatValidationIssue(
            { ...issue, severity },
            this.sourceOrgId,
            this.sourceInstanceUrl
        );
        
        switch (severity) {
            case "error":
                results.errors.push(formattedIssue);
                break;
            case "warning":
                results.warnings.push(formattedIssue);
                break;
            case "info":
                results.info.push(formattedIssue);
                break;
        }
    }

    async validateTemplate(
        template: MigrationTemplate,
        sourceOrgId: string,
        targetOrgId: string,
        selectedRecords?: string[],
        sourceInstanceUrl?: string,
    ): Promise<ValidationResult> {
        this.sourceOrgId = sourceOrgId;
        this.targetOrgId = targetOrgId;
        this.sourceInstanceUrl = sourceInstanceUrl || '';
        this.selectedRecordIds = selectedRecords || [];
        this.seenPicklistErrors.clear(); // Clear seen errors for each validation run
        
        const results: ValidationResult = this.createEmptyValidationResult();

        try {

            // Verify org connections are healthy
            const orgsHealthy = await sessionManager.areAllOrgsHealthy([sourceOrgId, targetOrgId]);
            if (!orgsHealthy) {
                this.addFormattedIssue(results, {
                    checkName: "orgConnectivity",
                    message: "One or more Salesforce organizations are not accessible",
                    severity: "error",
                    recordId: null,
                    recordName: null,
                    suggestedAction: "Check organization connections and try again",
                }, "error");
                results.isValid = false;
                this.updateValidationSummary(results);
                return results;
            }

            // Run validation for each ETL step
            console.log(`Starting validation for template: ${template.name} (${template.etlSteps.length} steps)`);
            
            for (const step of template.etlSteps) {
                if (step.validationConfig) {
                    console.log(`\n=== Validating step: ${step.stepName} ===`);
                    const stepResult = await this.validateStep(
                        step,
                        selectedRecords,
                    );
                    this.mergeValidationResults(results, stepResult);
                    console.log(`Step ${step.stepName} validation completed: ${stepResult.errors.length} errors, ${stepResult.warnings.length} warnings`);
                } else {
                    console.log(`Skipping step ${step.stepName} - no validation config`);
                }
            }

            results.isValid = results.errors.length === 0;
            this.updateValidationSummary(results);
            
            console.log(`\n=== Validation Summary ===`);
            console.log(`Total checks: ${results.summary.totalChecks}`);
            console.log(`Passed: ${results.summary.passedChecks}`);
            console.log(`Failed: ${results.summary.failedChecks}`);
            console.log(`Warnings: ${results.summary.warningChecks}`);
            console.log(`Valid: ${results.isValid}`);
            
            return results;
        } catch (error) {
            this.addFormattedIssue(results, {
                checkName: "validationError",
                message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                severity: "error",
                recordId: null,
                recordName: null,
                suggestedAction: "Check template configuration and org connectivity",
            }, "error");
            results.isValid = false;
            this.updateValidationSummary(results);
            return results;
        }
    }

    private async validateStep(
        step: ETLStep,
        selectedRecords?: string[],
    ): Promise<ValidationResult> {
        const config = step.validationConfig!;
        this.currentTargetObject = step.loadConfig.targetObject;

        try {
            // 1. Execute pre-validation queries to cache target data
            await this.executePreValidationQueries(config.preValidationQueries);

            // 2. Extract source data for validation
            const sourceData = await this.extractSourceDataForValidation(
                step.extractConfig,
                selectedRecords,
            );

            // 3. Run dependency checks
            const dependencyResults = await this.runDependencyChecks(
                config.dependencyChecks,
                sourceData,
            );

            // 4. Run data integrity checks
            const integrityResults = await this.runDataIntegrityChecks(
                config.dataIntegrityChecks,
            );

            // 5. Run picklist validation checks if configuration exists
            let picklistResults = this.createEmptyValidationResult();
            if (!config.picklistValidationChecks) {
                console.log(`\n=== Auto-detecting picklist fields for step: ${step.stepName} ===`);
                // Auto-detect picklist fields and create validation checks
                const autoPicklistChecks = await this.autoDetectPicklistFields(
                    step.transformConfig.fieldMappings,
                    step.extractConfig.objectApiName,
                    step.loadConfig.targetObject,
                );
                console.log(`Auto-detected ${autoPicklistChecks.length} picklist fields for validation`);
                if (autoPicklistChecks.length > 0) {
                    picklistResults = await this.runPicklistValidationChecks(
                        autoPicklistChecks,
                        sourceData,
                        step.extractConfig.objectApiName,
                    );
                }
            } else {
                console.log(`Using configured picklist validation checks for step: ${step.stepName}`);
                picklistResults = await this.runPicklistValidationChecks(
                    config.picklistValidationChecks,
                    sourceData,
                    step.extractConfig.objectApiName,
                );
            }

            return this.combineValidationResults([
                dependencyResults,
                integrityResults,
                picklistResults,
            ]);
        } catch (error) {
            const results = this.createEmptyValidationResult();
            this.addFormattedIssue(results, {
                checkName: step.stepName,
                message: `Step validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                severity: "error",
                recordId: null,
                recordName: null,
                suggestedAction: "Check step configuration and data access",
            }, "error");
            return results;
        }
    }

    private async executePreValidationQueries(
        queries: PreValidationQuery[],
    ): Promise<void> {
        const targetClient = await sessionManager.getClient(this.targetOrgId);
        
        for (const query of queries) {
            try {
                console.log(`Executing pre-validation query: ${query.queryName}`);
                
                // Replace external ID field placeholders in pre-validation query
                let soqlQuery = query.soqlQuery;
                const objectName = this.extractObjectFromQuery(soqlQuery);
                const externalIdField = await ExternalIdUtils.detectExternalIdField(
                    objectName,
                    targetClient
                );
                soqlQuery = ExternalIdUtils.replaceExternalIdPlaceholders(soqlQuery, externalIdField);
                
                const results = await this.executeSoqlQuery(soqlQuery, this.targetOrgId);
                // Ensure we always cache arrays for consistency
                const resultsArray = Array.isArray(results) ? results : [];
                this.validationCache.set(query.cacheKey, resultsArray);
                console.log(`Cached ${resultsArray.length} records for ${query.cacheKey}`);
                
                // Debug logging for leave rules cache content
                if (query.cacheKey === 'target_leave_rules' && resultsArray.length > 0) {
                    console.log(`Pre-validation query used: ${soqlQuery}`);
                    console.log(`External ID field detected: ${externalIdField}`);
                    const sampleRecord = resultsArray[0];
                    console.log(`Sample leave rule record:`, JSON.stringify(sampleRecord, null, 2));
                }
            } catch (error) {
                console.error(`Failed to execute pre-validation query ${query.queryName}:`, error);
                this.validationCache.set(query.cacheKey, []);
            }
        }
    }

    private async extractSourceDataForValidation(
        extractConfig: ExtractConfig,
        selectedRecords?: string[],
    ): Promise<any[]> {
        let query = extractConfig.soqlQuery;
        this.currentSourceQuery = query;
        
        // Replace external ID field placeholders
        const sourceClient = await sessionManager.getClient(this.sourceOrgId);
        const externalIdField = await ExternalIdUtils.detectExternalIdField(
            extractConfig.objectApiName,
            sourceClient
        );
        query = ExternalIdUtils.replaceExternalIdPlaceholders(query, externalIdField);
        
        // Replace selectedRecordIds placeholder if present
        const hasSelectedRecordsPlaceholder = query.includes('{selectedRecordIds}');
        if (hasSelectedRecordsPlaceholder) {
            if (this.selectedRecordIds && this.selectedRecordIds.length > 0) {
                query = query.replace(/{selectedRecordIds}/g, `'${this.selectedRecordIds.join("','")}'`);
            } else {
                // If no records selected, replace with empty condition
                query = query.replace(/{selectedRecordIds}/g, "''");
            }
        }
        
        // Add record selection filter if provided and query doesn't already have selectedRecordIds placeholder
        if (selectedRecords && selectedRecords.length > 0 && !hasSelectedRecordsPlaceholder) {
            const recordFilter = `Id IN ('${selectedRecords.join("','")}')`;
            query = query.includes("WHERE") 
                ? `${query} AND ${recordFilter}`
                : `${query} WHERE ${recordFilter}`;
        }

        // Add LIMIT for validation to prevent large data extraction
        if (!query.toUpperCase().includes("LIMIT")) {
            query += " LIMIT 1000";
        }

        console.log(`Extracting source data for validation: ${extractConfig.objectApiName}`);
        console.log(`Final query: ${query}`);
        const result = await this.executeSoqlQuery(query, this.sourceOrgId);
        // Ensure we always return an array for source data
        return Array.isArray(result) ? result : [];
    }

    private async runDependencyChecks(
        checks: DependencyCheck[],
        sourceData: any[],
    ): Promise<ValidationResult> {
        const results: ValidationResult = this.createEmptyValidationResult();

        for (const check of checks) {
            const cacheKey = this.getCacheKeyForObject(check.targetObject);
            const targetCache = this.validationCache.get(cacheKey);
            
            console.log(`Running dependency check: ${check.checkName} for ${check.targetObject} (cache key: ${cacheKey})`);
            
            if (!targetCache) {
                console.error(`Target cache not found for ${check.targetObject} (cache key: ${cacheKey})`);
                console.error(`Available cache keys: ${Array.from(this.validationCache.keys()).join(', ')}`);
                this.addFormattedIssue(results, {
                    checkName: check.checkName,
                    message: `Target cache for ${check.targetObject} not found (cache key: ${cacheKey})`,
                    severity: "error",
                    recordId: null,
                    recordName: null,
                }, "error");
                continue;
            }
            
            console.log(`Found ${targetCache.length} cached records for ${check.targetObject}`);

            // Get external ID fields for both source and target orgs
            const sourceClient = await sessionManager.getClient(this.sourceOrgId);
            const targetClient = await sessionManager.getClient(this.targetOrgId);
            
            // Detect external ID field for source org (for source field resolution)
            const sourceExternalIdField = await ExternalIdUtils.detectExternalIdField(
                check.targetObject,
                sourceClient
            );
            
            // Detect external ID field for target org (for target field resolution)
            const targetExternalIdField = await ExternalIdUtils.detectExternalIdField(
                check.targetObject,
                targetClient
            );
            
            // Resolve placeholders with appropriate external ID fields
            const resolvedTargetField = ExternalIdUtils.replaceExternalIdPlaceholders(
                check.targetField,
                targetExternalIdField
            );
            
            const resolvedSourceField = ExternalIdUtils.replaceExternalIdPlaceholders(
                check.sourceField,
                sourceExternalIdField
            );
            
            // Debug logging for leave rules cache
            if (check.targetObject === 'tc9_pr__Leave_Rule__c' && targetCache.length > 0) {
                console.log(`Source external ID field: ${sourceExternalIdField}, Target external ID field: ${targetExternalIdField}`);
                const sampleIds = targetCache.slice(0, 5).map(t => t[resolvedTargetField]).filter(Boolean);
                console.log(`Sample Leave Rule external IDs in target cache: ${sampleIds.join(', ')}`);
            }

            // Check each source record
            let checkedRecords = 0;
            let foundIssues = 0;
            
            for (const record of sourceData) {
                checkedRecords++;
                const sourceValue = this.getFieldValue(record, resolvedSourceField);
                
                // Skip null references - they are allowed
                if (!sourceValue) {
                    continue;
                }
                
                // Only validate non-null references
                // Use case-insensitive comparison for external IDs to handle org differences
                const targetExists = targetCache.some((target) => {
                    const targetValue = target[resolvedTargetField];
                    if (!targetValue) return false;
                    
                    // For external ID fields, use case-insensitive comparison
                    if (resolvedTargetField.includes('External_ID') || resolvedTargetField.includes('external_id')) {
                        const matches = targetValue.toLowerCase() === sourceValue.toLowerCase();
                        // Debug logging for leave rules
                        if (check.targetObject === 'tc9_pr__Leave_Rule__c' && !matches) {
                            console.log(`Leave Rule mismatch: source="${sourceValue}" target="${targetValue}" (case-insensitive comparison)`);
                        }
                        return matches;
                    }
                    
                    // For other fields, use exact match
                    return targetValue === sourceValue;
                });

                if (!targetExists) {
                    foundIssues++;
                    if (check.isRequired) {
                        // Extract field name from the source field path for context
                        // e.g., "tc9_et__Pay_Code__r.{externalIdField}" -> "tc9_et__Pay_Code__r"
                        const relationshipPath = resolvedSourceField.split('.')[0];
                        const relationshipName = relationshipPath.replace('__r', '__c');
                        
                        // Try to get the name from the relationship object if available
                        let missingTargetName = null;
                        if (relationshipPath.endsWith('__r') && record[relationshipPath]) {
                            missingTargetName = record[relationshipPath].Name || null;
                        }
                        
                        this.addFormattedIssue(results, {
                            checkName: check.checkName,
                            message: check.errorMessage
                                .replace("{sourceValue}", sourceValue)
                                .replace("{recordName}", record.Name || record.Id),
                            severity: "error",
                            recordId: record.Id,
                            recordName: record.Name,
                            parentRecordId: record.tc9_et__Interpretation_Rule__c || null,
                            field: resolvedSourceField,
                            // Pass additional context for better error formatting
                            context: {
                                sourceValue,
                                targetObject: check.targetObject,
                                missingTargetName,
                                missingTargetExternalId: sourceValue,
                                sourceRecordType: record.RecordType?.Name || null,
                            }
                        }, "error");
                    } else if (check.warningMessage) {
                        this.addFormattedIssue(results, {
                            checkName: check.checkName,
                            message: check.warningMessage
                                .replace("{sourceValue}", sourceValue)
                                .replace("{recordName}", record.Name || record.Id),
                            severity: "warning",
                            recordId: record.Id,
                            recordName: record.Name,
                            parentRecordId: record.tc9_et__Interpretation_Rule__c || null,
                            field: resolvedSourceField,
                        }, "warning");
                    }
                }
            }
            
            console.log(`✓ Dependency check ${check.checkName}: checked ${checkedRecords} records, found ${foundIssues} issues`);
        }

        return results;
    }

    private async runDataIntegrityChecks(
        checks: DataIntegrityCheck[],
    ): Promise<ValidationResult> {
        const results: ValidationResult = this.createEmptyValidationResult();

        for (const check of checks) {
            try {
                console.log(`Running data integrity check: ${check.checkName}`);
                
                // Replace external ID field placeholders in validation query
                let query = check.validationQuery;
                const sourceClient = await sessionManager.getClient(this.sourceOrgId);
                const externalIdField = await ExternalIdUtils.detectExternalIdField(
                    this.extractObjectFromQuery(query),
                    sourceClient
                );
                query = ExternalIdUtils.replaceExternalIdPlaceholders(query, externalIdField);
                
                // Replace selectedRecordIds placeholder if present
                if (query.includes('{selectedRecordIds}')) {
                    if (this.selectedRecordIds && this.selectedRecordIds.length > 0) {
                        query = query.replace(/{selectedRecordIds}/g, `'${this.selectedRecordIds.join("','")}'`);
                    } else {
                        // If no records selected, skip this check
                        console.log(`Skipping check ${check.checkName} - no records selected`);
                        continue;
                    }
                }
                
                console.log(`Executing query: ${query}`);
                const queryResult = await this.executeSoqlQuery(query, this.sourceOrgId);
                const count = typeof queryResult === 'number' ? queryResult : queryResult.length;

                console.log(`Query returned ${count} records for check: ${check.checkName}`);
                if (Array.isArray(queryResult) && queryResult.length > 0) {
                    console.log(`Sample records:`, queryResult.slice(0, 3));
                }

                let isValid = false;
                switch (check.expectedResult) {
                    case "empty":
                        isValid = count === 0;
                        break;
                    case "non-empty":
                        isValid = count > 0;
                        break;
                    case "count-match":
                        // For count-match, we expect the count to match a specific value
                        // This would need additional configuration in the check
                        isValid = true;
                        break;
                }

                if (!isValid) {
                    console.log(`❌ Data integrity check failed: ${check.checkName} (expected ${check.expectedResult}, found ${count} records)`);
                    
                    // Process individual records if the query returned actual records (not aggregate results)
                    if (Array.isArray(queryResult) && queryResult.length > 0 && queryResult[0].Id) {
                        console.log(`Processing ${queryResult.length} individual records for ${check.checkName}`);
                        // Create individual issues for each record
                        for (const record of queryResult) {
                            console.log(`Creating issue for record:`, { id: record.Id, name: record.Name });
                            const issue: ValidationIssue = {
                                checkName: check.checkName,
                                message: check.errorMessage,
                                severity: check.severity,
                                recordId: record.Id || null,
                                recordName: record.Name || null,
                                parentRecordId: record.tc9_et__Interpretation_Rule__c || null,
                                suggestedAction: check.checkName.includes('ExternalIdValidation') 
                                    ? "Populate external IDs before migration"
                                    : "Review data quality and fix issues before migration",
                            };
                            this.addFormattedIssue(results, issue, check.severity);
                        }
                        console.log(`Created ${queryResult.length} individual validation issues`);
                    } else {
                        // Generic issue for aggregate results or when no specific records
                        const issue: ValidationIssue = {
                            checkName: check.checkName,
                            message: `${check.errorMessage} (Found ${count} records)`,
                            severity: check.severity,
                            recordId: null,
                            recordName: null,
                            suggestedAction: check.checkName === 'dailyHoursBreakpointPayCodeNotNull'
                                ? "Update all Daily Hours Breakpoints to have a valid pay code with 'Payment' record type"
                                : "Review data quality and fix issues before migration",
                        };
                        this.addFormattedIssue(results, issue, check.severity);
                    }
                } else {
                    console.log(`✓ Data integrity check passed: ${check.checkName} (expected ${check.expectedResult}, found ${count} records)`);
                }
            } catch (error) {
                this.addFormattedIssue(results, {
                    checkName: check.checkName,
                    message: `Failed to execute integrity check: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    severity: "error",
                    recordId: null,
                    recordName: null,
                    suggestedAction: "Check query syntax and object permissions",
                }, "error");
            }
        }

        return results;
    }

    private createEmptyValidationResult(): ValidationResult {
        return {
            isValid: true,
            errors: [],
            warnings: [],
            info: [],
            summary: {
                totalChecks: 0,
                passedChecks: 0,
                failedChecks: 0,
                warningChecks: 0,
            },
        };
    }

    private mergeValidationResults(
        target: ValidationResult,
        source: ValidationResult,
    ): void {
        target.errors.push(...source.errors);
        target.warnings.push(...source.warnings);
        target.info.push(...source.info);
    }

    private combineValidationResults(
        results: ValidationResult[],
    ): ValidationResult {
        const combined = this.createEmptyValidationResult();
        
        for (const result of results) {
            this.mergeValidationResults(combined, result);
        }
        
        combined.isValid = combined.errors.length === 0;
        this.updateValidationSummary(combined);
        return combined;
    }

    private updateValidationSummary(result: ValidationResult): void {
        result.summary.totalChecks = 
            result.errors.length + result.warnings.length + result.info.length;
        result.summary.failedChecks = result.errors.length;
        result.summary.warningChecks = result.warnings.length;
        result.summary.passedChecks = 
            result.summary.totalChecks - result.summary.failedChecks - result.summary.warningChecks;
    }

    private getFieldValue(record: any, fieldPath: string): any {
        const parts = fieldPath.split('.');
        let value = record;
        
        for (const part of parts) {
            if (value && typeof value === 'object') {
                value = value[part];
            } else {
                return null;
            }
        }
        
        return value;
    }

    private getCacheKeyForObject(objectName: string): string {
        // Map object names to their corresponding cache keys as defined in templates
        const cacheKeyMap: { [key: string]: string } = {
            'tc9_pr__Pay_Code__c': 'target_pay_codes',
            'tc9_et__Interpretation_Rule__c': 'target_interpretation_rules',
            'tc9_pr__Leave_Rule__c': 'target_leave_rules',
            'tc9_et__Interpretation_Breakpoint__c': 'target_interpretation_breakpoints',
        };
        
        return cacheKeyMap[objectName] || `target_${objectName.toLowerCase().replace('__c', '').replace('tc9_et__', '')}`;
    }

    private async executeSoqlQuery(query: string, orgId: string): Promise<any[] | number> {
        try {
            const client = await sessionManager.getClient(orgId);
            const result = await client.query(query);
            
            if (!result.success) {
                throw new Error(result.error || 'Query failed');
            }
            
            // Check if this is an aggregate query (COUNT, SUM, etc.)
            if (query.toUpperCase().includes('COUNT()')) {
                // For COUNT queries, Salesforce returns totalSize with the count
                // The client returns { success, data, totalSize }
                console.log(`COUNT query result:`, { totalSize: result.totalSize, data: result.data });
                return result.totalSize || 0;
            }
            
            return result.data || [];
        } catch (error) {
            console.error(`SOQL query failed for org ${orgId}:`, error);
            console.error(`Query: ${query}`);
            throw error;
        }
    }

    private extractObjectFromQuery(query: string): string {
        // Extract object name from SOQL query (FROM clause)
        const fromMatch = query.match(/FROM\s+([a-zA-Z0-9_]+)/i);
        return fromMatch ? fromMatch[1] : "";
    }

    private async autoDetectPicklistFields(
        fieldMappings: any[],
        sourceObject: string,
        targetObject: string,
    ): Promise<PicklistValidationCheck[]> {
        const picklistChecks: PicklistValidationCheck[] = [];
        
        try {
            // Get target object metadata to identify picklist fields
            const targetClient = await sessionManager.getClient(this.targetOrgId);
            const targetMetadata = await targetClient.getObjectMetadata(targetObject);
            
            if (!targetMetadata.success || !targetMetadata.data) {
                console.error(`Failed to get metadata for target object ${targetObject}`);
                return picklistChecks;
            }
            
            // Create a map of field names to field metadata
            const targetFieldMap = new Map<string, any>();
            targetMetadata.data.fields.forEach((field: any) => {
                targetFieldMap.set(field.name, field);
            });
            
            // Check each field mapping for picklist fields
            console.log(`Checking ${fieldMappings.length} field mappings for picklist fields`);
            for (const mapping of fieldMappings) {
                if (mapping.transformationType === 'direct') {
                    const targetFieldMeta = targetFieldMap.get(mapping.targetField);
                    
                    if (targetFieldMeta) {
                        console.log(`Field ${mapping.targetField}: type=${targetFieldMeta.type}, hasPicklistValues=${!!targetFieldMeta.picklistValues}`);
                        if (targetFieldMeta.type === 'picklist' || targetFieldMeta.type === 'multipicklist') {
                            picklistChecks.push({
                                checkName: `picklistValidation_${mapping.targetField}`,
                                description: `Validate picklist values for ${mapping.targetField}`,
                                fieldName: mapping.targetField,
                                objectName: targetObject,
                                validateAgainstTarget: true,
                                errorMessage: `Invalid picklist value '{sourceValue}' for field ${mapping.targetField} in record '{recordName}'. This value does not exist in the target org.`,
                                severity: "error",
                            });
                            console.log(`✓ Auto-detected picklist field for validation: ${mapping.targetField}`);
                        }
                    } else {
                        console.log(`Field ${mapping.targetField} not found in target metadata`);
                    }
                }
            }
            
            return picklistChecks;
        } catch (error) {
            console.error('Error auto-detecting picklist fields:', error);
            return picklistChecks;
        }
    }

    private async runPicklistValidationChecks(
        checks: PicklistValidationCheck[],
        sourceData: any[],
        sourceObject?: string,
    ): Promise<ValidationResult> {
        const results: ValidationResult = this.createEmptyValidationResult();
        
        if (checks.length === 0) {
            return results;
        }
        
        try {
            // For picklist validation, we need to check ALL unique values, not just sample records
            // First, let's get all unique picklist values from the source
            const uniquePicklistValues = await this.getUniquePicklistValues(checks, sourceObject || this.extractObjectFromQuery(this.currentSourceQuery));
            // Get target object from the first check's context
            // In the actual implementation, the target object should be passed from the ETL config
            const targetObject = this.currentTargetObject;
                
            if (!targetObject) {
                console.error('Cannot determine target object for picklist validation');
                return results;
            }
            
            const targetClient = await sessionManager.getClient(this.targetOrgId);
            const targetMetadata = await targetClient.getObjectMetadata(targetObject);
            
            if (!targetMetadata.success || !targetMetadata.data) {
                this.addFormattedIssue(results, {
                    checkName: 'picklistValidation',
                    message: `Failed to get metadata for target object ${targetObject}`,
                    severity: 'error',
                    recordId: null,
                    recordName: null,
                }, 'error');
                return results;
            }
            
            // Create a map of field names to valid picklist values
            const fieldPicklistValues = new Map<string, Set<string>>();
            targetMetadata.data.fields.forEach((field: any) => {
                if ((field.type === 'picklist' || field.type === 'multipicklist') && field.picklistValues) {
                    const validValues = new Set<string>();
                    field.picklistValues.forEach((pv: any) => {
                        if (pv.active) {
                            validValues.add(pv.value);
                        }
                    });
                    fieldPicklistValues.set(field.name, validValues);
                    console.log(`Found picklist field ${field.name} with ${validValues.size} valid values`);
                }
            });
            
            // Validate each check
            for (const check of checks) {
                const validValues = fieldPicklistValues.get(check.fieldName);
                
                if (!validValues) {
                    console.warn(`No picklist values found for field ${check.fieldName}`);
                    continue;
                }
                
                console.log(`Running picklist validation: ${check.checkName} for ${check.fieldName}`);
                console.log(`Valid values for ${check.fieldName}: ${Array.from(validValues).join(', ')}`);
                
                // Get unique source values for this field
                const sourceUniqueValues = uniquePicklistValues.get(check.fieldName) || new Set<string>();
                
                // Check all unique values from source
                let foundIssues = 0;
                const invalidValues: string[] = [];
                
                for (const sourceValue of Array.from(sourceUniqueValues)) {
                    if (!validValues.has(sourceValue)) {
                        foundIssues++;
                        invalidValues.push(sourceValue);
                    }
                }
                
                if (foundIssues > 0) {
                    // Create a unique key for this picklist error to avoid duplicates
                    const errorKey = `${check.fieldName}-${invalidValues.sort().join(',')}`;
                    
                    if (!this.seenPicklistErrors.has(errorKey)) {
                        this.seenPicklistErrors.add(errorKey);
                        this.addFormattedIssue(results, {
                            checkName: check.checkName,
                            message: `Invalid picklist values found for field ${check.fieldName}: ${invalidValues.join(', ')}. These values do not exist in the target org.`,
                            severity: 'error',
                            recordId: null,
                            recordName: null,
                            suggestedAction: `Valid values are: ${Array.from(validValues).join(', ')}`,
                        }, 'error');
                    }
                }
                
                console.log(`✓ Picklist validation ${check.checkName}: checked ${sourceUniqueValues.size} unique values, found ${foundIssues} invalid values`);
            }
            
            return results;
        } catch (error) {
            this.addFormattedIssue(results, {
                checkName: 'picklistValidation',
                message: `Failed to run picklist validation: ${error instanceof Error ? error.message : 'Unknown error'}`,
                severity: 'error',
                recordId: null,
                recordName: null,
            }, 'error');
            return results;
        }
    }

    private async getUniquePicklistValues(
        checks: PicklistValidationCheck[],
        sourceObject: string
    ): Promise<Map<string, Set<string>>> {
        const fieldUniqueValues = new Map<string, Set<string>>();
        
        try {
            // Build a query to get unique picklist values for each field
            for (const check of checks) {
                try {
                    // First attempt with GROUP BY
                    const uniqueValuesQuery = `
                        SELECT ${check.fieldName}, COUNT(Id) recordCount 
                        FROM ${sourceObject}
                        WHERE ${check.fieldName} != null
                        GROUP BY ${check.fieldName}
                        ORDER BY COUNT(Id) DESC
                    `;
                    
                    console.log(`Getting unique values for field ${check.fieldName}`);
                    const uniqueResults = await this.executeSoqlQuery(uniqueValuesQuery, this.sourceOrgId);
                    
                    const values = new Set<string>();
                    // Ensure we have an array to iterate over
                    const resultsArray = Array.isArray(uniqueResults) ? uniqueResults : [];
                    resultsArray.forEach((row: any) => {
                        if (row[check.fieldName]) {
                            values.add(row[check.fieldName]);
                        }
                    });
                    
                    fieldUniqueValues.set(check.fieldName, values);
                    console.log(`Found ${values.size} unique values for ${check.fieldName}: ${Array.from(values).slice(0, 10).join(', ')}${values.size > 10 ? '...' : ''}`);
                } catch (groupByError: any) {
                    // If GROUP BY fails (e.g., for multipicklist fields), fall back to getting all values
                    const errorMessage = groupByError.message || groupByError.toString() || '';
                    if (errorMessage.includes('can not be grouped') || errorMessage.includes('ERROR at Row')) {
                        console.log(`Field ${check.fieldName} cannot be grouped (likely a multipicklist). Fetching all values...`);
                        
                        const fallbackQuery = `
                            SELECT ${check.fieldName} 
                            FROM ${sourceObject}
                            WHERE ${check.fieldName} != null
                            LIMIT 1000
                        `;
                        
                        try {
                            const fallbackResults = await this.executeSoqlQuery(fallbackQuery, this.sourceOrgId);
                            const values = new Set<string>();
                            
                            // Ensure we have an array to iterate over
                            const fallbackArray = Array.isArray(fallbackResults) ? fallbackResults : [];
                            fallbackArray.forEach((row: any) => {
                                const fieldValue = row[check.fieldName];
                                if (fieldValue) {
                                    // For multipicklist, split by semicolon
                                    if (fieldValue.includes(';')) {
                                        fieldValue.split(';').forEach((v: string) => values.add(v.trim()));
                                    } else {
                                        values.add(fieldValue);
                                    }
                                }
                            });
                            
                            fieldUniqueValues.set(check.fieldName, values);
                            console.log(`Found ${values.size} unique values for multipicklist ${check.fieldName}`);
                        } catch (fallbackError) {
                            console.error(`Failed to fetch values for field ${check.fieldName} even with fallback query:`, fallbackError);
                            // Continue with other fields instead of failing completely
                            fieldUniqueValues.set(check.fieldName, new Set<string>());
                        }
                    } else {
                        throw groupByError;
                    }
                }
            }
        } catch (error) {
            console.error('Error getting unique picklist values:', error);
        }
        
        return fieldUniqueValues;
    }

    // Clear cache for testing or reset
    public clearCache(): void {
        this.validationCache.clear();
    }
} 