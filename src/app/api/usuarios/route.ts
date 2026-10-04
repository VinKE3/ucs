import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios, asistencias, sedes, ambientes } from '@/db/schema';
import { desc, eq, and, sql } from 'drizzle-orm';
import { getSession, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Consulta con LEFT JOIN para detectar en qué sede y sala se encuentra ahora mismo
    const list = await db
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
      .orderBy(desc(sql`${asistencias.id} IS NOT NULL`), usuarios.nombres);

    const sanitized = list.map((u) => ({
      ...u,
      tienePassword: Boolean(u.tienePassword),
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
    const { dni, nombres, apellidos, correo, telefono, tipoPersonal, rolSistema, password, horasSemanalesMax } = body;

    if (!dni || !nombres || !apellidos || !tipoPersonal) {
      return NextResponse.json(
        { error: 'DNI, Nombres, Apellidos y Tipo de Personal son obligatorios' },
        { status: 400 }
      );
    }

    // Regla de permisos: Solo SUPER_ADMIN puede crear a otros ADMIN o SUPER_ADMIN
    if ((rolSistema === 'admin' || rolSistema === 'super_admin') && session.rolSistema !== 'super_admin') {
      return NextResponse.json(
        { error: 'Solo el Super Admin puede otorgar roles de sistema (Admin / Super Admin)' },
        { status: 403 }
      );
    }

    // Validar DNI duplicado
    const existing = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.dni, dni.trim())).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Ya existe un usuario con este DNI' }, { status: 400 });
    }

    let passwordHash: string | null = null;
    if (rolSistema === 'admin' || rolSistema === 'super_admin') {
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
    const { id, horasSemanalesMax, activo } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (horasSemanalesMax !== undefined) {
      updateData.horasSemanalesMax = horasSemanalesMax === null || horasSemanalesMax === '' 
        ? null 
        : Number(horasSemanalesMax);
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
