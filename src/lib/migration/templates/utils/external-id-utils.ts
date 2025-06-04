import { ExternalIdConfig, EnvironmentExternalIdInfo, ExternalIdValidationResult, ExternalIdIssue } from "../core/interfaces";

export class ExternalIdUtils {
    private static readonly MANAGED_FIELD = "tc9_edc__External_ID_Data_Creation__c";
    private static readonly UNMANAGED_FIELD = "External_ID_Data_Creation__c";
    private static readonly FALLBACK_FIELD = "External_Id__c";
    private static readonly PACKAGE_NAMESPACE = "tc9_edc";

    /**
     * Auto-detect the appropriate external ID field based on org configuration
     */
    static async detectExternalIdField(
        objectApiName: string,
        orgConnection: any, // TODO: Replace with proper Salesforce connection type
    ): Promise<string> {
        try {
            // Check if managed field exists
            if (await this.fieldExists(objectApiName, this.MANAGED_FIELD, orgConnection)) {
                return this.MANAGED_FIELD;
            }

            // Check if unmanaged field exists
            if (await this.fieldExists(objectApiName, this.UNMANAGED_FIELD, orgConnection)) {
                return this.UNMANAGED_FIELD;
            }

            // Fall back to standard field
            if (await this.fieldExists(objectApiName, this.FALLBACK_FIELD, orgConnection)) {
                return this.FALLBACK_FIELD;
            }

            throw new Error(`No external ID field found for object ${objectApiName}`);
        } catch (error) {
            console.warn(`Failed to detect external ID field for ${objectApiName}:`, error);
            // Default to managed field when detection fails (most common case)
            return this.MANAGED_FIELD;
        }
    }

    /**
     * Get external ID field based on strategy
     */
    static getExternalIdField(config: ExternalIdConfig, detectedField?: string): string {
        switch (config.strategy) {
            case "manual":
                return config.sourceField || config.targetField || config.fallbackField;
            case "cross-environment":
                return config.sourceField || config.fallbackField;
            case "auto-detect":
                return detectedField || config.fallbackField;
            default:
                return config.fallbackField;
        }
    }

    /**
     * Replace external ID field placeholders in SOQL queries
     */
    static replaceExternalIdPlaceholders(
        query: string,
        externalIdField: string,
    ): string {
        return query.replace(/{externalIdField}/g, externalIdField);
    }

    /**
     * Create default external ID configuration
     */
    static createDefaultConfig(): ExternalIdConfig {
        return {
            sourceField: this.MANAGED_FIELD, // Default to managed field
            targetField: this.MANAGED_FIELD, // Default to managed field
            managedField: this.MANAGED_FIELD,
            unmanagedField: this.UNMANAGED_FIELD,
            fallbackField: this.FALLBACK_FIELD,
            strategy: "auto-detect",
        };
    }

    /**
     * Validate external ID configuration
     */
    static validateConfig(config: ExternalIdConfig): string[] {
        const errors: string[] = [];

        if (!config.managedField) {
            errors.push("Managed field is required");
        }

        if (!config.unmanagedField) {
            errors.push("Unmanaged field is required");
        }

        if (!config.fallbackField) {
            errors.push("Fallback field is required");
        }

        if (!["auto-detect", "managed", "unmanaged"].includes(config.strategy)) {
            errors.push("Invalid strategy. Must be 'auto-detect', 'managed', or 'unmanaged'");
        }

        return errors;
    }

    /**
     * Check if a field exists on an object
     */
    private static async fieldExists(
        objectApiName: string,
        fieldApiName: string,
        orgConnection: any,
    ): Promise<boolean> {
        try {
            console.log(`Checking if field ${fieldApiName} exists on ${objectApiName}`);
            
            // Use a simple SOQL query to check if the field exists
            // This is more reliable than metadata API calls for field existence
            const testQuery = `SELECT ${fieldApiName} FROM ${objectApiName} LIMIT 1`;
            const result = await orgConnection.query(testQuery);
            
            // If query succeeds, field exists
            return result.success;
        } catch (error) {
            console.log(`Field ${fieldApiName} does not exist on ${objectApiName}: ${error}`);
            return false;
        }
    }

    /**
     * Get all possible external ID field names for an object
     */
    static getAllPossibleExternalIdFields(): string[] {
        return [
            this.MANAGED_FIELD,
            this.UNMANAGED_FIELD,
            this.FALLBACK_FIELD,
        ];
    }

