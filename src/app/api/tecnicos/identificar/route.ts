import { parseJsonBody, identificarTecnicoSchema } from '@/lib/validations';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req, identificarTecnicoSchema);
    if (!parsed.success) {
      return parsed.response;
    }
    const { dni } = parsed.data;

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
      return NextResponse.json(
        { success: false, error: 'DNI no encontrado en la base de datos de personal' },
        { status: 404 }
      );
    }

    const u = foundUsers[0];

    if (!u.activo) {
      return NextResponse.json(
        { success: false, error: 'El usuario asociado a este DNI está inactivo' },
        { status: 403 }
      );
    }

    const nombreCompleto = `${u.nombres} ${u.apellidos}`.trim();

    return NextResponse.json({
      success: true,
      tecnico: {
        id: u.id,
        dni: u.dni,
        nombre: nombreCompleto,
        nombres: u.nombres,
        apellidos: u.apellidos,
        tipoPersonal: u.tipoPersonal,
      },
    });
  } catch (error) {
    console.error('Error al identificar técnico:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor al validar DNI' },
      { status: 500 }
    );
  }
}
