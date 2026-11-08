import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { configuracionSistema } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { purgarFotosExpiradas } from '@/lib/fotoStorage';

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
          'kiosco_dias_retencion_fotos',
        ])
      );

    const configMap: Record<string, string> = {};
    for (const r of rows) {
      configMap[r.clave] = r.valor;
    }

    // Por defecto la biometría está habilitada (true) y la retención es de 4 días
    const biometriaActiva = configMap['kiosco_biometria_activa'] !== 'false';
    const modoFotoEstricto = configMap['kiosco_modo_foto_estricto'] === 'true';
    const diasRetencionFotos = configMap['kiosco_dias_retencion_fotos']
      ? Math.max(1, parseInt(configMap['kiosco_dias_retencion_fotos'], 10))
      : 4;

    return NextResponse.json({
      success: true,
      config: {
        biometriaActiva,
        modoFotoEstricto,
        diasRetencionFotos,
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
    const { biometriaActiva, modoFotoEstricto, diasRetencionFotos, purgarAhora } = body;

    // Si se solicitó la purga manual inmediata
    if (purgarAhora === true) {
      const dias = typeof diasRetencionFotos === 'number' ? diasRetencionFotos : undefined;
      const resultadoPurga = await purgarFotosExpiradas(dias);
      return NextResponse.json({
        success: true,
        mensaje: `Se eliminaron ${resultadoPurga.eliminadas} fotos expiradas (> ${resultadoPurga.diasVigencia} días) de ${resultadoPurga.asistenciasProcesadas} registros.`,
        resultado: resultadoPurga,
      });
    }

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

    if (typeof diasRetencionFotos === 'number' && diasRetencionFotos >= 1 && diasRetencionFotos <= 365) {
      updates.push(
        db
          .insert(configuracionSistema)
          .values({
            clave: 'kiosco_dias_retencion_fotos',
            valor: String(Math.floor(diasRetencionFotos)),
            descripcion: 'Días de vigencia y retención de fotografías de auditoría en Vercel Blob antes de la auto-purga',
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: configuracionSistema.clave,
            set: {
              valor: String(Math.floor(diasRetencionFotos)),
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
        biometriaActiva,
        modoFotoEstricto,
        diasRetencionFotos: typeof diasRetencionFotos === 'number' ? diasRetencionFotos : undefined,
      },
    });
  } catch (error: any) {
    console.error('Error al guardar configuración de kiosco:', error);
    return NextResponse.json({ error: error.message || 'Error al guardar configuración' }, { status: 500 });
  }
}