    /**
     * Determine if org uses managed package based on field detection
     */
    static async isManagedPackageOrg(
        testObjectApiName: string,
        orgConnection: any,
    ): Promise<boolean> {
        try {
            return await this.isManagedPackageInstalled(orgConnection);
        } catch (error) {
            console.warn("Failed to determine package type:", error);
            return false;
        }
    }

    /**
     * Build field mapping with correct external ID field
     */
    static buildFieldMapping(
        sourceField: string,
        targetField: string,
        externalIdField: string,
    ): { sourceField: string; targetField: string } {
        return {
            sourceField: this.replaceExternalIdPlaceholders(sourceField, externalIdField),
            targetField: this.replaceExternalIdPlaceholders(targetField, externalIdField),
        };
    }

    /**
     * Check if the tc9_edc managed package is installed in the org
     */
    static async isManagedPackageInstalled(
        orgConnection: any,
    ): Promise<boolean> {
        try {
            console.log(`🔍 Checking if managed package '${this.PACKAGE_NAMESPACE}' is installed...`);
            
            // Use ApexClass query to detect managed package
            const packageQuery = `SELECT Id, NamespacePrefix FROM ApexClass WHERE NamespacePrefix = '${this.PACKAGE_NAMESPACE}' LIMIT 1`;
            const result = await orgConnection.query(packageQuery);
            
            // Handle both legacy mock format and real Salesforce API response format
            const records = result.records || result.data || [];
            const isInstalled = Boolean(result.success !== false && records && records.length > 0);
            console.log(`   Package '${this.PACKAGE_NAMESPACE}': ${isInstalled ? '✅ INSTALLED' : '❌ NOT INSTALLED'}`);
            
            return isInstalled;
        } catch (error) {
            console.log(`   Package detection failed: ${error}`);
            return false;
        }
    }

