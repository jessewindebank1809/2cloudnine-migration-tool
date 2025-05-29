import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth } from '@/lib/auth/session-helper';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { RollbackService } from '@/lib/migration/rollback-service';
import type { SalesforceOrg } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication and get current user
    const session = await requireAuth(request);
    
    const migrationId = params.id;

    // Get migration project and ensure it belongs to current user
    const migration = await prisma.migration_projects.findFirst({
      where: { 
        id: migrationId,
        user_id: session.user.id // Ensure project belongs to current user
      },
      include: {
        organisations_migration_projects_target_org_idToorganisations: true,
        migration_sessions: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            migration_records: {
              where: { status: 'SUCCESS' }
            }
          }
        }
      }
    });

    if (!migration) {
      return NextResponse.json(
        { error: 'Migration not found' },
        { status: 404 }
      );
    }

    const targetOrg = migration.organisations_migration_projects_target_org_idToorganisations;
    if (!targetOrg) {
      return NextResponse.json(
        { error: 'Target organisation not found' },
        { status: 400 }
      );
    }

    const latestSession = migration.migration_sessions[0];
    if (!latestSession) {
      return NextResponse.json(
        { error: 'No migration session found' },
        { status: 404 }
      );
    }

    const successfulRecords = latestSession.migration_records;
    if (successfulRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No records to rollback',
        deletedRecords: 0,
        failedDeletions: 0
      });
    }

    // Get authenticated client for target org
    const targetClient = await sessionManager.getClient(targetOrg.id);

    // Create rollback records from successful migration records
    const rollbackRecords = successfulRecords
      .filter(record => record.target_record_id)
      .map(record => ({
        targetRecordId: record.target_record_id!,
        objectType: record.object_type,
        stepName: 'manual-rollback'
      }));

    if (rollbackRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No target record IDs found to rollback',
        deletedRecords: 0,
        failedDeletions: 0
      });
    }

    // Create rollback service and perform rollback
    const rollbackService = new RollbackService({
      id: targetOrg.id,
      name: targetOrg.name,
      instanceUrl: targetOrg.instance_url,
      accessToken: targetClient.accessToken || '',
      refreshToken: targetClient.refreshToken || '',
      organizationId: targetOrg.salesforce_org_id || '',
      organizationName: targetOrg.name
    } as SalesforceOrg);

    const rollbackResult = await rollbackService.rollbackRecords(rollbackRecords);

    // Update migration records status for successfully deleted records
    if (rollbackResult.deletedRecords > 0) {
      const deletedRecordIds = rollbackRecords
        .slice(0, rollbackResult.deletedRecords)
        .map(r => r.targetRecordId);

      await prisma.migration_records.updateMany({
        where: {
          session_id: latestSession.id,
          target_record_id: { in: deletedRecordIds }
        },
        data: {
          status: 'SKIPPED', // Mark as skipped to indicate rollback
          error_message: 'Record deleted during rollback'
        }
      });
    }

    // Update session status if all records were rolled back
    if (rollbackResult.deletedRecords === successfulRecords.length) {
      await prisma.migration_sessions.update({
        where: { id: latestSession.id },
        data: {
          status: 'CANCELLED',
          successful_records: 0,
          processed_records: latestSession.failed_records
        }
      });

      // Update project status
      await prisma.migration_projects.update({
        where: { id: migrationId },
        data: {
          status: 'FAILED',
          updated_at: new Date()
        }
      });
    }

    return NextResponse.json({
      success: rollbackResult.success,
      message: rollbackResult.success 
        ? `Successfully rolled back ${rollbackResult.deletedRecords} records`
        : `Partial rollback: ${rollbackResult.deletedRecords} deleted, ${rollbackResult.failedDeletions} failed`,
      deletedRecords: rollbackResult.deletedRecords,
      failedDeletions: rollbackResult.failedDeletions,
      errors: rollbackResult.errors,
      sessionId: latestSession.id
    });

  } catch (error) {
    console.error('Rollback error:', error);
    
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to perform rollback',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 