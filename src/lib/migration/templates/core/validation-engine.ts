import {
    ValidationResult,
    ValidationIssue,
    ValidationSummary,
    ValidationConfig,
    DependencyCheck,
    DataIntegrityCheck,
    PreValidationQuery,
    ETLStep,
    ExtractConfig,
    MigrationTemplate,
} from "./interfaces";

export class ValidationEngine {
    private validationCache: Map<string, any[]> = new Map();

    async validateTemplate(
        template: MigrationTemplate,
        sourceOrgId: string,
        targetOrgId: string,
        selectedRecords?: string[],
    ): Promise<ValidationResult> {
        const results: ValidationResult = this.createEmptyValidationResult();

        // Run validation for each ETL step
        for (const step of template.etlSteps) {
            if (step.validationConfig) {
                const stepResult = await this.validateStep(
                    step,
                    selectedRecords,
                );
                this.mergeValidationResults(results, stepResult);
            }
        }

        results.isValid = results.errors.length === 0;
        this.updateValidationSummary(results);
        return results;
    }

    private async validateStep(
        step: ETLStep,
        selectedRecords?: string[],
    ): Promise<ValidationResult> {
        const config = step.validationConfig!;

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

        return this.combineValidationResults([
            dependencyResults,
            integrityResults,
        ]);
    }

    private async executePreValidationQueries(
        queries: PreValidationQuery[],
    ): Promise<void> {
        for (const query of queries) {
            try {
                // TODO: Replace with actual Salesforce connection
                const results = await this.executeSoqlQuery(query.soqlQuery);
                this.validationCache.set(query.cacheKey, results);
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
        
        // Add record selection filter if provided
        if (selectedRecords && selectedRecords.length > 0) {
            const recordFilter = `Id IN ('${selectedRecords.join("','")}')`;
            query = query.includes("WHERE") 
                ? `${query} AND ${recordFilter}`
                : `${query} WHERE ${recordFilter}`;
        }

        // TODO: Replace with actual Salesforce connection
        return await this.executeSoqlQuery(query);
    }

    private async runDependencyChecks(
        checks: DependencyCheck[],
        sourceData: any[],
    ): Promise<ValidationResult> {
        const results: ValidationResult = this.createEmptyValidationResult();

        for (const check of checks) {
            const targetCache = this.validationCache.get(
                this.getCacheKeyForObject(check.targetObject),
            );
            
            if (!targetCache) {
                results.errors.push({
                    checkName: check.checkName,
                    message: `Target cache for ${check.targetObject} not found`,
                    severity: "error",
                    recordId: null,
                    recordName: null,
                });
                continue;
            }

            // Check each source record
            for (const record of sourceData) {
                const sourceValue = this.getFieldValue(record, check.sourceField);
                
                if (!sourceValue && check.isRequired) {
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
                        target[check.targetField] === sourceValue
                    );

                    if (!targetExists) {
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
        }

        return results;
    }

    private async runDataIntegrityChecks(
        checks: DataIntegrityCheck[],
    ): Promise<ValidationResult> {
        const results: ValidationResult = this.createEmptyValidationResult();

        for (const check of checks) {
            try {
                // TODO: Replace with actual Salesforce connection
                const queryResult = await this.executeSoqlQuery(check.validationQuery);
                const count = Array.isArray(queryResult) ? queryResult.length : queryResult;

                let isValid = false;
                switch (check.expectedResult) {
                    case "empty":
                        isValid = count === 0;
                        break;
                    case "non-empty":
                        isValid = count > 0;
                        break;
                    case "count-match":
                        // Additional logic needed for count matching
                        isValid = true;
                        break;
                }

                if (!isValid) {
                    const issue: ValidationIssue = {
                        checkName: check.checkName,
                        message: check.errorMessage,
                        severity: check.severity,
                        recordId: null,
                        recordName: null,
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
                }
            } catch (error) {
                results.errors.push({
                    checkName: check.checkName,
                    message: `Failed to execute integrity check: ${error}`,
                    severity: "error",
                    recordId: null,
                    recordName: null,
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
        return `target_${objectName.toLowerCase().replace('__c', '').replace('tc9_et__', '')}`;
    }

    // TODO: Replace with actual Salesforce connection implementation
    private async executeSoqlQuery(query: string): Promise<any[]> {
        // Placeholder implementation
        console.log(`Executing SOQL: ${query}`);
        return [];
    }

    // Clear cache for testing or reset
    public clearCache(): void {
        this.validationCache.clear();
    }
} 