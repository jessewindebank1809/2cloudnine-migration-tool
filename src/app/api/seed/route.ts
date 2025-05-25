import { NextResponse } from 'next/server';
import { seedData } from '@/lib/seed-data';

export async function POST() {
  try {
    // Use a default userId for seeding - this endpoint is typically for development only
    const defaultUserId = 'seed-user-id';
    await seedData(defaultUserId);
    return NextResponse.json({ message: 'Seed data created successfully' });
  } catch (error) {
    console.error('Error seeding data:', error);
    return NextResponse.json(
      { error: 'Failed to seed data' },
      { status: 500 }
    );
  }
} 