import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { SalesforceClient } from '@/lib/salesforce/client';
import { ObjectDiscoveryEngine } from '@/lib/salesforce/object-discovery';
import { decrypt } from '@/lib/utils/encryption';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, includeStandard, includeCustom, objectPatterns } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Get organization from database
    const org = await prisma.organisations.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!org.access_token_encrypted) {
      return NextResponse.json(
        { error: 'Organization not connected' },
        { status: 401 }
      );
    }

    // Decrypt tokens
    const accessToken = decrypt(org.access_token_encrypted);
    const refreshToken = org.refresh_token_encrypted ? decrypt(org.refresh_token_encrypted) : undefined;

    // Create Salesforce client
    const client = new SalesforceClient({
      id: org.id,
      organizationId: org.salesforce_org_id || '',
      organizationName: org.name,
      instanceUrl: org.instance_url,
      accessToken,
      refreshToken,
    });

    // Create object discovery engine
    const discoveryEngine = new ObjectDiscoveryEngine(client);

    // Discover objects
    const objects = await discoveryEngine.discoverObjects({
      includeStandard,
      includeCustom,
      objectPatterns,
    });

    return NextResponse.json({ 
      success: true,
      objects,
      count: objects.length
    });
  } catch (error) {
    console.error('Object discovery error:', error);
    return NextResponse.json(
      { error: 'Failed to discover objects' },
      { status: 500 }
    );
  }
} 