import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-check';
import { prisma } from '@/lib/database/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check admin access
    await requireAdmin(request);
    
    // Get all users with their migration statistics
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        _count: {
          select: {
            migration_projects: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    // Get migration statistics for each user
    const userStats = await Promise.all(
      users.map(async (user) => {
        const sessions = await prisma.migration_sessions.findMany({
          where: {
            migration_projects: {
              user_id: user.id
            }
          },
          select: {
            status: true,
            failed_records: true
          }
        });
        
        const totalMigrations = sessions.length;
        const successfulMigrations = sessions.filter(
          s => s.status === 'COMPLETED' && (s.failed_records === 0 || s.failed_records === null)
        ).length;
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          lastActive: null,
          migrationCount: totalMigrations,
          successRate: totalMigrations > 0 
            ? Math.round((successfulMigrations / totalMigrations) * 100)
            : 0
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      users: userStats
    });
    
  } catch (error) {
    console.error('Error fetching user list:', error);
    
    if ((error as Error).message === 'Admin access required') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch user list' },
      { status: 500 }
    );
  }
}