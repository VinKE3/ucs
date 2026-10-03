import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sedes, ambientes, usuarios, asistencias } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const [sedesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sedes)
      .where(eq(sedes.activo, true));

    const [ambientesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ambientes)
      .where(eq(ambientes.activo, true));

    const [usuariosCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usuarios)
      .where(eq(usuarios.activo, true));

    const [asistenciasActivas] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(asistencias)
      .where(eq(asistencias.estado, 'en_curso'));

    return NextResponse.json({
      sedes: sedesCount?.count || 0,
      ambientes: ambientesCount?.count || 0,
      usuarios: usuariosCount?.count || 0,
      enCurso: asistenciasActivas?.count || 0,
    });
  } catch (error) {
    console.error('Error en /api/dashboard/stats:', error);
    return NextResponse.json({ error: 'Error cargando estadísticas' }, { status: 500 });
  }
}
