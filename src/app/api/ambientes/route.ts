import { NextResponse } from 'next/server';
import { db } from '@/db';
import { ambientes, sedes, asistencias, usuarios, cursos } from '@/db/schema';
import { eq, and, like, or, sql } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sedeId = searchParams.get('sedeId');
    const tipo = searchParams.get('tipo');
    const q = searchParams.get('q')?.trim();

    let query = db
      .select({
        id: ambientes.id,
        sedeId: ambientes.sedeId,
        nombre: ambientes.nombre,
        codigo: ambientes.codigo,
        tipo: ambientes.tipo,
        capacidad: ambientes.capacidad,
        activo: ambientes.activo,
        createdAt: ambientes.createdAt,
        sedeNombre: sedes.nombre,
      })
      .from(ambientes)
      .leftJoin(sedes, eq(ambientes.sedeId, sedes.id))
      .$dynamic();

    const conditions = [];

    if (sedeId) {
      conditions.push(eq(ambientes.sedeId, Number(sedeId)));
    }

    if (tipo && tipo !== 'todos') {
      conditions.push(eq(ambientes.tipo, tipo));
    }

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          like(ambientes.nombre, pattern),
          like(ambientes.codigo, pattern)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const list = await query.orderBy(ambientes.nombre);

    // Obtener ocupantes activos (en curso) de las salas en esta sede
    let activeAsistencias: {
      asistenciaId: number;
      ambienteId: number | null;
      cursoId: number | null;
      cursoNombre: string | null;
      horaIngreso: Date;
      usuarioId: number;
      nombres: string;
      apellidos: string;
      tipoPersonal: 'docente' | 'tecnico' | 'paciente_simulado';
      dni: string;
    }[] = [];

    if (sedeId) {
      activeAsistencias = await db
        .select({
          asistenciaId: asistencias.id,
          ambienteId: asistencias.ambienteId,
          cursoId: asistencias.cursoId,
          cursoNombre: cursos.nombre,
          horaIngreso: asistencias.horaIngreso,
          usuarioId: usuarios.id,
          nombres: usuarios.nombres,
          apellidos: usuarios.apellidos,
          tipoPersonal: usuarios.tipoPersonal,
          dni: usuarios.dni,
        })
        .from(asistencias)
        .innerJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
        .leftJoin(cursos, eq(asistencias.cursoId, cursos.id))
        .where(
          and(
            eq(asistencias.sedeId, Number(sedeId)),
            eq(asistencias.estado, 'en_curso')
          )
        );
    }

    const ocupantesActivos = activeAsistencias.filter((a) => a.ambienteId !== null);
    const tecnicosEnTurno = activeAsistencias.filter((a) => a.ambienteId === null && a.tipoPersonal === 'tecnico');

    // Asociar a cada ambiente sus doctores, pacientes simulados y el curso en desarrollo
    const ambientesConOcupantes = list.map((amb) => {
      const ocupantesDeSala = ocupantesActivos.filter((o) => o.ambienteId === amb.id);
      const cursoActivo = ocupantesDeSala.find((o) => o.cursoNombre)?.cursoNombre || null;

      return {
        ...amb,
        ocupada: ocupantesDeSala.length > 0,
        cursoActivo,
        docentes: ocupantesDeSala.filter((o) => o.tipoPersonal === 'docente'),
        pacientesSimulados: ocupantesDeSala.filter((o) => o.tipoPersonal === 'paciente_simulado'),
        otrosOcupantes: ocupantesDeSala.filter(
          (o) => o.tipoPersonal !== 'docente' && o.tipoPersonal !== 'paciente_simulado'
        ),
      };
    });

    return NextResponse.json({
      ambientes: ambientesConOcupantes,
      tecnicosEnTurno,
    });
  } catch (error) {
    console.error('Error listando ambientes con ocupantes:', error);
    return NextResponse.json({ error: 'Error al consultar ambientes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { sedeId, nombre, codigo, tipo, capacidad } = body;

    if (!sedeId || !nombre || !nombre.trim()) {
      return NextResponse.json(
        { error: 'La sede y el nombre de la sala son obligatorios' },
        { status: 400 }
      );
    }

    const [nuevoAmbiente] = await db
      .insert(ambientes)
      .values({
        sedeId: Number(sedeId),
        nombre: nombre.trim(),
        codigo: codigo ? codigo.trim() : null,
        tipo: tipo || 'general',
        capacidad: capacidad ? Number(capacidad) : 10,
        activo: true,
      })
      .returning();

    return NextResponse.json({ ok: true, ambiente: nuevoAmbiente });
  } catch (error) {
    console.error('Error creando ambiente:', error);
    return NextResponse.json({ error: 'Error interno al registrar ambiente' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, nombre, codigo, tipo, capacidad, activo } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de ambiente requerido' }, { status: 400 });
    }

    const updateData: Partial<typeof ambientes.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (nombre !== undefined) {
      if (!nombre || !nombre.trim()) {
        return NextResponse.json({ error: 'El nombre de la sala no puede estar vacío' }, { status: 400 });
      }
      updateData.nombre = nombre.trim();
    }

    if (codigo !== undefined) {
      updateData.codigo = codigo ? codigo.trim() : null;
    }

    if (tipo !== undefined) {
      updateData.tipo = tipo || 'general';
    }

    if (capacidad !== undefined) {
      updateData.capacidad = capacidad ? Number(capacidad) : 10;
    }

    if (activo !== undefined) {
      updateData.activo = Boolean(activo);
    }

    const [ambienteActualizado] = await db
      .update(ambientes)
      .set(updateData)
      .where(eq(ambientes.id, Number(id)))
      .returning();

    if (!ambienteActualizado) {
      return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ambiente: ambienteActualizado });
  } catch (error) {
    console.error('Error actualizando ambiente:', error);
    return NextResponse.json({ error: 'Error interno al actualizar ambiente' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de ambiente requerido' }, { status: 400 });
    }

    const ambienteIdNum = Number(id);

    // 1. Verificar si hay un turno activo en curso en esta sala
    const turnosEnCurso = await db
      .select({ id: asistencias.id })
      .from(asistencias)
      .where(and(eq(asistencias.ambienteId, ambienteIdNum), eq(asistencias.estado, 'en_curso')))
      .limit(1);

    if (turnosEnCurso.length > 0) {
      return NextResponse.json(
        {
          error: 'No se puede eliminar la sala porque tiene un turno activo en curso en este momento. Finaliza el turno primero o inhabilita la sala.',
        },
        { status: 400 }
      );
    }

    // 2. Verificar si tiene asistencias históricas vinculadas
    const [asistenciasCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(asistencias)
      .where(eq(asistencias.ambienteId, ambienteIdNum));

    if (asistenciasCount && Number(asistenciasCount.count) > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar esta sala porque tiene ${asistenciasCount.count} registro(s) de asistencia histórica asociados. En su lugar, puedes ponerla en Mantenimiento / Inactiva para que no aparezca en el kiosco.`,
        },
        { status: 400 }
      );
    }

    const [ambienteEliminado] = await db
      .delete(ambientes)
      .where(eq(ambientes.id, ambienteIdNum))
      .returning();

    if (!ambienteEliminado) {
      return NextResponse.json({ error: 'Sala no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, mensaje: 'Sala eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando ambiente:', error);
    return NextResponse.json({ error: 'Error interno al eliminar ambiente' }, { status: 500 });
  }
}
