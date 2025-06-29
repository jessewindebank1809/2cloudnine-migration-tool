import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/salesforce/session-manager';
import { ExternalIdUtils } from '@/lib/migration/templates/utils/external-id-utils';
import type { Connection } from 'jsforce';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceOrgId, breakpointId, payCodeId, payCodeExternalId } = body;

    if (!sourceOrgId || !breakpointId || (!payCodeId && !payCodeExternalId)) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Get source org client
    const sourceClient = await sessionManager.getClient(sourceOrgId);

    // If we have external ID but not the Salesforce ID, query for it
    let actualPayCodeId = payCodeId;
    if (!payCodeId && payCodeExternalId) {
      // Detect the external ID field for pay codes
      const externalIdField = await ExternalIdUtils.detectExternalIdField('tc9_pr__Pay_Code__c', sourceClient);
      
      const payCodeQuery = `SELECT Id FROM tc9_pr__Pay_Code__c WHERE ${externalIdField} = '${payCodeExternalId}' LIMIT 1`;
      const payCodeResult = await sourceClient.query(payCodeQuery);
      
      if (!payCodeResult.success || !payCodeResult.data || payCodeResult.data.length === 0) {
        return NextResponse.json(
          { error: `Pay code with external ID ${payCodeExternalId} not found` },
          { status: 404 }
        );
      }
      
      actualPayCodeId = payCodeResult.data[0].Id;
    }

    // Update the breakpoint with the pay code reference
    // Use the connection directly since SalesforceClient doesn't have an update method
    const connection = (sourceClient as { connection: Connection }).connection;
    const updateResult = await connection.sobject('tc9_et__Interpretation_Breakpoint__c').update({
      Id: breakpointId,
      tc9_et__Pay_Code__c: actualPayCodeId
    });

    if (!updateResult || !updateResult.success) {
      return NextResponse.json(
        { error: 'Failed to update breakpoint' },
        { status: 500 }
      );
    }

    // Query the updated breakpoint to get its details
    const externalIdField = await ExternalIdUtils.detectExternalIdField('tc9_pr__Pay_Code__c', sourceClient);
    const breakpointQuery = `SELECT Id, Name, tc9_et__Pay_Code__c, tc9_et__Pay_Code__r.Name, tc9_et__Pay_Code__r.${externalIdField} FROM tc9_et__Interpretation_Breakpoint__c WHERE Id = '${breakpointId}'`;
    const breakpointResult = await sourceClient.query(breakpointQuery);

    if (!breakpointResult.success || !breakpointResult.data || breakpointResult.data.length === 0) {
      return NextResponse.json(
        { success: true, recordId: breakpointId, message: 'Breakpoint updated successfully' }
      );
    }

    const updatedBreakpoint = breakpointResult.data[0];
    const payCodeName = updatedBreakpoint.tc9_et__Pay_Code__r?.Name || 'Unknown';

    return NextResponse.json({
      success: true,
      recordId: breakpointId,
      payCodeId: actualPayCodeId,
      payCodeName: payCodeName,
      message: `Breakpoint '${updatedBreakpoint.Name}' updated with pay code '${payCodeName}'`
    });

  } catch (error) {
    console.error('Error updating breakpoint pay code:', error);
    
    let errorMessage = 'Failed to update breakpoint';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}