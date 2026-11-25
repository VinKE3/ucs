import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { desc, eq, and, or, ilike } from 'drizzle-orm';
import { requireAdminSession } from '@/lib/apiSecurity';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await requireAdminSession(['super_admin', 'admin']);
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const modulo = searchParams.get('modulo')?.trim();
    const q = searchParams.get('q')?.trim();
    const limitParam = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Math.min(200, Math.max(10, isNaN(limitParam) ? 100 : limitParam));

    const conditions = [];

    if (modulo && modulo !== 'todos') {
      conditions.push(eq(auditLogs.modulo, modulo));
    }

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(auditLogs.actorNombre, pattern),
          ilike(auditLogs.resumen, pattern),
          ilike(auditLogs.accion, pattern),
          ilike(auditLogs.entidadId, pattern)
        )
      );
    }

    const rows = await db
      .select()
      .from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return NextResponse.json(
      {
        success: true,
        total: rows.length,
        logs: rows,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error en GET /api/admin/audit-logs:', error);
    return NextResponse.json(
      { success: false, error: 'Error al consultar la bitácora de auditoría.' },
      { status: 500 }
    );
  }
}
