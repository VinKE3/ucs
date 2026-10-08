import { NextResponse } from 'next/server';
import { db } from '@/db';
import { terminalesKiosco, sedes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ autorizada: false, error: 'Token no proporcionado' }, { status: 400 });
    }

    // Buscar terminal por token
    const results = await db
      .select({
        id: terminalesKiosco.id,
        nombre: terminalesKiosco.nombre,
        sedeId: terminalesKiosco.sedeId,
        activo: terminalesKiosco.activo,
        ultimoUso: terminalesKiosco.ultimoUso,
        sedeNombre: sedes.nombre,
        sedeCodigo: sedes.codigo,
      })
      .from(terminalesKiosco)
      .leftJoin(sedes, eq(terminalesKiosco.sedeId, sedes.id))
      .where(eq(terminalesKiosco.token, token.trim()))
      .limit(1);

    if (results.length === 0) {
      return NextResponse.json({ autorizada: false, error: 'Dispositivo no registrado' }, { status: 404 });
    }

    const terminal = results[0];

    if (!terminal.activo) {
      return NextResponse.json(
        { autorizada: false, error: 'Esta terminal ha sido desactivada por la coordinación' },
        { status: 403 }
      );
    }

    // Actualizar último uso de forma asíncrona
    db.update(terminalesKiosco)
      .set({ ultimoUso: new Date(), updatedAt: new Date() })
      .where(eq(terminalesKiosco.id, terminal.id))
      .catch((err) => console.error('Error actualizando ultimoUso terminal:', err));

    return NextResponse.json({
      autorizada: true,
      terminal: {
        id: terminal.id,
        nombre: terminal.nombre,
        sedeId: terminal.sedeId,
        sedeNombre: terminal.sedeNombre,
        sedeCodigo: terminal.sedeCodigo,
      },
    });
  } catch (error: any) {
    console.error('Error al verificar terminal kiosco:', error);
    return NextResponse.json(
      { autorizada: false, error: 'Error interno al validar terminal' },
      { status: 500 }
    );
  }
}
