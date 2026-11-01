import { parseJsonBody, perfilCastingSchema } from '@/lib/validations';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { castingPerfiles, castingRangosEdad, usuarios } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/casting/perfiles - Obtener perfil o perfiles de casting
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get('usuarioId');

    if (usuarioId) {
      const [perfil] = await db
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
        .leftJoin(castingRangosEdad, eq(castingPerfiles.rangoEdadId, castingRangosEdad.id))
        .where(eq(castingPerfiles.usuarioId, Number(usuarioId)))
        .limit(1);

      return NextResponse.json({ perfil: perfil || null });
    }

    // Listar todos los perfiles de casting
    const perfiles = await db
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
      .leftJoin(castingRangosEdad, eq(castingPerfiles.rangoEdadId, castingRangosEdad.id));

    return NextResponse.json({ perfiles });
  } catch (error) {
    console.error('Error obteniendo perfiles de casting:', error);
    return NextResponse.json({ error: 'Error al consultar perfiles' }, { status: 500 });
  }
}

// PUT /api/casting/perfiles - Upsert (crear o actualizar) perfil de casting de un actor
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin' && session.rolSistema !== 'administrativo')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsed = await parseJsonBody(request, perfilCastingSchema);
    if (!parsed.success) {
      return parsed.response;
    }

    const { usuarioId: numUsuarioId, ...resto } = parsed.data;
    const now = new Date();

    const [usuarioExistente] = await db
      .select({ id: usuarios.id, tipoPersonal: usuarios.tipoPersonal })
      .from(usuarios)
      .where(eq(usuarios.id, numUsuarioId))
      .limit(1);

    if (!usuarioExistente) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const payload = {
      ...resto,
      updatedAt: now,
    };

    const [perfilExistente] = await db
      .select({ id: castingPerfiles.id })
      .from(castingPerfiles)
      .where(eq(castingPerfiles.usuarioId, numUsuarioId))
      .limit(1);

    let perfilGuardado;
    if (perfilExistente) {
      [perfilGuardado] = await db
        .update(castingPerfiles)
        .set(payload)
        .where(eq(castingPerfiles.usuarioId, numUsuarioId))
        .returning();
    } else {
      [perfilGuardado] = await db
        .insert(castingPerfiles)
        .values({
          usuarioId: numUsuarioId,
          ...payload,
        })
        .returning();
    }

    return NextResponse.json({ ok: true, perfil: perfilGuardado });
  } catch (error) {
    console.error('Error guardando perfil de casting:', error);
    return NextResponse.json({ error: 'Error al guardar perfil de casting' }, { status: 500 });
  }
}
