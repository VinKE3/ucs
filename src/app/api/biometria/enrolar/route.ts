import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdminSession, requireAdminOrTerminalAuth } from '@/lib/apiSecurity';
import { recordAuditLog } from '@/lib/auditLogger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Seguridad: Solo administradores autenticados o terminales Kiosco autorizadas pueden enrolar rostros
    const auth = await requireAdminOrTerminalAuth(request);
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const body = await request.json();
    const { dni, descriptor, fotoPreview, consentimientoAceptado } = body;

    if (!dni || typeof dni !== 'string') {
      return NextResponse.json(
        { success: false, error: 'El DNI es obligatorio y debe ser texto.' },
        { status: 400 }
      );
    }

    const trimmedDni = dni.trim();

    // Validar que el descriptor sea un vector de 128 floats, un array multi-ángulo o un objeto v2
    let isValidDescriptor = false;
    let totalVectors = 1;

    if (Array.isArray(descriptor)) {
      if (descriptor.length === 128 && typeof descriptor[0] === 'number') {
        isValidDescriptor = true;
        totalVectors = 1;
      } else if (
        descriptor.length > 0 &&
        Array.isArray(descriptor[0]) &&
        descriptor[0].length === 128
      ) {
        isValidDescriptor = true;
        totalVectors = descriptor.length;
      }
    } else if (typeof descriptor === 'object' && descriptor !== null) {
      if (Array.isArray(descriptor.descriptors) && descriptor.descriptors.length > 0) {
        isValidDescriptor = true;
        totalVectors = descriptor.descriptors.length;
      }
    }

    if (!isValidDescriptor) {
      return NextResponse.json(
        {
          success: false,
          error:
            'El descriptor facial debe ser un vector biométrico de 128 dimensiones o un conjunto multi-ángulo válido.',
        },
        { status: 400 }
      );
    }

    // Verificar que el usuario exista en la base de datos
    const user = await db
      .select({
        id: usuarios.id,
        dni: usuarios.dni,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        tipoPersonal: usuarios.tipoPersonal,
        activo: usuarios.activo,
      })
      .from(usuarios)
      .where(eq(usuarios.dni, trimmedDni))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json(
        { success: false, error: `No se encontró ningún colaborador con el DNI ${trimmedDni} en la base de datos de la UCS.` },
        { status: 404 }
      );
    }

    const targetUser = user[0];
    if (!targetUser.activo) {
      return NextResponse.json(
        { success: false, error: `El colaborador con DNI ${trimmedDni} se encuentra inactivo.` },
        { status: 403 }
      );
    }

    const now = new Date();
    const actorNombre = auth.session
      ? `${auth.session.nombres} ${auth.session.apellidos}`.trim()
      : `Terminal Kiosco #${auth.terminalId || '?'}`;
    const actorRol = auth.session ? auth.session.rolSistema : 'kiosco';

    // Actualizar descriptor facial y trazabilidad (Ley 29733) en Neon Postgres
    await db
      .update(usuarios)
      .set({
        descriptorFacial: descriptor,
        enroladoFacialAt: now,
        enroladoPorId: auth.session?.userId ?? null,
        consentimientoBiometricoAt: consentimientoAceptado !== false ? now : null,
        fotoPerfilUrl: typeof fotoPreview === 'string' && fotoPreview.length > 0 ? fotoPreview : undefined,
        updatedAt: now,
      })
      .where(eq(usuarios.dni, trimmedDni));

    await recordAuditLog({
      actorId: auth.session?.userId ?? null,
      actorNombre,
      actorRol,
      modulo: 'biometria',
      accion: 'BIOMETRIA_ENROLAR',
      entidadTipo: 'usuario',
      entidadId: targetUser.dni,
      resumen: `Enrolamiento facial (${totalVectors} ${totalVectors === 1 ? 'vector' : 'ángulos 3D'}) para ${targetUser.nombres} ${targetUser.apellidos} (DNI ${targetUser.dni})`,
      detalles: {
        usuarioId: targetUser.id,
        dni: targetUser.dni,
        tipoPersonal: targetUser.tipoPersonal,
        totalVectors,
        origen: auth.source,
        consentimientoLey29733: consentimientoAceptado !== false,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      message: `Rostro enrolado exitosamente en la base de datos para ${targetUser.nombres} ${targetUser.apellidos}.`,
      usuario: {
        id: targetUser.id,
        dni: targetUser.dni,
        nombreCompleto: `${targetUser.nombres} ${targetUser.apellidos}`.trim(),
        tipoPersonal: targetUser.tipoPersonal,
        enroladoAt: now.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error en POST /api/biometria/enrolar:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno al guardar la biometría facial.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    // Seguridad estricta: Solo administradores pueden desvincular/eliminar plantillas biométricas
    const auth = await requireAdminSession();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const dni = searchParams.get('dni')?.trim();

    if (!dni) {
      return NextResponse.json(
        { success: false, error: 'El DNI es obligatorio para eliminar el enrolamiento.' },
        { status: 400 }
      );
    }

    const [target] = await db
      .select({ id: usuarios.id, nombres: usuarios.nombres, apellidos: usuarios.apellidos })
      .from(usuarios)
      .where(eq(usuarios.dni, dni))
      .limit(1);

    await db
      .update(usuarios)
      .set({
        descriptorFacial: null,
        enroladoFacialAt: null,
        enroladoPorId: null,
        consentimientoBiometricoAt: null,
        updatedAt: new Date(),
      })
      .where(eq(usuarios.dni, dni));

    await recordAuditLog({
      actorId: auth.session?.userId ?? null,
      actorNombre: auth.session
        ? `${auth.session.nombres} ${auth.session.apellidos}`.trim()
        : 'Administrador',
      actorRol: auth.session?.rolSistema || 'admin',
      modulo: 'biometria',
      accion: 'BIOMETRIA_ELIMINAR',
      entidadTipo: 'usuario',
      entidadId: dni,
      resumen: `Desvinculación de biometría facial para ${target ? `${target.nombres} ${target.apellidos}` : `DNI ${dni}`} (DNI ${dni})`,
      detalles: { usuarioId: target?.id ?? null, dni },
      request,
    });

    return NextResponse.json({
      success: true,
      message: `Enrolamiento biométrico eliminado para el DNI ${dni}.`,
    });
  } catch (error: any) {
    console.error('Error en DELETE /api/biometria/enrolar:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno al eliminar el enrolamiento biométrico.' },
      { status: 500 }
    );
  }
}
