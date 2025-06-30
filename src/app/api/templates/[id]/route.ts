import { NextRequest, NextResponse } from 'next/server';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
import { registerAllTemplates } from '@/lib/migration/templates/registry';

// Force dynamic rendering with caching optimization  
export const dynamic = 'force-dynamic';
// Using Node.js runtime to support complex template imports
// export const runtime = 'edge'; // Edge runtime has issues with large module imports
export const revalidate = 3600; // Cache templates for 1 hour as they don't change frequently

// Ensure templates are registered once
let templatesRegistered = false;
function ensureTemplatesRegistered() {
  if (!templatesRegistered) {
    registerAllTemplates();
    templatesRegistered = true;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Ensure templates are registered (only once)
    ensureTemplatesRegistered();

    // Get template from registry
    const template = templateRegistry.getTemplate(id);
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        version: template.version,
        metadata: template.metadata,
        etlSteps: template.etlSteps.map(step => ({
          stepName: step.stepName,
          stepOrder: step.stepOrder,
          objectApiName: step.extractConfig.objectApiName,
          description: `Extract and transform ${step.extractConfig.objectApiName} records`,
          dependencies: step.dependencies || []
        })),
        stepCount: template.etlSteps.length,
        estimatedDuration: template.metadata.estimatedDuration,
        complexity: template.metadata.complexity,
        requiredPermissions: template.metadata.requiredPermissions
      }
    });

  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch template', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 