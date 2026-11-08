import fs from 'fs';
import path from 'path';
import { db } from '@/db';
import { asistencias, configuracionSistema } from '@/db/schema';
import { eq, or, isNotNull, lte, sql } from 'drizzle-orm';

export interface GuardarFotoOptions {
  fotoBase64: string;
  usuarioId: number;
  asistenciaId: number;
  tipoPersonal?: string;
  tipoMarcacion?: 'ingreso' | 'salida';
}

/**
 * Guarda la fotografía de evidencia de marcación de Kiosco (Ingreso o Salida).
 * - Si BLOB_READ_WRITE_TOKEN está configurado, la sube a Vercel Blob Storage en la nube:
 *   - Admite Stores Públicos (retorna URL directa de CDN).
 *   - Admite Stores Privados (retorna URL a través del endpoint seguro /api/foto?url=...).
 * - Si no está configurado o si la red falla, la guarda en public/uploads/asistencias/
 *   como respaldo automático garantizando cero caídas.
 */
export async function guardarFotoAsistencia(options: GuardarFotoOptions): Promise<string | null> {
  const { fotoBase64, usuarioId, asistenciaId, tipoMarcacion = 'ingreso' } = options;
  if (!fotoBase64 || typeof fotoBase64 !== 'string') return null;

  try {
    // 1. Extraer los bytes en Buffer (admite data:image/webp;base64,... o data:image/jpeg;base64,...)
    const cleanBase64 = fotoBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length === 0) return null;

    const fechaHoy = new Date().toISOString().slice(0, 10);
    const fileName = `asist_${asistenciaId}_${tipoMarcacion}_user${usuarioId}_${Date.now()}.webp`;

    // 2. Ruta A: Vercel Blob Storage Oficial
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (blobToken && blobToken.length > 10 && !blobToken.includes('...')) {
      try {
        const { put } = await import('@vercel/blob');
        const blobPath = `asistencias/${fechaHoy}/${fileName}`;

        let blobResult;
        try {
          // Intento inicial: Acceso público directo (estándar para fotos)
          blobResult = await put(blobPath, buffer, {
            access: 'public',
            contentType: 'image/webp',
            token: blobToken,
          });
        } catch (pubErr: any) {
          // Si el almacén de Vercel fue creado como Privado, subir con access: 'private'
          if (String(pubErr?.message || '').toLowerCase().includes('private store')) {
            blobResult = await put(blobPath, buffer, {
              access: 'private',
              contentType: 'image/webp',
              token: blobToken,
            });
          } else {
            throw pubErr;
          }
        }

        // Si la URL resultante es de un store privado, servirla a través de nuestro endpoint /api/foto
        if (blobResult.url.includes('.private.blob.vercel-storage.com')) {
          return `/api/foto?url=${encodeURIComponent(blobResult.url)}`;
        }

        return blobResult.url;
      } catch (blobErr) {
        console.warn('⚠️ Falló subida a Vercel Blob, recurriendo a almacenamiento local de respaldo:', blobErr);
      }
    }

    // 3. Ruta B: Almacenamiento Local de Respaldo / Contingencia en /public/uploads/asistencias/
    const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads', 'asistencias');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const localFilePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(localFilePath, buffer);
    return `/uploads/asistencias/${fileName}`;
  } catch (error) {
    console.error('❌ Error al procesar fotografía de asistencia:', error);
    return null;
  }
}

/**
 * Purga y elimina automáticamente de Vercel Blob (y del almacenamiento local)
 * todas las fotografías de asistencia cuya antigüedad supere los días de vigencia configurados.
 */
