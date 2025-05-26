import { NextRequest, NextResponse } from 'next/server';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
import '@/lib/migration/templates/registry'; // Ensure templates are registered
import { prisma } from '@/lib/database/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Get templates from registry
    let templates = templateRegistry.getAllTemplates();

    // Filter by category if specified
    if (category) {
      templates = templates.filter(template => template.category === category);
    }

    // Enhance templates with metadata
    const enhancedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      version: template.version,
      metadata: template.metadata,
      stepCount: template.etlSteps.length,
      estimatedDuration: template.metadata.estimatedDuration,
      complexity: template.metadata.complexity
    }));

    return NextResponse.json({
      success: true,
      templates: enhancedTemplates,
      categories: ['payroll', 'time', 'custom']
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