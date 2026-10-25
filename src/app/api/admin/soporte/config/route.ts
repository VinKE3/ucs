import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { configuracionSistema, categoriasIncidencia, terminalesSala, sedes, ambientes } from '@/db/schema';
import { eq, asc, desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET: Obtener configuración global, categorías y terminales
export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // 1. Configuraciones
    const configs = await db.select().from(configuracionSistema);
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.clave] = c.valor;
    }

    // Valores por defecto seguros si aún no existen
    if (!configMap['pin_maestro_salas']) configMap['pin_maestro_salas'] = '2026';
    if (!configMap['modo_tecnicos']) configMap['modo_tecnicos'] = 'global';
    if (!configMap['sonido_alerta_habilitado']) configMap['sonido_alerta_habilitado'] = 'true';

    // 2. Categorías de Incidencia / Botones de Sala
    const categorias = await db
      .select()
      .from(categoriasIncidencia)
      .orderBy(asc(categoriasIncidencia.orden), asc(categoriasIncidencia.id));

    // 3. Terminales registradas en ambientes
    const terminales = await db
      .select({
        id: terminalesSala.id,
        sedeId: terminalesSala.sedeId,
        sedeNombre: sedes.nombre,
        ambienteId: terminalesSala.ambienteId,
        ambienteNombre: ambientes.nombre,
        ambienteCodigo: ambientes.codigo,
        token: terminalesSala.token,
        nombre: terminalesSala.nombre,
        tipoDispositivo: terminalesSala.tipoDispositivo,
        activo: terminalesSala.activo,
        ultimoAcceso: terminalesSala.ultimoAcceso,
        createdAt: terminalesSala.createdAt,
      })
      .from(terminalesSala)
      .innerJoin(sedes, eq(terminalesSala.sedeId, sedes.id))
      .innerJoin(ambientes, eq(terminalesSala.ambienteId, ambientes.id))
      .orderBy(desc(terminalesSala.activo), desc(terminalesSala.ultimoAcceso), desc(terminalesSala.createdAt));

    return NextResponse.json({
      success: true,
      config: configMap,
      categorias,
      terminales,
    });
  } catch (error: any) {
    console.error('Error al obtener configuración de soporte:', error);
    return NextResponse.json({ error: 'Error interno al consultar configuración' }, { status: 500 });
  }
}

// POST: Modificar PIN maestro o crear nueva categoría de asistencia
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // Acción 1: Actualizar PIN Maestro o Ajustes Globales
    if (action === 'update_config') {
      const { clave, valor } = body;
      if (!clave || valor === undefined) {
        return NextResponse.json({ error: 'Clave y valor son requeridos' }, { status: 400 });
      }

      await db
        .insert(configuracionSistema)
        .values({
          clave: String(clave),
          valor: String(valor).trim(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: configuracionSistema.clave,
          set: {
            valor: String(valor).trim(),
            updatedAt: new Date(),
          },
        });

      return NextResponse.json({
        success: true,
        mensaje: `Configuración '${clave}' actualizada correctamente`,
      });
    }

    // Acción 2: Crear nueva categoría / botón de auxilio
    if (action === 'create_categoria') {
      const { nombre, icono, color, tipo, prioridad, orden } = body;
      if (!nombre || !nombre.trim()) {
        return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
      }

      const [nueva] = await db
        .insert(categoriasIncidencia)
        .values({
          nombre: String(nombre).trim(),
          icono: icono ? String(icono).trim() : '🚨',
          color: color ? String(color).trim() : '#ef4444',
          tipo: tipo || 'tecnico',
          prioridad: prioridad || 'normal',
          orden: Number(orden) || 1,
          activo: true,
        })
        .returning();

      return NextResponse.json({
        success: true,
        mensaje: 'Categoría de asistencia creada con éxito',
        categoria: nueva,
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error en POST /api/admin/soporte/config:', error);
    return NextResponse.json({ error: 'Error interno al procesar la solicitud' }, { status: 500 });
  }
}

// PATCH: Editar categoría existente o cambiar estado de terminal
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // Acción 1: Editar Categoría / Botón
    if (action === 'edit_categoria') {
      const { id, nombre, icono, color, tipo, prioridad, orden, activo } = body;
      if (!id) return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });

      const [updated] = await db
        .update(categoriasIncidencia)
        .set({
          nombre: nombre ? String(nombre).trim() : undefined,
          icono: icono ? String(icono).trim() : undefined,
          color: color ? String(color).trim() : undefined,
          tipo: tipo || undefined,
          prioridad: prioridad || undefined,
          orden: orden !== undefined ? Number(orden) : undefined,
          activo: typeof activo === 'boolean' ? activo : undefined,
          updatedAt: new Date(),
        })
        .where(eq(categoriasIncidencia.id, Number(id)))
        .returning();

      return NextResponse.json({
        success: true,
        mensaje: 'Categoría actualizada correctamente',
        categoria: updated,
      });
    }

    // Acción 2: Activar / Desactivar / Renombrar Terminal de Sala
    if (action === 'toggle_terminal') {
      const { id, activo, nombre } = body;
      if (!id) return NextResponse.json({ error: 'ID de terminal es requerido' }, { status: 400 });

      const [updated] = await db
        .update(terminalesSala)
        .set({
          activo: typeof activo === 'boolean' ? activo : undefined,
          nombre: nombre ? String(nombre).trim() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(terminalesSala.id, Number(id)))
        .returning();

      return NextResponse.json({
        success: true,
        mensaje: `Terminal ${updated?.activo ? 'habilitada' : 'deshabilitada'} con éxito`,
        terminal: updated,
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error en PATCH /api/admin/soporte/config:', error);
    return NextResponse.json({ error: 'Error interno al actualizar' }, { status: 500 });
  }
}

// DELETE: Eliminar categoría o desvincular terminal
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const id = Number(searchParams.get('id'));

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    if (type === 'categoria') {
      await db.delete(categoriasIncidencia).where(eq(categoriasIncidencia.id, id));
      return NextResponse.json({ success: true, mensaje: 'Categoría eliminada' });
    }

    if (type === 'terminal') {
      await db.delete(terminalesSala).where(eq(terminalesSala.id, id));
      return NextResponse.json({ success: true, mensaje: 'Terminal desvinculada' });
    }

    return NextResponse.json({ error: 'Tipo de entidad no especificado' }, { status: 400 });
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/soporte/config:', error);
    return NextResponse.json({ error: 'Error interno al eliminar' }, { status: 500 });
  }
}
