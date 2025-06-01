import { templateRegistry } from "./core/template-registry";
import { interpretationRulesTemplate } from "./definitions/payroll/interpretation-rules.template";

// Track whether templates have been registered to avoid redundant calls
let templatesAlreadyRegistered = false;

/**
 * Register all available migration templates
 */
export function registerAllTemplates(): void {
    // Avoid redundant registration
    if (templatesAlreadyRegistered) {
        return;
    }
    
    // Register payroll templates
    templateRegistry.registerTemplate(interpretationRulesTemplate);
    
    templatesAlreadyRegistered = true;
    console.log(`Registered ${templateRegistry.getTemplateCount()} migration templates`);
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