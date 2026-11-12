import { NextResponse } from 'next/server';
import { db } from '@/db';
import { usuarios } from '@/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dniFilter = searchParams.get('dni')?.trim();

    const conditions = [
      eq(usuarios.activo, true),
      isNotNull(usuarios.descriptorFacial),
    ];

    if (dniFilter) {
      conditions.push(eq(usuarios.dni, dniFilter));
    }

    const enrolledList = await db
      .select({
        id: usuarios.id,
        dni: usuarios.dni,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        tipoPersonal: usuarios.tipoPersonal,
        descriptorFacial: usuarios.descriptorFacial,
        fotoPerfilUrl: usuarios.fotoPerfilUrl,
        enroladoFacialAt: usuarios.enroladoFacialAt,
      })
      .from(usuarios)
      .where(and(...conditions));

    const formatted = enrolledList.map((u) => ({
      id: u.id,
      dni: u.dni,
      nombre: `${u.nombres} ${u.apellidos}`.trim(),
      tipoPersonal: u.tipoPersonal,
      descriptor: u.descriptorFacial as number[],
      fotoPreview: u.fotoPerfilUrl || undefined,
      enrolledAt: u.enroladoFacialAt?.toISOString() || new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      total: formatted.length,
      descriptores: formatted,
    });
  } catch (error: any) {
    console.error('Error en GET /api/biometria/descriptores:', error);
    return NextResponse.json(
      { success: false, error: 'Error al consultar descriptores biométricos.' },
      { status: 500 }
    );
  }
}

