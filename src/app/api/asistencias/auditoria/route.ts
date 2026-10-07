import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditoriaAsistencias, usuarios } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const asistenciaId = searchParams.get('asistenciaId');

    if (!asistenciaId) {
      return NextResponse.json({ error: 'Falta el parámetro asistenciaId' }, { status: 400 });
    }

    const records = await db
      .select({
        id: auditoriaAsistencias.id,
        asistenciaId: auditoriaAsistencias.asistenciaId,
        usuarioAdminId: auditoriaAsistencias.usuarioAdminId,
        accion: auditoriaAsistencias.accion,
        motivo: auditoriaAsistencias.motivo,
        datosAnteriores: auditoriaAsistencias.datosAnteriores,
        datosNuevos: auditoriaAsistencias.datosNuevos,
        createdAt: auditoriaAsistencias.createdAt,
        adminNombres: usuarios.nombres,
        adminApellidos: usuarios.apellidos,
        adminDni: usuarios.dni,
        adminCorreo: usuarios.correo,
      })
      .from(auditoriaAsistencias)
      .leftJoin(usuarios, eq(auditoriaAsistencias.usuarioAdminId, usuarios.id))
      .where(eq(auditoriaAsistencias.asistenciaId, Number(asistenciaId)))
      .orderBy(desc(auditoriaAsistencias.createdAt));

    return NextResponse.json({ auditorias: records });
  } catch (error) {
    console.error('Error obteniendo auditoría de asistencia:', error);
    return NextResponse.json({ error: 'Error interno al consultar auditoría' }, { status: 500 });
  }
}
