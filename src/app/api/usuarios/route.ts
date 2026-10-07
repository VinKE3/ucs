import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios, asistencias, sedes, ambientes, castingPerfiles, castingRangosEdad } from '@/db/schema';
import { desc, eq, and, sql } from 'drizzle-orm';
import { getSession, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Consulta con LEFT JOIN para detectar en qué sede y sala se encuentra ahora mismo
    const [list, perfilesList] = await Promise.all([
      db
        .select({
          id: usuarios.id,
          dni: usuarios.dni,
          nombres: usuarios.nombres,
          apellidos: usuarios.apellidos,
          correo: usuarios.correo,
          telefono: usuarios.telefono,
          tipoPersonal: usuarios.tipoPersonal,
          rolSistema: usuarios.rolSistema,
          horasSemanalesMax: usuarios.horasSemanalesMax,
          tarifaHora: usuarios.tarifaHora,
          horaEntradaEsperada: usuarios.horaEntradaEsperada,
          horaSalidaEsperada: usuarios.horaSalidaEsperada,
          toleranciaMinutos: usuarios.toleranciaMinutos,
          activo: usuarios.activo,
          tienePassword: sql<boolean>`${usuarios.passwordHash} IS NOT NULL`,
          createdAt: usuarios.createdAt,
          // Datos de turno activo en vivo
          turnoActivoId: asistencias.id,
          horaIngreso: asistencias.horaIngreso,
          sedeActualId: sedes.id,
          sedeActualNombre: sedes.nombre,
          ambienteActualId: ambientes.id,
          ambienteActualNombre: ambientes.nombre,
          ambienteActualCodigo: ambientes.codigo,
        })
        .from(usuarios)
        .leftJoin(
          asistencias,
          and(
            eq(asistencias.usuarioId, usuarios.id),
            eq(asistencias.estado, 'en_curso')
          )
        )
        .leftJoin(sedes, eq(asistencias.sedeId, sedes.id))
        .leftJoin(ambientes, eq(asistencias.ambienteId, ambientes.id))
        .orderBy(desc(sql`${asistencias.id} IS NOT NULL`), usuarios.nombres),

      db
        .select({
          id: castingPerfiles.id,
          usuarioId: castingPerfiles.usuarioId,
          rangoEdadId: castingPerfiles.rangoEdadId,
          rangoEdadNombre: castingRangosEdad.nombre,
          rangoEdadColor: castingRangosEdad.color,
          edadReal: castingPerfiles.edadReal,
          genero: castingPerfiles.genero,
          biotipo: castingPerfiles.biotipo,
          especialidadesIds: castingPerfiles.especialidadesIds,
          restriccionesIds: castingPerfiles.restriccionesIds,
          experienciaNotas: castingPerfiles.experienciaNotas,
          disponibilidad: castingPerfiles.disponibilidad,
          contactoEmergencia: castingPerfiles.contactoEmergencia,
          activoCasting: castingPerfiles.activoCasting,
        })
        .from(castingPerfiles)
        .leftJoin(castingRangosEdad, eq(castingPerfiles.rangoEdadId, castingRangosEdad.id)),
    ]);

    const perfilesMap = new Map<number, any>();
    for (const p of perfilesList) {
      perfilesMap.set(p.usuarioId, p);
    }

    const sanitized = list.map((u) => ({
      ...u,
      tienePassword: Boolean(u.tienePassword),
      castingPerfil: perfilesMap.get(u.id) || null,
    }));

    return NextResponse.json({ usuarios: sanitized });
  } catch (error) {
    console.error('Error listando usuarios con presencia:', error);
    return NextResponse.json({ error: 'Error interno al consultar usuarios' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      dni,
      nombres,
      apellidos,
      correo,
      telefono,
      tipoPersonal,
      rolSistema,
      password,
      horasSemanalesMax,
      tarifaHora,
      horaEntradaEsperada,
      horaSalidaEsperada,
      toleranciaMinutos,
    } = body;

    if (!dni || !nombres || !apellidos || !tipoPersonal) {
      return NextResponse.json(
        { error: 'DNI, Nombres, Apellidos y Tipo de Personal son obligatorios' },
        { status: 400 }
      );
    }

    if (tipoPersonal === 'tecnico' && (!horaEntradaEsperada || !horaSalidaEsperada)) {
      return NextResponse.json(
        { error: 'Para el personal técnico es obligatorio definir la hora de entrada y salida programada' },
        { status: 400 }
      );
    }

    // Regla de permisos: Solo SUPER_ADMIN puede crear a otros ADMIN, SUPER_ADMIN o ADMINISTRATIVO
    if ((rolSistema === 'admin' || rolSistema === 'super_admin' || rolSistema === 'administrativo') && session.rolSistema !== 'super_admin') {
      return NextResponse.json(
        { error: 'Solo el Super Admin puede otorgar roles de sistema (Admin / Super Admin / Administrativo)' },
        { status: 403 }
      );
    }

    // Validar DNI duplicado
    const existing = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.dni, dni.trim())).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Ya existe un usuario con este DNI' }, { status: 400 });
    }

    let passwordHash: string | null = null;
    if (rolSistema === 'admin' || rolSistema === 'super_admin' || rolSistema === 'administrativo') {
      if (!password || password.trim().length < 6) {
        return NextResponse.json(
          { error: 'Para usuarios con acceso al sistema debe definir una contraseña de al menos 6 caracteres' },
          { status: 400 }
        );
      }
      passwordHash = await hashPassword(password.trim());
    }

    const [newUser] = await db
      .insert(usuarios)
      .values({
        dni: dni.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        correo: correo ? correo.trim().toLowerCase() : null,
        telefono: telefono ? telefono.trim() : null,
        tipoPersonal: tipoPersonal,
        rolSistema: rolSistema || 'ninguno',
        passwordHash: passwordHash,
        horasSemanalesMax: horasSemanalesMax ? Number(horasSemanalesMax) : null,
        tarifaHora: tarifaHora !== undefined && tarifaHora !== null && tarifaHora !== '' ? String(tarifaHora) : null,
        horaEntradaEsperada: horaEntradaEsperada ? String(horaEntradaEsperada).trim() : null,
        horaSalidaEsperada: horaSalidaEsperada ? String(horaSalidaEsperada).trim() : null,
        toleranciaMinutos: toleranciaMinutos ? Number(toleranciaMinutos) : 10,
        activo: true,
      })
      .returning({
        id: usuarios.id,
        dni: usuarios.dni,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        tipoPersonal: usuarios.tipoPersonal,
        rolSistema: usuarios.rolSistema,
        horasSemanalesMax: usuarios.horasSemanalesMax,
        tarifaHora: usuarios.tarifaHora,
        horaEntradaEsperada: usuarios.horaEntradaEsperada,
        horaSalidaEsperada: usuarios.horaSalidaEsperada,
        toleranciaMinutos: usuarios.toleranciaMinutos,
      });

    return NextResponse.json({ ok: true, usuario: newUser });
  } catch (error) {
    console.error('Error creando usuario:', error);
    return NextResponse.json({ error: 'Error interno al registrar usuario' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { id, dni, nombres, apellidos, correo, telefono, tipoPersonal, rolSistema, horasSemanalesMax, activo } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    const [usuarioActual] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, Number(id)))
      .limit(1);

    if (!usuarioActual) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (dni !== undefined) {
      const dniTrim = dni.trim();
      if (!dniTrim) {
        return NextResponse.json({ error: 'El DNI no puede estar vacío' }, { status: 400 });
      }
      if (dniTrim !== usuarioActual.dni) {
        const [existente] = await db
          .select({ id: usuarios.id })
          .from(usuarios)
          .where(eq(usuarios.dni, dniTrim))
          .limit(1);
        if (existente) {
          return NextResponse.json({ error: 'Ya existe otro usuario con este DNI' }, { status: 409 });
        }
        updateData.dni = dniTrim;
      }
    }

    if (nombres !== undefined) {
      if (!nombres.trim()) {
        return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
      }
      updateData.nombres = nombres.trim();
    }

    if (apellidos !== undefined) {
      if (!apellidos.trim()) {
        return NextResponse.json({ error: 'Los apellidos son obligatorios' }, { status: 400 });
      }
      updateData.apellidos = apellidos.trim();
    }

    if (correo !== undefined) {
      updateData.correo = correo ? correo.trim().toLowerCase() : null;
    }

    if (telefono !== undefined) {
      updateData.telefono = telefono ? telefono.trim() : null;
    }

    if (tipoPersonal !== undefined) {
      if (!['docente', 'tecnico', 'paciente_simulado', 'administrativo'].includes(tipoPersonal)) {
        return NextResponse.json({ error: 'Tipo de personal inválido' }, { status: 400 });
      }
      updateData.tipoPersonal = tipoPersonal;
    }

    if (rolSistema !== undefined && rolSistema !== usuarioActual.rolSistema) {
      if (session.rolSistema !== 'super_admin') {
        return NextResponse.json(
          { error: 'Solo el Super Admin puede modificar los roles de acceso al sistema' },
          { status: 403 }
        );
      }
      updateData.rolSistema = rolSistema;
    }

    if (horasSemanalesMax !== undefined) {
      updateData.horasSemanalesMax =
        horasSemanalesMax === null || horasSemanalesMax === ''
          ? null
          : Number(horasSemanalesMax);
    }

    if (body.tarifaHora !== undefined) {
      updateData.tarifaHora =
        body.tarifaHora === null || body.tarifaHora === ''
          ? null
          : String(body.tarifaHora);
    }

    if (body.horaEntradaEsperada !== undefined) {
      updateData.horaEntradaEsperada = body.horaEntradaEsperada ? String(body.horaEntradaEsperada).trim() : null;
    }

    if (body.horaSalidaEsperada !== undefined) {
      updateData.horaSalidaEsperada = body.horaSalidaEsperada ? String(body.horaSalidaEsperada).trim() : null;
    }

    if (body.toleranciaMinutos !== undefined) {
      updateData.toleranciaMinutos = body.toleranciaMinutos ? Number(body.toleranciaMinutos) : 10;
    }

    if (activo !== undefined) {
      updateData.activo = Boolean(activo);
    }

    const [updated] = await db
      .update(usuarios)
      .set(updateData)
      .where(eq(usuarios.id, Number(id)))
      .returning();

    return NextResponse.json({ ok: true, usuario: updated });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    return NextResponse.json({ error: 'Error interno al actualizar usuario' }, { status: 500 });
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
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    const userIdNum = Number(id);

    if (session.userId === userIdNum) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta de usuario' }, { status: 400 });
    }

    const [targetUser] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, userIdNum))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (targetUser.rolSistema === 'super_admin' && session.rolSistema !== 'super_admin') {
      return NextResponse.json({ error: 'No tienes permisos para eliminar a un Super Administrador' }, { status: 403 });
    }

    // 1. Verificar si tiene turno activo en curso
    const turnoEnCurso = await db
      .select({ id: asistencias.id })
      .from(asistencias)
      .where(and(eq(asistencias.usuarioId, userIdNum), eq(asistencias.estado, 'en_curso')))
      .limit(1);

    if (turnoEnCurso.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar a un colaborador con turno activo en curso. Finaliza o cierra su turno primero.' },
        { status: 400 }
      );
    }

    // 2. Verificar si tiene asistencias históricas registradas
    const [asistenciasCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(asistencias)
      .where(eq(asistencias.usuarioId, userIdNum));

    const totalAsistencias = asistenciasCount ? Number(asistenciasCount.count) : 0;

    if (totalAsistencias > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar a "${targetUser.nombres} ${targetUser.apellidos}" porque cuenta con ${totalAsistencias} registro(s) de asistencia histórica en la clínica. En su lugar, puedes inactivarlo (⏸️) para bloquear su acceso y evitar que marque en el kiosco sin perder la trazabilidad.`,
        },
        { status: 400 }
      );
    }

    await db.delete(usuarios).where(eq(usuarios.id, userIdNum));

    return NextResponse.json({ ok: true, mensaje: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    return NextResponse.json({ error: 'Error interno al eliminar usuario' }, { status: 500 });
  }
}
