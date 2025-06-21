import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { SalesforceClient } from '@/lib/salesforce/client';
import { ObjectDiscoveryEngine } from '@/lib/salesforce/object-discovery';
import { decrypt } from '@/lib/utils/encryption';
import { templateRegistry } from '@/lib/migration/templates/core/template-registry';
import { ETLStep } from '@/lib/migration/templates/core/interfaces';
import '@/lib/migration/templates/registry'; // Ensure templates are registered

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, includeStandard, includeCustom, objectPatterns, templateId } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organisation ID is required' },
        { status: 400 }
      );
    }

    // Get organisation from database
    const org = await prisma.organisations.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 404 }
      );
    }

    if (!org.access_token_encrypted) {
      return NextResponse.json(
        { error: 'Organisation not connected' },
        { status: 401 }
      );
    }

    // Decrypt tokens
    let accessToken: string;
    try {
      accessToken = decrypt(org.access_token_encrypted);
    } catch (decryptError) {
      console.error('Failed to decrypt access token for org:', org.id, decryptError);
      return NextResponse.json(
        { error: 'Organisation access token is invalid. Please reconnect the organisation.' },
        { status: 401 }
      );
    }
    let refreshToken: string | undefined;
    try {
      refreshToken = org.refresh_token_encrypted ? decrypt(org.refresh_token_encrypted) : undefined;
    } catch (decryptError) {
      console.error('Failed to decrypt refresh token for org:', org.id, decryptError);
      // Continue without refresh token - access token might still work
      refreshToken = undefined;
    }

    // Create Salesforce client
    const client = new SalesforceClient({
      id: org.id,
      organisationId: org.salesforce_org_id || '',
      organisationName: org.name,
      instanceUrl: org.instance_url,
      accessToken,
      refreshToken,
    });

    // Create object discovery engine
    const discoveryEngine = new ObjectDiscoveryEngine(client);

    // Discover objects with automatic token refresh retry
    let objects;
    try {
      objects = await discoveryEngine.discoverObjects({
        includeStandard,
        includeCustom,
        objectPatterns,
      });
    } catch (error) {
      // If token expired, try to refresh and retry once
      if (error instanceof Error && (
        error.message.includes('Authentication token has expired') ||
        error.message.includes('expired access/refresh token') ||
        error.message.includes('Connection failed: expired access/refresh token')
             )) {
         console.log('Token expired, attempting automatic refresh and retry...');
         
         // Attempt token refresh directly
         const refreshResult = await client.refreshAccessToken();
         if (refreshResult.success) {
           console.log('Token refresh successful, retrying object discovery...');
           // Retry the discovery after successful token refresh
           objects = await discoveryEngine.discoverObjects({
             includeStandard,
             includeCustom,
             objectPatterns,
           });
         } else {
           console.error('Token refresh failed:', refreshResult.error);
           // Token refresh failed, throw a more descriptive error
           throw new Error(refreshResult.error || 'Authentication token has expired. Please reconnect the organisation.');
         }
      } else {
        // Not a token error, re-throw
        throw error;
      }
    }

    // Filter objects based on template if templateId is provided
    if (templateId) {
      console.log('Filtering objects for templateId:', templateId);
      const template = templateRegistry.getTemplate(templateId);
      console.log('Found template:', template ? template.name : 'NOT FOUND');
      
      if (template) {
        // For object selection, only show the primary object from the first ETL step
        // This avoids showing all related objects (like breakpoints) that are dependencies
        const templateObjects = new Set<string>();
        
        // Only use the first ETL step's object as the primary object for selection
        const primaryStep = template.etlSteps[0];
        if (primaryStep?.extractConfig?.objectApiName) {
          console.log('Adding primary object from first step:', primaryStep.extractConfig.objectApiName);
          templateObjects.add(primaryStep.extractConfig.objectApiName);
        }

        console.log('Template objects to filter for:', Array.from(templateObjects));
        console.log('Total objects before filtering:', objects.length);
        
        // Debug: Show some actual object names to compare
        const interpretationObjects = objects.filter(obj => 
          obj.name.toLowerCase().includes('interpretation') || 
          obj.name.toLowerCase().includes('rule')
        );
        console.log('Found interpretation-related objects:', interpretationObjects.map(obj => obj.name));
        
        // Filter objects to only include those used by the template
        // Also try case-insensitive matching in case of naming differences
        const templateObjectsLower = new Set(Array.from(templateObjects).map(name => name.toLowerCase()));
        objects = objects.filter(obj => 
          templateObjects.has(obj.name) || templateObjectsLower.has(obj.name.toLowerCase())
        );
        
        console.log('Total objects after filtering:', objects.length);
        console.log('Filtered objects:', objects.map(obj => obj.name));
      } else {
        console.log('Template not found in registry. Available templates:', templateRegistry.getTemplateIds());
      }
    } else {
      console.log('No templateId provided, returning all objects');
    }

    return NextResponse.json({ 
      success: true,
      objects,
      count: objects.length
    });
  } catch (error) {
    console.error('Object discovery error:', error);
    
    // Check if it's a token-related error
    if (error instanceof Error && (
      error.message.includes('invalid_grant') || 
      error.message.includes('expired') ||
      error.message.includes('INVALID_SESSION_ID') ||
      error.message.includes('Authentication token has expired') ||
      error.message.includes('expired access/refresh token') ||
      error.message.includes('Connection failed: expired access/refresh token')
    )) {
      return NextResponse.json(
        { 
          error: 'Authentication token has expired. Please reconnect the organisation.',
          code: 'TOKEN_EXPIRED'
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to discover objects' },
      { status: 500 }
    );
  }
} 