import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({
      status: 'pending_config',
      message: 'Falta configurar DATABASE_URL en el archivo .env.local',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const result = await db.execute(sql`SELECT 1 as connected`);
    return NextResponse.json({
      status: 'connected',
      message: 'Conexión exitosa a Neon PostgreSQL',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido al conectar con Neon';
    return NextResponse.json(
      {
        status: 'error',
        message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
