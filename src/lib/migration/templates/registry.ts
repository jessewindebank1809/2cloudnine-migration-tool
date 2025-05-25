import { templateRegistry } from "./core/template-registry";
import { interpretationRulesTemplate } from "./definitions/payroll/interpretation-rules.template";

/**
 * Register all available migration templates
 */
export function registerAllTemplates(): void {
    // Register payroll templates
    templateRegistry.registerTemplate(interpretationRulesTemplate);
    
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