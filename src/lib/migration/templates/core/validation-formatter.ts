import { ValidationIssue } from './interfaces';

export class ValidationFormatter {
    private static readonly ERROR_TITLES: Record<string, string> = {
        // Connection errors
        orgConnectivity: "Organisation Connection Error",
        
        // Dependency checks
        payCodeExists: "Missing Pay Code Reference",
        interpretationRuleExists: "Missing Interpretation Rule",
        leaveHeaderExists: "Missing Leave Header",
        leaveRuleExists: "Missing Leave Rule",
        overtimePayCodeExists: "Missing Overtime Pay Code",
        dailyPayCodeCapRecordExists: "Missing Daily Pay Code Cap",
        frequencyPayCodeCapRecordExists: "Missing Frequency Pay Code Cap",
        
        // External ID validations
        sourcePayCodeExternalIdValidation: "Pay Codes Missing External IDs",
        sourceCasualLoadingPayCodeExternalIdValidation: "Casual Loading Pay Codes Missing External IDs",
        sourceLeaveLoadingPayCodeExternalIdValidation: "Leave Loading Pay Codes Missing External IDs",
        sourceOvertimePayCodeExternalIdValidation: "Overtime Pay Codes Missing External IDs",
        sourcePenaltyLoadingPayCodeExternalIdValidation: "Penalty Loading Pay Codes Missing External IDs",
        sourcePublicHolidayPayCodeExternalIdValidation: "Public Holiday Pay Codes Missing External IDs",
        sourceSaturdayPayCodeExternalIdValidation: "Saturday Pay Codes Missing External IDs",
        sourceSundayPayCodeExternalIdValidation: "Sunday Pay Codes Missing External IDs",
        sourceLeaveRuleExternalIdValidation: "Leave Rules Missing External IDs",
        sourceLeaveHeaderExternalIdValidation: "Leave Headers Missing External IDs",
        
        // Data integrity checks
        leaveBreakpointIntegrity: "Leave Breakpoint Missing Required Fields",
        payCodeExternalIdConsistency: "Pay Code External ID Inconsistency",
        recordTypeMappingCoverage: "Unmapped Record Types",
        
        // Picklist validations
        picklistValidation_tc9_et__Status__c: "Invalid Status Values",
        picklistValidation_tc9_et__Variation_Type__c: "Invalid Variation Type Values",
        picklistValidation_tc9_et__Timesheet_Frequency__c: "Invalid Timesheet Frequency Values",
    };

    /**
     * Formats a validation issue with improved user-friendly messaging
     */
    public static formatValidationIssue(
        issue: ValidationIssue,
        sourceOrgId: string,
        instanceUrl?: string
    ): ValidationIssue {
        // Generate user-friendly title
        const friendlyTitle = this.ERROR_TITLES[issue.checkName] || this.generateFriendlyTitle(issue.checkName);
        
        // Format the message based on the check type
        const formattedIssue: ValidationIssue = {
            ...issue,
            checkName: friendlyTitle,
            message: this.formatMessage(issue, instanceUrl),
            // Add record link if we have instance URL and record ID
            recordLink: issue.recordId && instanceUrl ? `${instanceUrl}/${issue.recordId}` : undefined,
            // Remove suggestedAction from the formatted issue
            suggestedAction: undefined,
        };
        
        return formattedIssue;
    }
    
