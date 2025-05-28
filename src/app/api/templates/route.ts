import { NextRequest, NextResponse } from 'next/server';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
import { registerAllTemplates } from '@/lib/migration/templates/registry';
import { prisma } from '@/lib/database/prisma';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Ensure templates are registered
    registerAllTemplates();
    
    // Get all available templates from the registry
    const templates = templateRegistry.getAllTemplates();
    
    return NextResponse.json({
      success: true,
      templates: templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        version: template.version,
        metadata: template.metadata,
        objectTypes: template.etlSteps.map(step => step.extractConfig?.objectApiName).filter(Boolean),
        stepCount: template.etlSteps.length
      }))
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch templates', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 