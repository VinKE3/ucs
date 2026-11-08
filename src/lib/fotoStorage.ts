import fs from 'fs';
import path from 'path';

export interface GuardarFotoOptions {
  fotoBase64: string;
  usuarioId: number;
  asistenciaId: number;
  tipoPersonal?: string;
}

/**
 * Guarda la fotografía de evidencia de marcación de Kiosco.
 * - Si BLOB_READ_WRITE_TOKEN está configurado, la sube a Vercel Blob Storage en la nube:
 *   - Admite Stores Públicos (retorna URL directa de CDN).
 *   - Admite Stores Privados (retorna URL a través del endpoint seguro /api/foto?url=...).
 * - Si no está configurado o si la red falla, la guarda en public/uploads/asistencias/
 *   como respaldo automático garantizando cero caídas.
 */
export async function guardarFotoAsistencia(options: GuardarFotoOptions): Promise<string | null> {
  const { fotoBase64, usuarioId, asistenciaId } = options;
  if (!fotoBase64 || typeof fotoBase64 !== 'string') return null;

  try {
    // 1. Extraer los bytes en Buffer (admite data:image/webp;base64,... o data:image/jpeg;base64,...)
    const cleanBase64 = fotoBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length === 0) return null;

    const fechaHoy = new Date().toISOString().slice(0, 10);
    const fileName = `asist_${asistenciaId}_user${usuarioId}_${Date.now()}.webp`;

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
