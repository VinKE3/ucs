import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { configuracionSistema } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(configuracionSistema)
      .where(
        inArray(configuracionSistema.clave, [
          'kiosco_biometria_activa',
          'kiosco_modo_foto_estricto',
        ])
      );

    const configMap: Record<string, string> = {};
    for (const r of rows) {
      configMap[r.clave] = r.valor;
    }

    // Por defecto la biometría está habilitada (true)
    const biometriaActiva = configMap['kiosco_biometria_activa'] !== 'false';
    const modoFotoEstricto = configMap['kiosco_modo_foto_estricto'] === 'true';

    return NextResponse.json({
      success: true,
      config: {
        biometriaActiva,
        modoFotoEstricto,
      },
    });
  } catch (error: any) {
    console.error('Error al obtener configuración de kiosco:', error);
    return NextResponse.json({ error: 'Error al consultar configuración' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.rolSistema !== 'super_admin' && session.rolSistema !== 'admin')) {
      return NextResponse.json({ error: 'No autorizado. Se requieren privilegios de administrador.' }, { status: 401 });
    }

    const body = await request.json();
    const { biometriaActiva, modoFotoEstricto } = body;

    const updates = [];

    if (typeof biometriaActiva === 'boolean') {
      updates.push(
        db
          .insert(configuracionSistema)
          .values({
            clave: 'kiosco_biometria_activa',
            valor: String(biometriaActiva),
            descripcion: 'Habilita o deshabilita la captura fotográfica con cámara web en el Kiosco',
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: configuracionSistema.clave,
            set: {
              valor: String(biometriaActiva),
              updatedAt: new Date(),
            },
          })
      );
    }

    if (typeof modoFotoEstricto === 'boolean') {
      updates.push(
        db
          .insert(configuracionSistema)
          .values({
            clave: 'kiosco_modo_foto_estricto',
            valor: String(modoFotoEstricto),
            descripcion: 'Si está activo, bloquea el marcado si no se captura la foto (sin modo fail-safe)',
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: configuracionSistema.clave,
            set: {
              valor: String(modoFotoEstricto),
              updatedAt: new Date(),
            },
          })
      );
    }

    await Promise.all(updates);

    return NextResponse.json({
      success: true,
      mensaje: 'Configuración de Kiosco actualizada exitosamente',
      config: {
        biometriaActiva: typeof biometriaActiva === 'boolean' ? biometriaActiva : undefined,
        modoFotoEstricto: typeof modoFotoEstricto === 'boolean' ? modoFotoEstricto : undefined,
      },
    });
  } catch (error: any) {
    console.error('Error al guardar configuración de kiosco:', error);
    return NextResponse.json({ error: 'Error interno al guardar configuración' }, { status: 500 });
  }
}

