import { NextResponse } from 'next/server';
import { db } from '@/db';
import { ambientes, sedes, asistencias, usuarios } from '@/db/schema';
import { eq, and, like, or } from 'drizzle-orm';
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
          horaIngreso: asistencias.horaIngreso,
          usuarioId: usuarios.id,
          nombres: usuarios.nombres,
          apellidos: usuarios.apellidos,
          tipoPersonal: usuarios.tipoPersonal,
          dni: usuarios.dni,
        })
        .from(asistencias)
        .innerJoin(usuarios, eq(asistencias.usuarioId, usuarios.id))
        .where(
          and(
            eq(asistencias.sedeId, Number(sedeId)),
            eq(asistencias.estado, 'en_curso')
          )
        );
    }

    const ocupantesActivos = activeAsistencias.filter((a) => a.ambienteId !== null);
    const tecnicosEnTurno = activeAsistencias.filter((a) => a.ambienteId === null && a.tipoPersonal === 'tecnico');

    // Asociar a cada ambiente sus doctores y pacientes simulados
    const ambientesConOcupantes = list.map((amb) => {
      const ocupantesDeSala = ocupantesActivos.filter((o) => o.ambienteId === amb.id);
      return {
        ...amb,
        ocupada: ocupantesDeSala.length > 0,
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