export async function purgarFotosExpiradas(diasOverride?: number): Promise<{
  eliminadas: number;
  asistenciasProcesadas: number;
  diasVigencia: number;
  error?: string;
}> {
  try {
    let diasVigencia = diasOverride;
    if (!diasVigencia || diasVigencia < 1) {
      const [cfgDias] = await db
        .select({ valor: configuracionSistema.valor })
        .from(configuracionSistema)
        .where(eq(configuracionSistema.clave, 'kiosco_dias_retencion_fotos'))
        .limit(1);
      diasVigencia = cfgDias?.valor ? Math.max(1, parseInt(cfgDias.valor, 10)) : 4;
    }

    // Fecha límite de corte: registros cuya fecha sea anterior a (HOY - diasVigencia)
    const fechaCorteDate = new Date();
    fechaCorteDate.setDate(fechaCorteDate.getDate() - diasVigencia);
    const fechaCorteIso = fechaCorteDate.toISOString().slice(0, 10); // YYYY-MM-DD

    // Buscar asistencias que tengan fotos pendientes de purga
    const registrosConFoto = await db
      .select({
        id: asistencias.id,
        fecha: asistencias.fecha,
        fotoIngresoUrl: asistencias.fotoIngresoUrl,
        fotoSalidaUrl: asistencias.fotoSalidaUrl,
      })
      .from(asistencias)
      .where(
        sql`${asistencias.fecha} <= ${fechaCorteIso} AND (${asistencias.fotoIngresoUrl} IS NOT NULL OR ${asistencias.fotoSalidaUrl} IS NOT NULL)`
      );

    if (registrosConFoto.length === 0) {
      return { eliminadas: 0, asistenciasProcesadas: 0, diasVigencia };
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    let delFn: ((url: string, opts?: any) => Promise<any>) | null = null;
    if (blobToken && blobToken.length > 10) {
      try {
        const { del } = await import('@vercel/blob');
        delFn = del;
      } catch (err) {
        console.warn('No se pudo cargar @vercel/blob para borrado:', err);
      }
    }

    let eliminadas = 0;
    const asistenciasIdsActualizar: number[] = [];

    for (const reg of registrosConFoto) {
      const fotosABorrar = [reg.fotoIngresoUrl, reg.fotoSalidaUrl].filter(Boolean) as string[];

      for (const rawUrl of fotosABorrar) {
        try {
          // Caso A: Es URL de Vercel Blob (directa o enviada vía /api/foto?url=...)
          let targetBlobUrl: string | null = null;
          if (rawUrl.includes('/api/foto?url=')) {
            const parsed = new URL(rawUrl, 'http://localhost');
            targetBlobUrl = parsed.searchParams.get('url');
          } else if (rawUrl.includes('blob.vercel-storage.com')) {
            targetBlobUrl = rawUrl;
          }

          if (targetBlobUrl && delFn && blobToken) {
            await delFn(targetBlobUrl, { token: blobToken });
            eliminadas++;
          } else if (rawUrl.startsWith('/uploads/')) {
            // Caso B: Archivo físico en el servidor local
            const localPath = path.resolve(process.cwd(), 'public', rawUrl.replace(/^\//, ''));
            if (fs.existsSync(localPath)) {
              fs.unlinkSync(localPath);
              eliminadas++;
            }
          }
        } catch (delErr) {
          console.warn(`⚠️ Error al eliminar foto ${rawUrl}:`, delErr);
        }
      }

      asistenciasIdsActualizar.push(reg.id);
    }

    // Actualizar BD: limpiar URLs y marcar fotosPurgadas = true
    if (asistenciasIdsActualizar.length > 0) {
      for (const id of asistenciasIdsActualizar) {
        await db
          .update(asistencias)
          .set({
            fotoIngresoUrl: null,
            fotoSalidaUrl: null,
            fotosPurgadas: true,
            updatedAt: new Date(),
          })
          .where(eq(asistencias.id, id));
      }
    }

    return {
      eliminadas,
      asistenciasProcesadas: asistenciasIdsActualizar.length,
      diasVigencia,
    };
  } catch (error: any) {
    console.error('❌ Error en purga de fotos expiradas:', error);
    return {
      eliminadas: 0,
      asistenciasProcesadas: 0,
      diasVigencia: diasOverride || 4,
      error: error?.message || 'Error en purga de fotos',
    };
  }
}
