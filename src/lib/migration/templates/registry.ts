import { templateRegistry } from "./core/template-registry";
import { interpretationRulesTemplate } from "./definitions/payroll/interpretation-rules.template";
import { payCodesTemplate } from "./definitions/payroll/pay-codes.template";
import { leaveRulesTemplate } from "./definitions/payroll/leave-rules.template";
import { calendarTemplate } from "./definitions/payroll/calendar.template";
// import { interpretationRulesTestTemplate } from "./definitions/payroll/interpretation-rules-test.template";

// Track whether templates have been registered to avoid redundant calls
let templatesAlreadyRegistered = false;

/**
 * Register all available migration templates
 */
export function registerAllTemplates(): void {
    // Check if templates are already loaded, but allow re-registration if registry is empty
    if (templatesAlreadyRegistered && templateRegistry.getTemplateCount() > 0) {
        return;
    }
    
    try {
        // Register payroll templates
        templateRegistry.registerTemplate(interpretationRulesTemplate);
        templateRegistry.registerTemplate(payCodesTemplate);
        templateRegistry.registerTemplate(leaveRulesTemplate);
        templateRegistry.registerTemplate(calendarTemplate);
        // templateRegistry.registerTemplate(interpretationRulesTestTemplate);
        
        templatesAlreadyRegistered = true;
        console.log(`Registered ${templateRegistry.getTemplateCount()} migration templates`);
        
        // Verify registration was successful
        if (templateRegistry.getTemplateCount() === 0) {
            console.error('Template registration failed - no templates in registry after registration');
            templatesAlreadyRegistered = false;
        }
    } catch (error) {
        console.error('Error during template registration:', error);
        templatesAlreadyRegistered = false;
        throw error;
    }
}

/**
 * Get all registered templates
 */
export function getAllTemplates() {
    return templateRegistry.getAllTemplates();
}

/**
 * Get template by ID
 */
export function getTemplate(id: string) {
    return templateRegistry.getTemplate(id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string) {
    return templateRegistry.getTemplatesByCategory(category);
}

/**
 * Search templates
 */
export function searchTemplates(searchTerm: string) {
    return templateRegistry.searchTemplates(searchTerm);
}

// Auto-register templates when module is imported
registerAllTemplates(); 