    /**
     * Formats the error message to be more user-friendly
     */
    private static formatMessage(issue: ValidationIssue, instanceUrl?: string): string {
        const originalCheckName = issue.checkName;
        const friendlyTitle = this.ERROR_TITLES[originalCheckName] || this.generateFriendlyTitle(originalCheckName);
        
        // Handle dependency errors with context
        if (issue.context && issue.context.targetObject) {
            const { missingTargetName, missingTargetExternalId, targetObject } = issue.context;
            
            // Determine the object type name from the API name
            let objectTypeName = 'Record';
            if (targetObject === 'tc9_pr__Pay_Code__c') {
                objectTypeName = 'Pay Code';
            } else if (targetObject === 'tc9_pr__Leave_Rule__c') {
                objectTypeName = 'Leave Rule';
            } else if (targetObject === 'tc9_et__Interpretation_Rule__c') {
                objectTypeName = 'Interpretation Rule';
            } else if (targetObject === 'tc9_et__Interpretation_Breakpoint__c') {
                objectTypeName = 'Breakpoint';
            }
            
            // Determine the source object type
            let sourceObjectType = 'Record';
            if (issue.context.sourceRecordType) {
                sourceObjectType = issue.context.sourceRecordType;
            } else if (issue.recordName && issue.recordName.includes('Breakpoint')) {
                sourceObjectType = 'Breakpoint';
            } else if (issue.recordName && issue.recordName.includes('Rule')) {
                sourceObjectType = 'Rule';
            }
            
            if (missingTargetName && missingTargetExternalId) {
                return `${objectTypeName} (name: ${missingTargetName}, external id: ${missingTargetExternalId}) is missing from target org referenced by ${sourceObjectType} (name: '${issue.recordName}')`;
            } else if (missingTargetExternalId) {
                return `${objectTypeName} (external id: ${missingTargetExternalId}) is missing from target org referenced by ${sourceObjectType} (name: '${issue.recordName}')`;
            } else {
                // Fallback to original format
                const ref = issue.message.match(/'([^']+)'/)?.[1] || "null";
                return `${objectTypeName} '${ref}' referenced by '${issue.recordName}' doesn't exist in target org.`;
            }
        }
        
