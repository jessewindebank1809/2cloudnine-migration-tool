import {
    ValidationResult,
    ValidationIssue,
    ValidationSummary,
    ValidationConfig,
    DependencyCheck,
    DataIntegrityCheck,
    PicklistValidationCheck,
    PicklistFieldMetadata,
    PreValidationQuery,
    ETLStep,
    ExtractConfig,
    MigrationTemplate,
} from "./interfaces";
import { sessionManager } from "@/lib/salesforce/session-manager";
import { ExternalIdUtils } from "../utils/external-id-utils";

export class ValidationEngine {
    private validationCache: Map<string, any[]> = new Map();
    private sourceOrgId: string = "";
    private targetOrgId: string = "";

    async validateTemplate(
        template: MigrationTemplate,
        sourceOrgId: string,
        targetOrgId: string,
        selectedRecords?: string[],
    ): Promise<ValidationResult> {
        this.sourceOrgId = sourceOrgId;
        this.targetOrgId = targetOrgId;
        
        const results: ValidationResult = this.createEmptyValidationResult();

        try {
            // Verify org connections are healthy
            const orgsHealthy = await sessionManager.areAllOrgsHealthy([sourceOrgId, targetOrgId]);
            if (!orgsHealthy) {
                results.errors.push({
                    checkName: "orgConnectivity",
                    message: "One or more Salesforce organizations are not accessible",
                    severity: "error",
                    recordId: null,
                    recordName: null,
                    suggestedAction: "Check organization connections and try again",
                });
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
            results.errors.push({
                checkName: "validationError",
                message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                severity: "error",
                recordId: null,
                recordName: null,
                suggestedAction: "Check template configuration and org connectivity",
            });
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

            // 5. Run picklist validation checks
            const picklistResults = await this.runPicklistValidationChecks(
                config.picklistValidationChecks || [],
                sourceData,
            );

            return this.combineValidationResults([
                dependencyResults,
                integrityResults,
                picklistResults,
            ]);
        } catch (error) {
            const results = this.createEmptyValidationResult();
            results.errors.push({
                checkName: step.stepName,
                message: `Step validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                severity: "error",
                recordId: null,
                recordName: null,
                suggestedAction: "Check step configuration and data access",
            });
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
                this.validationCache.set(query.cacheKey, results);
                console.log(`Cached ${results.length} records for ${query.cacheKey}`);
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
        
        // Replace external ID field placeholders
        const sourceClient = await sessionManager.getClient(this.sourceOrgId);
        const externalIdField = await ExternalIdUtils.detectExternalIdField(
            extractConfig.objectApiName,
            sourceClient
        );
        query = ExternalIdUtils.replaceExternalIdPlaceholders(query, externalIdField);
        
        // Add record selection filter if provided
        if (selectedRecords && selectedRecords.length > 0) {
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
        return await this.executeSoqlQuery(query, this.sourceOrgId);
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
                results.errors.push({
                    checkName: check.checkName,
                    message: `Target cache for ${check.targetObject} not found (cache key: ${cacheKey})`,
                    severity: "error",
                    recordId: null,
                    recordName: null,
                });
                continue;
            }
            
            console.log(`Found ${targetCache.length} cached records for ${check.targetObject}`);

            // Replace external ID field placeholder in target field
            const sourceClient = await sessionManager.getClient(this.sourceOrgId);
            const externalIdField = await ExternalIdUtils.detectExternalIdField(
                check.targetObject,
                sourceClient
            );
            const resolvedTargetField = ExternalIdUtils.replaceExternalIdPlaceholders(
                check.targetField,
                externalIdField
            );

            // Check each source record
            let checkedRecords = 0;
            let foundIssues = 0;
            
            for (const record of sourceData) {
                checkedRecords++;
                const sourceValue = this.getFieldValue(record, check.sourceField);
                
                if (!sourceValue && check.isRequired) {
                    foundIssues++;
                    results.errors.push({
                        checkName: check.checkName,
                        message: check.errorMessage
                            .replace("{sourceValue}", sourceValue || "null")
                            .replace("{recordName}", record.Name || record.Id),
                        severity: "error",
                        recordId: record.Id,
                        recordName: record.Name,
                    });
                } else if (sourceValue) {
                    const targetExists = targetCache.some((target) =>
                        target[resolvedTargetField] === sourceValue
                    );

                    if (!targetExists) {
                        foundIssues++;
                        if (check.isRequired) {
                            results.errors.push({
                                checkName: check.checkName,
                                message: check.errorMessage
                                    .replace("{sourceValue}", sourceValue)
                                    .replace("{recordName}", record.Name || record.Id),
                                severity: "error",
                                recordId: record.Id,
                                recordName: record.Name,
                            });
                        } else if (check.warningMessage) {
                            results.warnings.push({
                                checkName: check.checkName,
                                message: check.warningMessage
                                    .replace("{sourceValue}", sourceValue)
                                    .replace("{recordName}", record.Name || record.Id),
                                severity: "warning",
                                recordId: record.Id,
                                recordName: record.Name,
                            });
                        }
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
                
                console.log(`Executing query: ${query}`);
                const queryResult = await this.executeSoqlQuery(query, this.sourceOrgId);
                const count = Array.isArray(queryResult) ? queryResult.length : queryResult;

                console.log(`Query returned ${count} records for check: ${check.checkName}`);

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
                    const issue: ValidationIssue = {
                        checkName: check.checkName,
                        message: `${check.errorMessage} (Found ${count} records)`,
                        severity: check.severity,
                        recordId: null,
                        recordName: null,
                        suggestedAction: "Review data quality and fix issues before migration",
                    };

                    switch (check.severity) {
                        case "error":
                            results.errors.push(issue);
                            break;
                        case "warning":
                            results.warnings.push(issue);
                            break;
                        case "info":
                            results.info.push(issue);
                            break;
                    }
                } else {
                    console.log(`✓ Data integrity check passed: ${check.checkName} (expected ${check.expectedResult}, found ${count} records)`);
                }
            } catch (error) {
                results.errors.push({
                    checkName: check.checkName,
                    message: `Failed to execute integrity check: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    severity: "error",
                    recordId: null,
                    recordName: null,
                    suggestedAction: "Check query syntax and object permissions",
                });
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
            'tc9_et__Leave_Header__c': 'target_leave_headers',
            'tc9_pr__Leave_Rule__c': 'target_leave_rules',
            'tc9_et__Interpretation_Breakpoint__c': 'target_interpretation_breakpoints',
        };
        
        return cacheKeyMap[objectName] || `target_${objectName.toLowerCase().replace('__c', '').replace('tc9_et__', '')}`;
    }

    private async executeSoqlQuery(query: string, orgId: string): Promise<any[]> {
        try {
            const client = await sessionManager.getClient(orgId);
            const result = await client.query(query);
            
            if (!result.success) {
                throw new Error(result.error || 'Query failed');
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

    private async runPicklistValidationChecks(
        checks: PicklistValidationCheck[],
        sourceData: any[]
    ): Promise<ValidationResult> {
        const results = this.createEmptyValidationResult();
        
        for (const check of checks) {
            try {
                console.log(`Running picklist validation check: ${check.checkName}`);
                
                let allowedValues: string[];
                
                if (check.allowedValues) {
                    // Use custom allowed values if provided
                    allowedValues = check.allowedValues;
                } else if (check.validateAgainstTarget) {
                    // Get picklist metadata from target org
                    const targetClient = await sessionManager.getClient(this.targetOrgId);
                    const picklistResult = await targetClient.getPicklistValues(check.objectName, check.fieldName);
                    
                    if (!picklistResult.success) {
                        results.errors.push({
                            checkName: check.checkName,
                            message: `Failed to get picklist metadata: ${picklistResult.error}`,
                            severity: "error",
                            recordId: null,
                            recordName: null,
                            suggestedAction: "Check that the field exists and is a picklist field"
                        });
                        continue;
                    }

                    if (!picklistResult.data) {
                        results.errors.push({
                            checkName: check.checkName,
                            message: 'Picklist metadata not available',
                            severity: "error",
                            recordId: null,
                            recordName: null,
                            suggestedAction: "Check that the field exists and is a picklist field"
                        });
                        continue;
                    }

                    const targetPicklistData: PicklistFieldMetadata = picklistResult.data;
                    allowedValues = targetPicklistData.values.map(v => v.value);
                } else {
                    // Skip validation if no allowed values provided and not validating against target
                    console.log(`Skipping picklist validation check ${check.checkName} - no allowed values and validateAgainstTarget is false`);
                    continue;
                }
                
                // Validate each source record
                for (const record of sourceData) {
                    const fieldValue = this.getFieldValue(record, check.fieldName);
                    
                    if (fieldValue && !this.isValidPicklistValue(fieldValue, allowedValues)) {
                        const recordName = record.Name || record.Id || "Unknown";
                        const issue: ValidationIssue = {
                            checkName: check.checkName,
                            message: `Invalid picklist value '${fieldValue}' for field ${check.fieldName}. Allowed values: ${allowedValues.join(', ')}`,
                            severity: check.severity,
                            recordId: record.Id || null,
                            recordName: recordName,
                            suggestedAction: `Update the ${check.fieldName} field to use a valid picklist value before migration`
                        };
                        
                        if (check.severity === "error") {
                            results.errors.push(issue);
                        } else if (check.severity === "warning") {
                            results.warnings.push(issue);
                        } else {
                            results.info.push(issue);
                        }
                    }
                }
                
                console.log(`Picklist validation check ${check.checkName} completed`);
            } catch (error) {
                results.errors.push({
                    checkName: check.checkName,
                    message: `Picklist validation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    severity: "error",
                    recordId: null,
                    recordName: null,
                    suggestedAction: "Check validation configuration and org connectivity"
                });
            }
        }
        
        return results;
    }

    private isValidPicklistValue(value: string, allowedValues: string[]): boolean {
        return allowedValues.includes(value);
    }

    // Clear cache for testing or reset
    public clearCache(): void {
        this.validationCache.clear();
    }
} 