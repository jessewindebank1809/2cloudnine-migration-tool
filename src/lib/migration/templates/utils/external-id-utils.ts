import { ExternalIdConfig } from "../core/interfaces";

export class ExternalIdUtils {
    private static readonly MANAGED_FIELD = "tc9_edc__External_ID_Data_Creation__c";
    private static readonly UNMANAGED_FIELD = "External_ID_Data_Creation__c";
    private static readonly FALLBACK_FIELD = "External_Id__c";

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
            return this.FALLBACK_FIELD; // Default fallback
        }
    }

    /**
     * Get external ID field based on strategy
     */
    static getExternalIdField(config: ExternalIdConfig, detectedField?: string): string {
        switch (config.strategy) {
            case "managed":
                return config.managedField;
            case "unmanaged":
                return config.unmanagedField;
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
            // TODO: Replace with actual Salesforce metadata API call
            // This would typically use the Salesforce REST API or JSForce
            // to describe the object and check if the field exists
            
            // Placeholder implementation
            console.log(`Checking if field ${fieldApiName} exists on ${objectApiName}`);
            
            // For now, assume managed fields exist in managed package orgs
            // and unmanaged fields exist in unmanaged orgs
            if (fieldApiName.includes("tc9_edc__")) {
                // Simulate managed package detection
                return Math.random() > 0.5; // 50% chance for demo
            }
            
            return true; // Assume other fields exist
        } catch (error) {
            console.error(`Error checking field existence:`, error);
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
            return await this.fieldExists(
                testObjectApiName,
                this.MANAGED_FIELD,
                orgConnection,
            );
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
} 