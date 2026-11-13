import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dni, descriptor, fotoPreview } = body;

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

    // Actualizar descriptor facial en Neon Postgres
    await db
      .update(usuarios)
      .set({
        descriptorFacial: descriptor,
        enroladoFacialAt: now,
        fotoPerfilUrl: typeof fotoPreview === 'string' && fotoPreview.length > 0 ? fotoPreview : undefined,
        updatedAt: now,
      })
      .where(eq(usuarios.dni, trimmedDni));

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
    const { searchParams } = new URL(request.url);
    const dni = searchParams.get('dni')?.trim();

    if (!dni) {
      return NextResponse.json(
        { success: false, error: 'El DNI es obligatorio para eliminar el enrolamiento.' },
        { status: 400 }
      );
    }

    await db
      .update(usuarios)
      .set({
        descriptorFacial: null,
        enroladoFacialAt: null,
        updatedAt: new Date(),
      })
      .where(eq(usuarios.dni, dni));

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