        // Legacy format for dependency errors without context
        if (originalCheckName === 'payCodeExists' && issue.recordName) {
            const payCodeRef = issue.message.match(/'([^']+)'/)?.[1] || "null";
            return `Pay Code '${payCodeRef}' referenced by '${issue.recordName}' doesn't exist in target org.`;
        }
        
        // If we have specific record information, show it
        if (issue.recordId && issue.recordName) {
            return `${issue.recordName} (${issue.recordId})`;
        } else if (issue.recordId) {
            const objectType = this.getObjectTypeFromCheckName(originalCheckName);
            return `${objectType} ${issue.recordId}`;
        }
        
        // Handle external ID validation errors without specific record info
        if (originalCheckName.includes('ExternalIdValidation')) {
            // Fallback to count-based message if no specific record info
            const match = issue.message.match(/Found (\d+) records?/i) || issue.message.match(/\(Found (\d+) records?\)/i);
            const count = match ? match[1] : '1';
            
            if (originalCheckName === 'sourcePayCodeExternalIdValidation') {
                return `${count} pay code${count !== '1' ? 's' : ''} missing external IDs.`;
            } else if (originalCheckName === 'sourceLeaveRuleExternalIdValidation') {
                return `${count} leave rule${count !== '1' ? 's' : ''} missing external IDs.`;
            }
            // Generic external ID message
            return `${count} record${count !== '1' ? 's' : ''} missing external IDs.`;
        }
        
        // Handle picklist validation errors
        if (originalCheckName.includes('picklistValidation')) {
            const invalidValues = this.extractInvalidValues(issue.message);
            const validValues = this.extractValidValues(issue.message);
            return `Invalid value '${invalidValues}'. Valid options: ${validValues}`;
        }
        
        // Make other messages more concise
        if (issue.message.length > 100) {
            // Extract key information and make it concise
            const simplified = issue.message
                .replace(/Migration cannot proceed: /gi, '')
                .replace(/All referenced .+ must .+ first/gi, '')
                .replace(/\. All .+$/gi, '.');
            return simplified;
        }
        
        // Default to original message
        return issue.message;
    }
    
    /**
     * Generates suggested actions based on the issue type
     */
    private static getSuggestedAction(issue: ValidationIssue): string {
        const originalCheckName = issue.checkName;
        
        // Dependency check errors
        if (originalCheckName === 'payCodeExists') {
            return "Migrate the missing pay code first or update the reference.";
        }
        
        // External ID errors
        if (originalCheckName.includes('ExternalIdValidation')) {
            return "Populate external IDs before migration.";
        }
        
        // Connection errors
        if (originalCheckName === 'orgConnectivity') {
            return "Reconnect to the organisation.";
        }
        
        // Picklist errors
        if (originalCheckName.includes('picklistValidation')) {
            return "Add missing picklist value in target org.";
        }
        
        // Check formatted title for clues
        const friendlyTitle = this.ERROR_TITLES[originalCheckName] || '';
        if (friendlyTitle.includes("Missing") && friendlyTitle.includes("Reference")) {
            return "Ensure the referenced record exists in the target org.";
        }
        
        if (friendlyTitle.includes("External ID")) {
            return "Populate the External ID field (tc9_edc__External_ID_Data_Creation__c) for all records before migration.";
        }
        
        if (issue.checkName.includes("Invalid") && issue.checkName.includes("Values")) {
            return "Update the field value to one of the accepted values or add the value to the target org's picklist.";
        }
        
        if (issue.checkName.includes("Missing Required Fields")) {
            return "Populate all required fields before migration.";
        }
        
        return issue.suggestedAction || "Review and fix the data issue before proceeding with migration.";
    }
    
    /**
     * Generates a friendly title from a check name
     */
    private static generateFriendlyTitle(checkName: string): string {
        // Convert camelCase to Title Case
        return checkName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }
    
    /**
     * Extracts the object type from an error message
     */
    private static extractObjectType(checkName: string): string {
        const objectTypes: Record<string, string> = {
            "Pay Code": "Pay Code",
            "Leave Rule": "Leave Rule",
            "Leave Header": "Leave Header",
            "Interpretation Rule": "Interpretation Rule",
            "Overtime": "Overtime Pay Code",
            "Casual Loading": "Casual Loading Pay Code",
            "Penalty": "Penalty Pay Code",
            "Public Holiday": "Public Holiday Pay Code",
            "Saturday": "Saturday Pay Code",
            "Sunday": "Sunday Pay Code",
        };
        
        for (const [key, value] of Object.entries(objectTypes)) {
            if (checkName.includes(key)) {
                return value;
            }
        }
        
        return "record";
    }
    
    /**
     * Gets object type from check name for external ID validations
     */
    private static getObjectTypeFromCheckName(checkName: string): string {
        const mappings: Record<string, string> = {
            'sourcePayCodeExternalIdValidation': 'Pay Code',
            'sourceLeaveRuleExternalIdValidation': 'Leave Rule',
            'sourceLeaveHeaderExternalIdValidation': 'Leave Header',
            'sourceCasualLoadingPayCodeExternalIdValidation': 'Casual Loading Pay Code',
            'sourceOvertimePayCodeExternalIdValidation': 'Overtime Pay Code',
        };
        
        return mappings[checkName] || 'Record';
    }
    
    /**
     * Extracts record count from error message
     */
    private static extractRecordCount(message: string): string {
        const match = message.match(/Found (\d+) record/);
        return match ? match[1] : "multiple";
    }
    
    /**
     * Extracts invalid values from picklist error message
     */
    private static extractInvalidValues(message: string): string {
        const match = message.match(/Invalid picklist values found[^:]*: ([^.]+)/);
        return match ? match[1].trim() : "unknown value";
    }
    
    /**
     * Extracts valid values from picklist error message
     */
    private static extractValidValues(message: string): string {
        const match = message.match(/Valid values are: (.+)$/);
        return match ? match[1].trim() : "check target org configuration";
    }
    
    /**
     * Groups similar errors together for better presentation
     */
    public static groupValidationIssues(issues: ValidationIssue[]): Map<string, ValidationIssue[]> {
        const grouped = new Map<string, ValidationIssue[]>();
        
        for (const issue of issues) {
            const key = issue.checkName;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key)!.push(issue);
        }
        
        return grouped;
    }
    
    /**
     * Creates a summary message for grouped issues
     */
    public static createGroupSummary(groupName: string, issues: ValidationIssue[]): string {
        const recordCount = issues.length;
        const recordsWithLinks = issues.filter(i => i.recordId).length;
        
        let summary = `${groupName} (${recordCount} issue${recordCount !== 1 ? 's' : ''})`;
        
        if (recordsWithLinks > 0) {
            summary += ` - ${recordsWithLinks} record${recordsWithLinks !== 1 ? 's' : ''} to review`;
        }
        
        return summary;
    }
}