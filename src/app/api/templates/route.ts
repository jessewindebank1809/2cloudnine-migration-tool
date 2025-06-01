import { NextRequest, NextResponse } from 'next/server';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
import { registerAllTemplates } from '@/lib/migration/templates/registry';

// Force dynamic rendering with caching optimization  
export const dynamic = 'force-dynamic';
// Use edge runtime for better performance since no database access needed
export const runtime = 'edge';
export const revalidate = 3600; // Cache templates for 1 hour as they don't change frequently

export async function GET(request: NextRequest) {
  try {
    // Ensure templates are registered (registry now handles redundancy checking)
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