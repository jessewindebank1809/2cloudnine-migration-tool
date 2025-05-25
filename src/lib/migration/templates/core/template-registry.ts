import { MigrationTemplate } from "./interfaces";

export class TemplateRegistry {
    private templates: Map<string, MigrationTemplate> = new Map();

    registerTemplate(template: MigrationTemplate): void {
        this.templates.set(template.id, template);
    }

    getTemplate(id: string): MigrationTemplate | undefined {
        return this.templates.get(id);
    }

    getAllTemplates(): MigrationTemplate[] {
        return Array.from(this.templates.values());
    }

    getTemplatesByCategory(category: string): MigrationTemplate[] {
        return Array.from(this.templates.values())
            .filter((template) => template.category === category);
    }

    getTemplateIds(): string[] {
        return Array.from(this.templates.keys());
    }

    hasTemplate(id: string): boolean {
        return this.templates.has(id);
    }

    removeTemplate(id: string): boolean {
        return this.templates.delete(id);
    }

    getTemplateCount(): number {
        return this.templates.size;
    }

    getTemplatesByComplexity(complexity: "simple" | "moderate" | "complex"): MigrationTemplate[] {
        return Array.from(this.templates.values())
            .filter((template) => template.metadata.complexity === complexity);
    }

    searchTemplates(searchTerm: string): MigrationTemplate[] {
        const term = searchTerm.toLowerCase();
        return Array.from(this.templates.values())
            .filter((template) => 
                template.name.toLowerCase().includes(term) ||
                template.description.toLowerCase().includes(term)
            );
    }

    validateTemplate(template: MigrationTemplate): string[] {
        const errors: string[] = [];

        if (!template.id) {
            errors.push("Template ID is required");
        }

        if (!template.name) {
            errors.push("Template name is required");
        }

        if (!template.etlSteps || template.etlSteps.length === 0) {
            errors.push("Template must have at least one ETL step");
        }

        if (!template.executionOrder || template.executionOrder.length === 0) {
            errors.push("Template must define execution order");
        }

        // Validate execution order matches step names
        if (template.etlSteps && template.executionOrder) {
            const stepNames = template.etlSteps.map(step => step.stepName);
            const missingSteps = template.executionOrder.filter(
                stepName => !stepNames.includes(stepName)
            );
            
            if (missingSteps.length > 0) {
                errors.push(`Execution order references missing steps: ${missingSteps.join(", ")}`);
            }
        }

        return errors;
    }

    clear(): void {
        this.templates.clear();
    }
}

// Singleton instance
export const templateRegistry = new TemplateRegistry(); 