    /**
     * Detect external ID field information for a specific environment
     */
    static async detectEnvironmentExternalIdInfo(
        objectApiName: string,
        orgConnection: any,
    ): Promise<EnvironmentExternalIdInfo> {
        try {
            console.log(`🔍 Detecting external ID fields for ${objectApiName}...`);
            
            // Step 1: Check if managed package is installed
            const isManagedPackageInstalled = await this.isManagedPackageInstalled(orgConnection);
            
            if (isManagedPackageInstalled) {
                // Package is installed, use managed field
                console.log(`   📦 Managed package detected - using managed field: ${this.MANAGED_FIELD}`);
                
                return {
                    packageType: "managed",
                    externalIdField: this.MANAGED_FIELD,
                    detectedFields: [this.MANAGED_FIELD],
                    fallbackUsed: false,
                };
            }
            
            // Step 2: Package not installed, check for unmanaged field
            console.log(`   📦 No managed package - checking for unmanaged field: ${this.UNMANAGED_FIELD}`);
            const unmanagedFieldExists = await this.fieldExists(objectApiName, this.UNMANAGED_FIELD, orgConnection);
            console.log(`   Unmanaged field (${this.UNMANAGED_FIELD}): ${unmanagedFieldExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
            
            if (unmanagedFieldExists) {
                return {
                    packageType: "unmanaged",
                    externalIdField: this.UNMANAGED_FIELD,
                    detectedFields: [this.UNMANAGED_FIELD],
                    fallbackUsed: false,
                };
            }
            
            // Step 3: Check for fallback field
            console.log(`   📦 No unmanaged field - checking for fallback field: ${this.FALLBACK_FIELD}`);
            const fallbackFieldExists = await this.fieldExists(objectApiName, this.FALLBACK_FIELD, orgConnection);
            console.log(`   Fallback field (${this.FALLBACK_FIELD}): ${fallbackFieldExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
            
            if (fallbackFieldExists) {
                return {
                    packageType: "unmanaged", // Still unmanaged, just using fallback
                    externalIdField: this.FALLBACK_FIELD,
                    detectedFields: [this.FALLBACK_FIELD],
                    fallbackUsed: true,
                };
            }
            
            // Step 4: No fields found - this shouldn't happen but return managed as default
            console.log(`   ⚠️  No external ID fields found - defaulting to managed`);
            return {
                packageType: "managed",
                externalIdField: this.MANAGED_FIELD,
                detectedFields: [],
                fallbackUsed: true,
            };
            
        } catch (error) {
            console.warn(`💥 Failed to detect external ID info for ${objectApiName}:`, error);
            return {
                packageType: "managed", // Default assumption
                externalIdField: this.MANAGED_FIELD,
                detectedFields: [this.MANAGED_FIELD],
                fallbackUsed: true,
            };
        }
    }

    /**
     * Create cross-environment external ID configuration
     */
    static async detectCrossEnvironmentMapping(
        sourceInfo: EnvironmentExternalIdInfo,
        targetInfo: EnvironmentExternalIdInfo,
    ): Promise<ExternalIdConfig> {
        const crossEnvironmentDetected = sourceInfo.packageType !== targetInfo.packageType;

        return {
            sourceField: sourceInfo.externalIdField,
            targetField: targetInfo.externalIdField,
            managedField: this.MANAGED_FIELD,
            unmanagedField: this.UNMANAGED_FIELD,
            fallbackField: this.FALLBACK_FIELD,
            strategy: crossEnvironmentDetected ? "cross-environment" : "auto-detect",
            crossEnvironmentMapping: crossEnvironmentDetected ? {
                sourcePackageType: sourceInfo.packageType,
                targetPackageType: targetInfo.packageType,
            } : undefined,
        };
    }

    /**
     * Validate cross-environment compatibility
     */
    static validateCrossEnvironmentCompatibility(
        sourceInfo: EnvironmentExternalIdInfo,
        targetInfo: EnvironmentExternalIdInfo,
    ): ExternalIdValidationResult {
        const crossEnvironmentDetected = sourceInfo.packageType !== targetInfo.packageType;
        const potentialIssues: ExternalIdIssue[] = [];
        const recommendations: string[] = [];

        // Check for missing external ID fields
        if (sourceInfo.fallbackUsed) {
            potentialIssues.push({
                severity: "warning",
                message: `Source environment is using fallback external ID field: ${sourceInfo.externalIdField}`,
                affectedObjects: ["All objects"],
                suggestedAction: "Verify that external ID values are properly populated in source org",
            });
        }

        if (targetInfo.fallbackUsed) {
            potentialIssues.push({
                severity: "warning",
                message: `Target environment is using fallback external ID field: ${targetInfo.externalIdField}`,
                affectedObjects: ["All objects"],
                suggestedAction: "Verify that target org has proper external ID field configuration",
            });
        }

        // Cross-environment specific checks
        if (crossEnvironmentDetected) {
            potentialIssues.push({
                severity: "info",
                message: `Cross-environment migration detected: ${sourceInfo.packageType} → ${targetInfo.packageType}`,
                affectedObjects: ["All objects"],
                suggestedAction: "Ensure external ID values are properly mapped between environments",
            });

            recommendations.push(
                `Source external ID field: ${sourceInfo.externalIdField}`,
                `Target external ID field: ${targetInfo.externalIdField}`,
                "Verify that all related objects have been migrated with consistent external IDs",
            );
        }

        // Check for no detected fields
        if (sourceInfo.detectedFields.length === 0) {
            potentialIssues.push({
                severity: "error",
                message: "No external ID fields detected in source environment",
                affectedObjects: ["All objects"],
                suggestedAction: "Ensure source org has proper external ID field configuration",
            });
        }

        if (targetInfo.detectedFields.length === 0) {
            potentialIssues.push({
                severity: "error",
                message: "No external ID fields detected in target environment",
                affectedObjects: ["All objects"],
                suggestedAction: "Ensure target org has proper external ID field configuration",
            });
        }

        return {
            sourceEnvironment: sourceInfo,
            targetEnvironment: targetInfo,
            crossEnvironmentDetected,
            potentialIssues,
            recommendations,
        };
    }

    /**
     * Build cross-environment SOQL query with the specified external ID field
     */
    static buildCrossEnvironmentQuery(
        baseQuery: string,
        sourceExternalIdField: string,
        targetExternalIdField?: string,
    ): string {
        // Simply replace all {externalIdField} placeholders with the source external ID field
        // We don't need to add all possible external ID fields - we should use the detected one
        return this.replaceExternalIdPlaceholders(baseQuery, sourceExternalIdField);
    }

    /**
     * Extract external ID value from record with fallback logic
     */
    static extractExternalIdValue(
        record: any,
        relationshipName: string,
        preferredField: string,
    ): string | null {
        if (!record[relationshipName]) {
            return null;
        }

        const relatedRecord = record[relationshipName];

        // Try preferred field first
        if (relatedRecord[preferredField]) {
            return relatedRecord[preferredField];
        }

        // Try all possible external ID fields as fallback
        const possibleFields = [this.MANAGED_FIELD, this.UNMANAGED_FIELD, this.FALLBACK_FIELD];
        for (const field of possibleFields) {
            if (relatedRecord[field]) {
                return relatedRecord[field];
            }
        }

        return null;
    }
} 