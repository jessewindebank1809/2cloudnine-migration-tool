import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { TokenManager } from '@/lib/salesforce/token-manager';

export async function GET(_request: NextRequest) {
  try {
    const tokenManager = TokenManager.getInstance();
    const healthReport = await tokenManager.getTokenHealthReport();
    
    // Get additional org details for unhealthy orgs
    const unhealthyOrgIds = healthReport.details.map(d => d.orgId);
    const orgDetails = await prisma.organisations.findMany({
      where: { id: { in: unhealthyOrgIds } },
      select: {
        id: true,
        name: true,
        salesforce_org_id: true,
        org_type: true,
        instance_url: true,
        updated_at: true,
        token_expires_at: true
      }
    });
    
    // Merge org details with health status
    const detailedReport = {
      ...healthReport,
      details: healthReport.details.map(health => {
        const org = orgDetails.find(o => o.id === health.orgId);
        return {
          ...health,
          orgDetails: org || null
        };
      })
    };
    
    return NextResponse.json({
      success: true,
      data: detailedReport,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting token health:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get token health status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}