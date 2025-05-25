import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { requireAuth } from '@/lib/auth/session-helper';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await requireAuth(request);
    const { id } = params;

    // Check if organisation exists and belongs to user
    const organisation = await prisma.organisations.findFirst({
      where: { 
        id,
        user_id: session.user.id
      },
      include: {
        migration_projects_migration_projects_source_org_idToorganisations: true,
        migration_projects_migration_projects_target_org_idToorganisations: true,
      },
    });

    if (!organisation) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 404 }
      );
    }

    // Check if organisation is being used in any migration projects
    const totalProjects = organisation.migration_projects_migration_projects_source_org_idToorganisations.length + 
                          organisation.migration_projects_migration_projects_target_org_idToorganisations.length;
    if (totalProjects > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete organisation. It is being used in ${totalProjects} migration project(s).`,
          projectCount: totalProjects
        },
        { status: 409 }
      );
    }

    // Delete the organisation
    await prisma.organisations.delete({
      where: { id },
    });

    return NextResponse.json({ 
      success: true,
      message: 'Organisation deleted successfully' 
    });
  } catch (error) {
    console.error('Failed to delete organisation:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete organisation' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await requireAuth(request);
    const { id } = params;
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if organisation exists and belongs to user
    const organisation = await prisma.organisations.findFirst({
      where: { 
        id,
        user_id: session.user.id
      },
    });

    if (!organisation) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 404 }
      );
    }

    // Update the organisation name
    const updatedOrganisation = await prisma.organisations.update({
      where: { id },
      data: { 
        name: name.trim(),
        updated_at: new Date()
      },
    });

    return NextResponse.json({ 
      success: true,
      organisation: updatedOrganisation 
    });
  } catch (error) {
    console.error('Failed to update organisation:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update organisation' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const session = await requireAuth(request);
    const { id } = params;

    const organisation = await prisma.organisations.findFirst({
      where: { 
        id,
        user_id: session.user.id
      },
      include: {
        migration_projects_migration_projects_source_org_idToorganisations: {
          select: { id: true, name: true },
        },
        migration_projects_migration_projects_target_org_idToorganisations: {
          select: { id: true, name: true },
        },
      },
    });

    if (!organisation) {
      return NextResponse.json(
        { error: 'Organisation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ organisation });
  } catch (error) {
    console.error('Failed to fetch organisation:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch organisation' },
      { status: 500 }
    );
  }
} 