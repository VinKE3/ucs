import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios, asistencias, ambientes, sedes, cursos } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dni = searchParams.get('dni')?.trim();

    if (!dni) {
      return NextResponse.json({ error: 'Debe ingresar un DNI' }, { status: 400 });
    }

    // Buscar usuario
    const foundUsers = await db
      .select({
        id: usuarios.id,
        dni: usuarios.dni,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        tipoPersonal: usuarios.tipoPersonal,
        activo: usuarios.activo,
      })
      .from(usuarios)
      .where(eq(usuarios.dni, dni))
      .limit(1);

    if (foundUsers.length === 0) {
      return NextResponse.json({ error: 'No se encontró ningún usuario con este DNI' }, { status: 404 });
    }

    const usuario = foundUsers[0];
    if (!usuario.activo) {
      return NextResponse.json({ error: 'El usuario se encuentra inactivo' }, { status: 403 });
    }

    // Verificar si tiene una asistencia activa ('en_curso')
    const asistenciasActivas = await db
      .select({
        id: asistencias.id,
        sedeId: asistencias.sedeId,
        ambienteId: asistencias.ambienteId,
        cursoId: asistencias.cursoId,
        horaIngreso: asistencias.horaIngreso,
        estado: asistencias.estado,
        sedeNombre: sedes.nombre,
        ambienteNombre: ambientes.nombre,
        ambienteCodigo: ambientes.codigo,
        cursoNombre: cursos.nombre,
      })
      .from(asistencias)
      .leftJoin(sedes, eq(asistencias.sedeId, sedes.id))
      .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
      .leftJoin(cursos, eq(asistencias.cursoId, cursos.id))
      .where(
        and(
          eq(asistencias.usuarioId, usuario.id),
          eq(asistencias.estado, 'en_curso')
        )
      )
      .limit(1);

    const asistenciaActiva = asistenciasActivas[0] || null;

    return NextResponse.json({
      usuario,
      asistenciaActiva,
    });
  } catch (error) {
    console.error('Error en /api/kiosco/lookup:', error);
    return NextResponse.json({ error: 'Error consultando usuario' }, { status: 500 });
  }
}
