import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        status: 'pending_config',
        message: 'Base de datos no configurada',
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    await db.execute(sql`SELECT 1 as connected`);
    const latencyMs = Date.now() - startedAt;
    return NextResponse.json(
      {
        status: 'ok',
        db: 'connected',
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    console.error('Health check DB error:', error);
    return NextResponse.json(
      {
        status: 'error',
        db: 'disconnected',
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
