import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth } from '@/lib/auth/session-helper';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Get session using unified auth helper
    const session = await requireAuth(request);

    const organisations = await prisma.organisations.findMany({
      where: {
        user_id: session.user.id,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return NextResponse.json({ organisations });
  } catch (error) {
    console.error('Failed to fetch organisations:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch organisations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get session using unified auth helper
    const session = await requireAuth(request);
    console.log('Creating organisation for user:', session.user.id, session.user.email);

    const body = await request.json();
    const { name, orgType, instanceUrl } = body;

    // Validate required fields
    if (!name || !orgType || !instanceUrl) {
      return NextResponse.json(
        { error: 'Name, org type, and instance URL are required' },
        { status: 400 }
      );
    }

    // For scratch orgs, use the provided instanceUrl
    // For production/sandbox, generate standard URLs
    let finalInstanceUrl = instanceUrl;
    if (orgType === 'PRODUCTION') {
      // Remove any trailing slash and ensure it's a proper production URL
      finalInstanceUrl = instanceUrl.replace(/\/$/, '');
    } else if (orgType === 'SANDBOX') {
      // Ensure it's a proper sandbox URL
      finalInstanceUrl = instanceUrl.replace(/\/$/, '');
    }

    const organisation = await prisma.organisations.create({
      data: {
        id: crypto.randomUUID(),
        name,
        org_type: orgType,
        instance_url: finalInstanceUrl,
        user_id: session.user.id,
        salesforce_org_id: null, // Will be populated when we connect via OAuth
        updated_at: new Date(),
      },
    });

    // Return the organisation ID so the frontend can initiate OAuth for this specific org
    return NextResponse.json({ 
      organisation,
      nextStep: 'oauth',
      oauthUrl: `/api/auth/oauth2/salesforce?orgId=${encodeURIComponent(organisation.id)}&instanceUrl=${encodeURIComponent(finalInstanceUrl)}`
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create organisation:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to create organisation' },
      { status: 500 }
    );
  }
} 