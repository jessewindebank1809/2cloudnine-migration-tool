import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth } from '@/lib/auth/session-helper';
import { sessionManager } from '@/lib/salesforce/session-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const objectType = searchParams.get('objectType');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!objectType) {
      return NextResponse.json(
        { error: 'objectType parameter is required' },
        { status: 400 }
      );
    }

    // Get migration project and ensure it belongs to current user
    const project = await prisma.migration_projects.findFirst({
      where: { 
        id: projectId,
        user_id: session.user.id // Ensure project belongs to current user
      },
      include: {
        organisations_migration_projects_source_org_idToorganisations: true
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Migration project not found' },
        { status: 404 }
      );
    }

    const sourceOrg = project.organisations_migration_projects_source_org_idToorganisations;
    if (!sourceOrg) {
      return NextResponse.json(
        { error: 'Source organisation not found' },
        { status: 400 }
      );
    }

    // Get Salesforce client
    const client = await sessionManager.getClient(sourceOrg.id);

    // Build SOQL query to get records
    const query = `SELECT Id, Name, CreatedDate, LastModifiedDate 
                   FROM ${objectType} 
                   ORDER BY LastModifiedDate DESC 
                   LIMIT ${limit} OFFSET ${offset}`;

    const result = await client.query(query);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to query records', details: result.error },
        { status: 500 }
      );
    }

    // For now, return records without selection status
    // TODO: Implement record selection tracking once Prisma client is working
    const enhancedRecords = (result.data || []).map((record: any) => ({
      ...record,
      isSelected: false
    }));

    // Get total count
    const countQuery = `SELECT COUNT() FROM ${objectType}`;
    const countResult = await client.query(countQuery);
    const totalRecords = countResult.success ? countResult.totalSize || 0 : 0;

    return NextResponse.json({
      success: true,
      records: enhancedRecords,
      pagination: {
        total: totalRecords,
        limit,
        offset,
        hasMore: offset + limit < totalRecords
      },
      selectedCount: 0
    });

  } catch (error) {
    console.error('Error fetching records:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorised') {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch records', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const { id: projectId } = await params;
    const body = await request.json();
    const { objectType, recordIds, action = 'select' } = body;

    if (!objectType || !recordIds || !Array.isArray(recordIds)) {
      return NextResponse.json(
        { error: 'objectType and recordIds array are required' },
        { status: 400 }
      );
    }

    // Verify project exists and belongs to current user
    const project = await prisma.migration_projects.findFirst({
      where: { 
        id: projectId,
        user_id: session.user.id // Ensure project belongs to current user
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Migration project not found' },
        { status: 404 }
      );
    }

    // TODO: Implement record selection storage once Prisma client is working
    // For now, just return success
    return NextResponse.json({
      success: true,
      action,
      recordCount: recordIds.length,
      totalSelected: recordIds.length
    });

  } catch (error) {
    console.error('Error updating record selection:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorised') {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to update record selection', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 