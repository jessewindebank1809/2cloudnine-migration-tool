import { NextResponse } from 'next/server';
import { initializeApp } from '@/lib/startup';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initializeApp();
    return NextResponse.json({ 
      success: true, 
      message: 'Application initialized successfully' 
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to initialize application' 
    }, { status: 500 });
  }
}